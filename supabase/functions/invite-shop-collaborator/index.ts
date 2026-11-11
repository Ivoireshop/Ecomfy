import { serveCors } from "../_shared/http.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { APP_URL, guardEmail } from "../_shared/email-sender.ts";
import {
  MAX_COLLABORATORS_PER_SHOP,
  MAX_INVITES_PER_HOUR,
  escapeHtml,
  escapeLike,
  isValidEmail,
  resolveInviteOrigin,
} from "./helpers.ts";

const ALLOWED_ROLES = new Set([
  'view_orders', 'edit_shop', 'manage_expenses', 'manage_delivered_orders',
  'manage_catalog', 'view_stats', 'manage_customers', 'full_admin'
])

function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serveCors("app", async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!token) return json({ success: false, error: 'unauthorized' })

    const userClient = createClient(url, serviceKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ success: false, error: 'unauthorized' })

    const body = await req.json().catch(() => ({}))
    const shopId = String(body.shop_id || '').trim()
    const emailRaw = String(body.email || '').trim().toLowerCase()
    const roles = Array.isArray(body.roles) ? body.roles.filter((r: string) => ALLOWED_ROLES.has(r)) : []
    if (!shopId || !emailRaw || roles.length === 0) {
      return json({ success: false, error: 'invalid_input' })
    }
    if (!isValidEmail(emailRaw)) {
      return json({ success: false, error: 'invalid_email' })
    }
    if (emailRaw === (user.email || '').toLowerCase()) {
      return json({ success: false, error: 'cannot_invite_owner' })
    }

    const admin = createClient(url, serviceKey)

    // Verify caller owns the shop
    const { data: shop } = await admin.from('shops').select('id, user_id, business_name').eq('id', shopId).maybeSingle()
    if (!shop || shop.user_id !== user.id) return json({ success: false, error: 'forbidden' })

    // Anti-abus : l'envoi part de noreply@ecomfy.cloud, on borne donc le nombre d'invitations par boutique.
    const sinceHour = new Date(Date.now() - 3600_000).toISOString()
    const { count: recentCount } = await admin.from('shop_collaborators')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId).gte('updated_at', sinceHour).neq('status', 'active')
    if ((recentCount ?? 0) >= MAX_INVITES_PER_HOUR) {
      return json({ success: false, error: 'rate_limited' })
    }

    const invitationToken = randomToken()
    // Upsert (one invite per email per shop). Comparaison exacte insensible à la casse : % et _ sont neutralisés.
    const { data: existing } = await admin.from('shop_collaborators').select('id, invitation_token, status')
      .eq('shop_id', shopId).ilike('invited_email', escapeLike(emailRaw)).maybeSingle()

    if (!existing?.id) {
      const { count: total } = await admin.from('shop_collaborators')
        .select('id', { count: 'exact', head: true }).eq('shop_id', shopId).neq('status', 'revoked')
      if ((total ?? 0) >= MAX_COLLABORATORS_PER_SHOP) {
        return json({ success: false, error: 'too_many_collaborators' })
      }
    }

    let finalToken = invitationToken
    let dbError: any = null

    if (existing?.id) {
      finalToken = existing.invitation_token || invitationToken
      // Un collaborateur déjà actif le reste (changement de rôles) ; sinon l'invitation repart en « pending ».
      const res = await admin.from('shop_collaborators').update({
        roles,
        status: existing.status === 'active' ? 'active' : 'pending',
        invitation_token: finalToken,
        invited_by: user.id,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
      dbError = res.error
    } else {
      const res = await admin.from('shop_collaborators').insert({
        shop_id: shopId, invited_email: emailRaw, roles, status: 'pending',
        invitation_token: invitationToken, invited_by: user.id,
      })
      dbError = res.error
    }

    if (dbError) return json({ success: false, error: 'unexpected_error' })

    // Lien d'acceptation : origine en liste blanche (APP_URL + INVITE_ALLOWED_ORIGINS), jamais l'en-tête brut.
    const origin = resolveInviteOrigin(req.headers.get('origin'), APP_URL, Deno.env.get('INVITE_ALLOWED_ORIGINS') || '')
    const acceptUrl = `${origin}/accept-shop-invite?token=${encodeURIComponent(finalToken)}`

    // Nom lu en base uniquement : le corps de la requête ne peut pas injecter de texte dans le mail.
    const displayShop = shop.business_name || 'votre boutique'

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.warn('RESEND_API_KEY missing, attempting Supabase Auth invite fallback...')
      try {
        const { error: authErr } = await admin.auth.admin.inviteUserByEmail(emailRaw, {
          redirectTo: acceptUrl,
          data: { shop_id: shopId, shop_name: displayShop, roles, invitation_token: finalToken },
        })
        if (!authErr) {
          return json({ success: true, method: 'supabase_auth_fallback' })
        }
        console.warn('Supabase Auth invite fallback failed:', authErr)
      } catch (e) {
        console.warn('Supabase Auth invite fallback exception:', e)
      }

      return json({
        success: false,
        error: 'email_not_sent',
        details: 'RESEND_API_KEY non configurée dans Supabase. Veuillez définir la clé RESEND_API_KEY.',
      })
    }
    const rolesLabels: Record<string, string> = {
      view_orders: 'Voir les commandes',
      edit_shop: 'Modifier la boutique',
      manage_expenses: 'Gérer les dépenses',
      manage_delivered_orders: 'Gérer les commandes livrées',
      manage_catalog: 'Gérer le catalogue',
      view_stats: 'Voir les statistiques',
      manage_customers: 'Service client (Avis & Contacts)',
      full_admin: 'Accès total (Admin)',
    }
    const rolesHtml = roles.map((r: string) => `<li style="margin-bottom:4px;"><strong>${escapeHtml(rolesLabels[r] || r)}</strong></li>`).join('')
    
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;padding:32px 16px;color:#0f172a;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 8px;">Ecomfy 🛍️</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">Invitation d'accès collaborateur</p>
    </div>
    <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
      <p style="font-size:16px;line-height:1.6;color:#334155;margin-top:0;">
        Bonjour,
      </p>
      <p style="font-size:16px;line-height:1.6;color:#334155;">
        Vous avez été invité(e) à rejoindre la boutique <strong>${escapeHtml(displayShop)}</strong> sur Ecomfy.
      </p>
      ${rolesHtml ? `
      <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 8px;">Rôles et permissions attribués :</p>
        <ul style="color:#334155;font-size:14px;margin:0;padding-left:20px;">
          ${rolesHtml}
        </ul>
      </div>` : ''}
      <p style="font-size:15px;line-height:1.6;color:#334155;">
        Cliquez sur le bouton ci-dessous pour accepter votre invitation et accéder directement à l'espace de gestion de la boutique :
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${escapeHtml(acceptUrl)}" style="background:#10b981;color:#ffffff;padding:14px 28px;border-radius:9999px;font-weight:700;font-size:15px;text-decoration:none;display:inline-block;box-shadow:0 4px 12px rgba(16,185,129,0.25);">
          Accepter l'invitation
        </a>
      </div>
      <p style="font-size:13px;color:#64748b;line-height:1.5;">
        Cette invitation est personnelle et liée à votre adresse email (<strong>${escapeHtml(emailRaw)}</strong>).
      </p>
    </div>
    <div style="border-top:1px solid #f1f5f9;margin-top:32px;padding-top:16px;text-align:center;font-size:12px;color:#94a3b8;">
      <p style="margin:0 0 8px;">Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.</p>
      <p style="margin:0;word-break:break-all;">Lien direct : <a href="${escapeHtml(acceptUrl)}" style="color:#10b981;">${escapeHtml(acceptUrl)}</a></p>
      <p style="margin-top:16px;color:#cbd5e1;">&copy; Ecomfy — Tous droits réservés</p>
    </div>
  </div>
</body>
</html>`

    const sendWithFrom = async (fromAddress: string) => {
      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          ...guardEmail([emailRaw], `Invitation à rejoindre la boutique ${displayShop.replace(/[\r\n]+/g, ' ')} — Ecomfy`),
          html,
        }),
      })
    }

    // Try configured custom sender first, fallback to onboarding@resend.dev
    const customFrom = Deno.env.get('RESEND_FROM_EMAIL') || 'Ecomfy <noreply@ecomfy.cloud>'
    let resendRes = await sendWithFrom(customFrom)
    let resendData = await resendRes.json().catch(() => ({}))

    if (!resendRes.ok) {
      console.warn('Custom from sender failed, falling back to onboarding sender:', resendData)
      const fallbackFrom = 'Ecomfy <onboarding@resend.dev>'
      if (customFrom !== fallbackFrom) {
        resendRes = await sendWithFrom(fallbackFrom)
        resendData = await resendRes.json().catch(() => ({}))
      }
    }

    if (!resendRes.ok) {
      console.error('Resend invite failed', resendRes.status, resendData)
      return json({
        success: true,
        email_sent: false,
        warning: resendData?.message || `Erreur d'envoi Resend (${resendRes.status})`,
      })
    }

    return json({ success: true, email_sent: true })
  } catch (e: any) {
    return json({ success: false, error: 'unexpected_error' })
  }
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
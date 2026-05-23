import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const ALLOWED_ROLES = new Set([
  'view_orders', 'edit_shop', 'manage_expenses', 'manage_delivered_orders',
])

function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
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
    const shopName = String(body.shop_name || 'votre boutique').slice(0, 120)
    const roles = Array.isArray(body.roles) ? body.roles.filter((r: string) => ALLOWED_ROLES.has(r)) : []
    if (!shopId || !emailRaw || roles.length === 0) {
      return json({ success: false, error: 'invalid_input' })
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) {
      return json({ success: false, error: 'invalid_email' })
    }

    const admin = createClient(url, serviceKey)

    // Verify caller owns the shop
    const { data: shop } = await admin.from('shops').select('id, user_id, business_name').eq('id', shopId).maybeSingle()
    if (!shop || shop.user_id !== user.id) return json({ success: false, error: 'forbidden' })

    const invitationToken = randomToken()
    // Upsert (one invite per email per shop)
    const { data: existing } = await admin.from('shop_collaborators').select('id, invitation_token')
      .eq('shop_id', shopId).ilike('invited_email', emailRaw).maybeSingle()

    let finalToken = invitationToken
    if (existing?.id) {
      finalToken = existing.invitation_token || invitationToken
      await admin.from('shop_collaborators').update({
        roles, status: 'pending', invited_by: user.id, updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      const { error: insErr } = await admin.from('shop_collaborators').insert({
        shop_id: shopId, invited_email: emailRaw, roles, status: 'pending',
        invitation_token: invitationToken, invited_by: user.id,
      })
      if (insErr) return json({ success: false, error: insErr.message })
    }

    const origin = req.headers.get('origin') || 'https://visuelpro.cloud'
    const acceptUrl = `${origin}/accept-shop-invite?token=${encodeURIComponent(finalToken)}`

    // Direct send via Resend (no DNS setup required, uses onboarding@resend.dev)
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return json({ success: false, error: 'email_not_sent', details: 'RESEND_API_KEY missing' })
    }
    const displayShop = shop.business_name || shopName
    const rolesLabels: Record<string, string> = {
      view_orders: 'Voir les commandes',
      edit_shop: 'Modifier la boutique',
      manage_expenses: 'Gérer les dépenses',
      manage_delivered_orders: 'Gérer les commandes livrées',
    }
    const rolesHtml = roles.map((r: string) => `<li>${rolesLabels[r] || r}</li>`).join('')
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;padding:24px;color:#0f172a">
      <div style="max-width:560px;margin:0 auto">
        <h1 style="font-size:22px;margin:0 0 16px">Invitation à collaborer 🤝</h1>
        <p style="font-size:15px;line-height:1.6;color:#334155">
          Vous avez été invité(e) à rejoindre la boutique <strong>${displayShop}</strong> sur VisualPro Cloud.
        </p>
        ${rolesHtml ? `<p style="font-size:15px;color:#334155;margin-bottom:6px">Rôles attribués :</p><ul style="color:#334155;font-size:14px">${rolesHtml}</ul>` : ''}
        <p style="font-size:15px;line-height:1.6;color:#334155">
          Pour accepter, cliquez sur le bouton ci-dessous puis connectez-vous (ou créez votre compte) avec cette adresse email.
        </p>
        <p style="text-align:center;margin:28px 0">
          <a href="${acceptUrl}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none;display:inline-block">Accepter l'invitation</a>
        </p>
        <p style="font-size:12px;color:#94a3b8;margin-top:32px">
          Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.<br/>
          Ou copiez ce lien : ${acceptUrl}
        </p>
      </div>
    </body></html>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'VisualPro Cloud <noreply@visuelpro.cloud>',
        to: [emailRaw],
        reply_to: 'contact@visuelpro.cloud',
        subject: `Invitation à collaborer sur ${displayShop}`,
        html,
      }),
    })
    const resendData = await resendRes.json().catch(() => ({}))
    if (!resendRes.ok) {
      console.error('Resend invite failed', resendRes.status, resendData)
      return json({
        success: false,
        error: 'email_not_sent',
        details: resendData?.message || `Resend HTTP ${resendRes.status}`,
      })
    }

    return json({ success: true })
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'unexpected_error' })
  }
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
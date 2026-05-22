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

    // Send via existing app email pipeline. Keep field names aligned with the
    // shared sender so invitation failures are visible instead of silently ignored.
    const { data: emailData, error: emailError } = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'shop-collaborator-invite',
        recipientEmail: emailRaw,
        templateData: {
          shopName: shop.business_name || shopName,
          acceptUrl,
          roles,
        },
        idempotencyKey: `shop-collab-${shopId}-${emailRaw}`,
      },
    })

    if (emailError || !emailData?.success) {
      console.error('Collaborator invite email failed', {
        shopId,
        error: emailError?.message || emailData?.error || emailData?.reason || 'unknown_error',
      })
      return json({
        success: false,
        error: 'email_not_sent',
        details: emailError?.message || emailData?.error || emailData?.reason || 'Impossible d’envoyer le mail d’invitation',
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
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  try {
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)

    const wh = new Webhook(hookSecret)
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: { email: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    const magicLink = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #ffffff; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            h1 { color: #111827; font-size: 24px; font-weight: bold; margin: 40px 0; }
            .button { display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 16px 0; }
            .code-block { display: inline-block; padding: 16px; width: 90%; background-color: #f4f4f4; border-radius: 5px; border: 1px solid #eee; color: #111827; font-family: monospace; margin: 16px 0; }
            .text { color: #111827; font-size: 14px; margin: 24px 0; }
            .footer { color: #6b7280; font-size: 12px; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${email_action_type === 'recovery' ? 'Réinitialisation du mot de passe' : 'Connexion'}</h1>
            <a href="${magicLink}" class="button" target="_blank">
              ${email_action_type === 'recovery' ? 'Cliquez ici pour réinitialiser votre mot de passe' : 'Cliquez ici pour vous connecter avec ce lien magique'}
            </a>
            <p class="text">Ou copiez-collez ce code temporaire :</p>
            <div class="code-block">${token}</div>
            <p class="text" style="color: #6b7280;">
              Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
            </p>
            <p class="footer">
              VisualPro — Création de visuels publicitaires propulsée par l'IA
            </p>
          </div>
        </body>
      </html>
    `

    const subject =
      email_action_type === 'recovery'
        ? 'Réinitialisez votre mot de passe - VisualPro'
        : 'Connexion via lien magique - VisualPro'

    const { error } = await resend.emails.send({
      from: 'VisualPro <onboarding@resend.dev>',
      to: [user.email],
      subject,
      html,
    })

    if (error) throw error

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in send-email function:', error)
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  title?: string
  body?: string
  link?: string
  tone?: string
}

const DeliveryNotificationEmail = ({ title = 'Notification Ecomfy Livraison', body, link, tone = 'info' }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={{ ...badge, color: TONE_COLORS[tone] ?? TONE_COLORS.info }}>Ecomfy Livraison</Text>
        <Heading style={h1}>{title}</Heading>
        {body ? <Text style={text}>{body}</Text> : null}
        {link ? <Button href={link} style={button}>Ouvrir dans Ecomfy</Button> : null}
        <Text style={footer}>
          Vous recevez cet e-mail parce que vous avez une activité sur Ecomfy Livraison. Vous pouvez le désactiver à tout moment
          depuis la cloche des notifications de votre espace.
        </Text>
      </Container>
    </Body>
  </Html>
)

const TONE_COLORS: Record<string, string> = { info: '#0284c7', success: '#059669', warning: '#d97706', error: '#dc2626' }

export const template = {
  component: DeliveryNotificationEmail,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- données de gabarit libres, forme fixée par l'appelant
  subject: (data: Record<string, any>) => String(data?.title || 'Notification Ecomfy Livraison').slice(0, 150),
  displayName: 'Notification Livraison',
  previewData: {
    title: 'Nouvelle commande à traiter',
    body: 'Un marchand vous a transmis une commande pour Abidjan.',
    link: 'https://ecomfy.cloud/delivery/partner-dashboard',
    tone: 'info',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const badge = { fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.06em', textTransform: 'uppercase' as const, margin: '0 0 8px' }
const h1 = { fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 20px' }
const button = {
  backgroundColor: '#059669', color: '#ffffff', fontSize: '15px', fontWeight: 'bold',
  padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', margin: '28px 0 0' }

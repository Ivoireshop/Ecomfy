import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const ROLE_LABELS: Record<string, string> = {
  view_orders: 'Voir les commandes',
  edit_shop: 'Modifier la boutique',
  manage_expenses: 'Gérer les dépenses',
  manage_delivered_orders: 'Gérer les commandes livrées',
}

interface Props {
  shopName?: string
  acceptUrl?: string
  roles?: string[]
}

const ShopCollaboratorInviteEmail = ({
  shopName = 'une boutique',
  acceptUrl = 'https://visuelpro.cloud',
  roles = [],
}: Props) => {
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Vous avez été invité(e) à collaborer sur {shopName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Invitation à collaborer 🤝</Heading>
          <Text style={text}>
            Vous avez été invité(e) à rejoindre la boutique <strong>{shopName}</strong> sur VisualPro Cloud.
          </Text>
          {roles.length > 0 && (
            <Section style={{ margin: '12px 0 20px' }}>
              <Text style={{ ...text, marginBottom: 8 }}>Rôles attribués :</Text>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#334155', fontSize: 14 }}>
                {roles.map((r) => (
                  <li key={r}>{ROLE_LABELS[r] || r}</li>
                ))}
              </ul>
            </Section>
          )}
          <Text style={text}>
            Pour accepter l'invitation, cliquez sur le bouton ci-dessous puis connectez-vous (ou créez votre compte) avec cette adresse email.
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={acceptUrl} style={button}>Accepter l'invitation</Button>
          </Section>
          <Text style={footer}>
            Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ShopCollaboratorInviteEmail,
  subject: (data: Record<string, any>) => `Invitation à collaborer sur ${data?.shopName || 'une boutique'}`,
  displayName: 'Invitation collaborateur boutique',
  previewData: {
    shopName: 'Yama Store',
    acceptUrl: 'https://visuelpro.cloud/accept-shop-invite?token=demo',
    roles: ['view_orders', 'manage_delivered_orders'],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }
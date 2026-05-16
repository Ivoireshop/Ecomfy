import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'VisualPro Cloud'

interface Props {
  mode?: 'activated' | 'already_activated'
  shopName?: string
  shopUrl?: string
}

const ShopActivationEmail = ({
  mode = 'activated',
  shopName = 'votre boutique',
  shopUrl,
}: Props) => {
  const isBlocked = mode === 'already_activated'
  const title = isBlocked
    ? 'Votre boutique est déjà activée'
    : 'Votre boutique est activée 🎉'
  const intro = isBlocked
    ? `Nous avons reçu une nouvelle tentative d'activation pour « ${shopName} », mais celle-ci est déjà active. Aucun nouveau prélèvement n'a été effectué.`
    : `Bonne nouvelle ! Le paiement d'activation de « ${shopName} » a bien été reçu. Votre boutique est maintenant active et publiable.`

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>{intro}</Text>
          {!isBlocked && (
            <Text style={text}>
              Vous pouvez dès maintenant ajouter vos produits, personnaliser votre boutique et partager votre lien public avec vos clients.
            </Text>
          )}
          {shopUrl && (
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={shopUrl} style={button}>
                Accéder à ma boutique
              </Button>
            </Section>
          )}
          <Text style={footer}>Merci de faire confiance à {SITE_NAME}.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ShopActivationEmail,
  subject: (data: Record<string, any>) =>
    data?.mode === 'already_activated'
      ? 'Votre boutique est déjà activée — aucun nouveau prélèvement'
      : 'Votre boutique est activée 🎉',
  displayName: 'Activation de boutique',
  previewData: { mode: 'activated', shopName: 'Ma Boutique', shopUrl: 'https://visuelpro.cloud' },
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
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'VisualPro'

interface Props {
  shopName?: string
  amount?: number
  shopUrl?: string
  unlocked?: boolean
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(n)))

const CommissionPaymentEmail = ({
  shopName = 'votre boutique',
  amount = 12000,
  shopUrl,
  unlocked = true,
}: Props) => {
  const title = unlocked
    ? 'Votre boutique est déverrouillée 🎉'
    : 'Paiement bien reçu'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>
            Bonjour,
          </Text>
          <Text style={text}>
            Votre paiement de <b>{fmt(amount)} FCFA</b> pour « {shopName} » a bien été reçu.
          </Text>
          {unlocked ? (
            <Text style={text}>
              Votre boutique est maintenant <b>déverrouillée automatiquement</b>. Vous pouvez
              dès maintenant accéder à vos commandes, voir les informations complètes de vos
              clients (nom, WhatsApp, adresse, produits, quantité) et reprendre la gestion
              normale de votre boutique.
            </Text>
          ) : (
            <Text style={text}>
              Merci pour votre règlement. Votre solde a été mis à jour.
            </Text>
          )}
          {shopUrl && (
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={shopUrl} style={button}>
                Ouvrir ma boutique
              </Button>
            </Section>
          )}
          <Text style={footer}>Merci d'utiliser {SITE_NAME}.<br />L'équipe {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CommissionPaymentEmail,
  subject: (data: Record<string, any>) =>
    data?.unlocked
      ? 'Votre boutique VisualPro est déverrouillée'
      : 'Paiement de commission bien reçu',
  displayName: 'Paiement de commission / déverrouillage',
  previewData: { shopName: 'Ma Boutique', amount: 12000, shopUrl: 'https://visuelpro.cloud', unlocked: true },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }
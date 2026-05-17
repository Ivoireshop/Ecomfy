import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  shopName?: string
  accountLabel?: string
  daysRemaining?: number
  expiresAt?: string
  manageUrl?: string
}

const AdTokenExpiringEmail = ({
  shopName = 'votre boutique',
  accountLabel = 'votre compte publicitaire',
  daysRemaining = 7,
  expiresAt,
  manageUrl,
}: Props) => {
  const expDate = expiresAt ? new Date(expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre token publicitaire Meta expire dans {daysRemaining} jours</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Action requise : renouvelez votre token Meta Ads</Heading>
          <Text style={text}>
            Le token d'accès du compte publicitaire <b>{accountLabel}</b> connecté à votre boutique <b>{shopName}</b> expire {daysRemaining > 0 ? `dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}` : "aujourd'hui"}{expDate ? ` (le ${expDate})` : ''}.
          </Text>
          <Text style={text}>
            Sans token valide, vos dépenses publicitaires ne pourront plus être synchronisées automatiquement dans la partie Finance de VisualPro.
          </Text>
          <Text style={text}>
            <b>Comment renouveler :</b><br />
            1. Allez sur <a href="https://developers.facebook.com/tools/explorer/">Graph API Explorer</a> et générez un nouveau token avec la permission <code>ads_read</code>.<br />
            2. Ouvrez <a href="https://developers.facebook.com/tools/debug/accesstoken/">Access Token Debugger</a> et cliquez sur <b>« Extend Access Token »</b> pour obtenir un token de 60 jours.<br />
            3. Collez-le dans VisualPro &gt; Finance &gt; Comptes publicitaires.
          </Text>
          {manageUrl && (
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button href={manageUrl} style={button}>Mettre à jour mon token</Button>
            </Section>
          )}
          <Text style={footer}>VisualPro Cloud — Suivi automatique de vos dépenses publicitaires.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdTokenExpiringEmail,
  subject: (data: Record<string, any>) => {
    const d = Number(data?.daysRemaining ?? 7)
    return d <= 0
      ? '⚠️ Votre token Meta Ads a expiré — renouvelez-le maintenant'
      : `⚠️ Votre token Meta Ads expire dans ${d} jour${d > 1 ? 's' : ''}`
  },
  displayName: 'Token publicitaire expirant',
  previewData: { shopName: 'Ma Boutique', accountLabel: 'Compte principal', daysRemaining: 7, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), manageUrl: 'https://visuelpro.cloud/shop-manager' },
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
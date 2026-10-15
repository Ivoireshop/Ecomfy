import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Ecomfy'

interface Props {
  merchantName?: string
  amount?: number
  netAmount?: number
  reference?: string
  paymentMethod?: string
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(Number(n) || 0)))

const OrderPaymentSuccessEmail = ({
  merchantName = 'Marchand Ecomfy',
  amount = 0,
  netAmount,
  reference,
  paymentMethod,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Paiement reçu : {fmt(amount)} FCFA</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Paiement reçu 🎉</Heading>
        <Text style={text}>Bonjour {merchantName},</Text>
        <Text style={text}>
          Un client vient de régler <b>{fmt(amount)} FCFA</b> via {SITE_NAME} Pay.
          {netAmount != null && (
            <> Après frais, <b>{fmt(netAmount)} FCFA</b> ont été crédités sur votre portefeuille.</>
          )}
        </Text>
        {(reference || paymentMethod) && (
          <Text style={details}>
            {reference && <>Référence : <b>{reference}</b><br /></>}
            {paymentMethod && <>Moyen de paiement : {paymentMethod}</>}
          </Text>
        )}
        <Text style={footer}>Merci d'utiliser {SITE_NAME}.<br />L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderPaymentSuccessEmail,
  subject: (data: Record<string, any>) => `Paiement reçu : ${fmt(data?.amount)} FCFA`,
  displayName: 'Paiement client reçu (Ecomfy Pay)',
  previewData: {
    merchantName: 'Awa Boutique',
    amount: 15000,
    netAmount: 14500,
    reference: 'EP-20261015-0001',
    paymentMethod: 'Orange Money',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const details = {
  fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px',
  backgroundColor: '#f1f5f9', padding: '12px 16px', borderRadius: '8px',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }

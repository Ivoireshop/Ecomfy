import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  customerName?: string
  shopName?: string
  orderNumber?: string
  downloadUrl?: string
  productNames?: string[]
}

const DigitalOrderReadyEmail = ({
  customerName,
  shopName = 'la boutique',
  orderNumber,
  downloadUrl = '#',
  productNames = [],
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre achat chez {shopName} est prêt à être téléchargé</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre achat est prêt 📥</Heading>
        <Text style={text}>Bonjour{customerName ? ` ${customerName}` : ''},</Text>
        <Text style={text}>
          Votre paiement a bien été reçu par <b>{shopName}</b>
          {orderNumber ? <> (commande <b>{orderNumber}</b>)</> : null}.
          Vous pouvez télécharger {productNames.length > 1 ? 'vos fichiers' : 'votre fichier'} à tout moment avec le lien ci-dessous.
        </Text>
        {productNames.length > 0 && (
          <Text style={details}>
            {productNames.map((n, i) => <React.Fragment key={i}>{n}<br /></React.Fragment>)}
          </Text>
        )}
        <Button href={downloadUrl} style={button}>Télécharger mes fichiers</Button>
        <Text style={note}>
          Ce lien est personnel : ne le partagez pas. Conservez cet e-mail pour retélécharger vos fichiers plus tard.
          Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br />{downloadUrl}
        </Text>
        <Text style={footer}>Cet e-mail a été envoyé suite à votre achat chez {shopName}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DigitalOrderReadyEmail,
  subject: (data: Record<string, any>) => `Votre achat chez ${data?.shopName || 'la boutique'} est prêt à être téléchargé`,
  displayName: 'Produit numérique prêt (client)',
  previewData: {
    customerName: 'Awa',
    shopName: 'Awa Boutique',
    orderNumber: 'ORD-20261112-0001',
    downloadUrl: 'https://ecomfy.cloud/telechargement/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    productNames: ['Guide complet du e-commerce (PDF)'],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const details = {
  fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px',
  backgroundColor: '#f1f5f9', padding: '12px 16px', borderRadius: '8px',
}
const button = {
  backgroundColor: '#2563eb', color: '#ffffff', fontSize: '15px', fontWeight: 'bold',
  padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block',
}
const note = { fontSize: '12px', color: '#64748b', lineHeight: '1.6', margin: '24px 0 0', wordBreak: 'break-all' as const }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }

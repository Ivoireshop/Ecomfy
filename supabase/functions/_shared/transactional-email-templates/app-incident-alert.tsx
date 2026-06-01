import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Incident {
  title: string
  category: string
  severity: string
  description?: string
  occurrence_count?: number
}

interface Props {
  incidents?: Incident[]
  dashboardUrl?: string
  detectedAt?: string
}

const sevColor: Record<string, string> = {
  critical: '#dc2626',
  warning: '#d97706',
  info: '#0ea5e9',
}

const AppIncidentAlertEmail = ({
  incidents = [],
  dashboardUrl = 'https://visuelpro.cloud/founder-troubleshooting',
  detectedAt,
}: Props) => {
  const when = detectedAt ? new Date(detectedAt).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR')
  const top = incidents[0]
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>VisualPro — {incidents.length} incident{incidents.length > 1 ? 's' : ''} détecté{incidents.length > 1 ? 's' : ''}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🚨 Alerte santé VisualPro</Heading>
          <Text style={text}>
            Le monitoring automatique a détecté <b>{incidents.length} nouvel{incidents.length > 1 ? 's' : ''} incident{incidents.length > 1 ? 's' : ''}</b> sur l'application le {when}.
          </Text>
          {top && (
            <Section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, margin: '16px 0' }}>
              <Text style={{ ...text, margin: 0, color: sevColor[top.severity] || '#0f172a', fontWeight: 700 }}>
                {top.severity.toUpperCase()} — {top.title}
              </Text>
              {top.description && <Text style={{ ...text, margin: '8px 0 0' }}>{top.description}</Text>}
              <Text style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>Catégorie : {top.category}</Text>
            </Section>
          )}
          {incidents.length > 1 && (
            <Text style={text}>
              <b>Autres incidents :</b>
              <br />
              {incidents.slice(1).map((i, idx) => (
                <span key={idx}>• [{i.severity}] {i.title}<br /></span>
              ))}
            </Text>
          )}
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={dashboardUrl} style={button}>Ouvrir le centre de dépannage</Button>
          </Section>
          <Text style={footer}>
            Vous recevez ce mail car vous êtes fondateur de VisualPro. Connectez-vous pour résoudre ou ignorer les incidents.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AppIncidentAlertEmail,
  subject: (data: Record<string, any>) => {
    const n = Array.isArray(data?.incidents) ? data.incidents.length : 1
    const top = data?.incidents?.[0]
    const sev = top?.severity === 'critical' ? '🚨 CRITIQUE' : top?.severity === 'warning' ? '⚠️' : 'ℹ️'
    return `${sev} VisualPro — ${n} incident${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}`
  },
  displayName: 'Alerte incident application',
  previewData: {
    detectedAt: new Date().toISOString(),
    dashboardUrl: 'https://visuelpro.cloud/founder-troubleshooting',
    incidents: [
      { title: 'Aucune commande payée depuis 24h', category: 'commerce', severity: 'warning', description: 'Le trafic publicitaire continue mais aucun paiement validé.', occurrence_count: 3 },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }
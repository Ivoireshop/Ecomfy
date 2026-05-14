import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'VisualPro Cloud'

interface Props {
  shopName?: string
  periodLabel?: string
  ordersCount?: number
  deliveredCount?: number
  revenue?: string
  cashIn?: string
  totalExpenses?: string
  expByCat?: { label: string; amount: string }[]
  platformFees?: string
  commissionDue?: string
  profit?: string
  profitPositive?: boolean
  shopUrl?: string
}

const FinanceSummary = ({
  shopName = 'Votre boutique',
  periodLabel = '7 derniers jours',
  ordersCount = 0,
  deliveredCount = 0,
  revenue = '0',
  cashIn = '0',
  totalExpenses = '0',
  expByCat = [],
  platformFees = '0',
  commissionDue = '0',
  profit = '0',
  profitPositive = true,
  shopUrl,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{`Résumé financier — ${shopName} (${periodLabel})`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📊 Résumé financier hebdomadaire</Heading>
        <Text style={subtitle}>{shopName} — {periodLabel}</Text>

        <Section style={kpiRow}>
          <Kpi label="Encaissé" value={`${cashIn} FCFA`} accent="#10b981" />
          <Kpi label="CA confirmé" value={`${revenue} FCFA`} accent="#3b82f6" />
        </Section>
        <Section style={kpiRow}>
          <Kpi label="Dépenses" value={`${totalExpenses} FCFA`} accent="#ec4899" />
          <Kpi label="Bénéfice net" value={`${profit} FCFA`} accent={profitPositive ? '#16a34a' : '#dc2626'} />
        </Section>

        <Hr style={hr} />

        <Heading as="h2" style={h2}>📦 Commandes</Heading>
        <Text style={text}>Total : <b>{ordersCount}</b> — Livrées : <b>{deliveredCount}</b></Text>

        {expByCat.length > 0 && (
          <>
            <Heading as="h2" style={h2}>💸 Dépenses par catégorie</Heading>
            {expByCat.map((c, i) => (
              <Text key={i} style={lineItem}>• {c.label} : <b>{c.amount} FCFA</b></Text>
            ))}
          </>
        )}

        <Heading as="h2" style={h2}>🏦 Frais plateforme VisualPro</Heading>
        <Text style={text}>Déjà payés : <b>{platformFees} FCFA</b></Text>
        <Text style={text}>Commission due : <b style={{ color: '#ea580c' }}>{commissionDue} FCFA</b></Text>

        {shopUrl && (
          <Text style={text}>
            <a href={shopUrl} style={link}>Voir le tableau de bord complet →</a>
          </Text>
        )}

        <Hr style={hr} />
        <Text style={footer}>Envoyé automatiquement chaque semaine par {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

const Kpi = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <div style={{ display: 'inline-block', width: '48%', padding: '12px', borderRadius: '8px', background: '#f8fafc', borderLeft: `4px solid ${accent}`, marginBottom: '8px' }}>
    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
  </div>
)

export const template = {
  component: FinanceSummary,
  subject: (d: Record<string, any>) => `📊 Résumé financier — ${d.shopName || 'Votre boutique'}`,
  displayName: 'Résumé financier hebdomadaire',
  previewData: {
    shopName: 'Ma Boutique',
    periodLabel: '7 derniers jours',
    ordersCount: 12, deliveredCount: 8,
    revenue: '350 000', cashIn: '240 000',
    totalExpenses: '85 000',
    expByCat: [{ label: 'Publicité', amount: '60 000' }, { label: 'Achat de stock', amount: '25 000' }],
    platformFees: '12 000', commissionDue: '6 000',
    profit: '143 000', profitPositive: true,
    shopUrl: 'https://visuelpro.cloud',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }
const subtitle = { fontSize: '13px', color: '#64748b', margin: '0 0 18px' }
const h2 = { fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '18px 0 8px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 6px' }
const lineItem = { fontSize: '13px', color: '#334155', margin: '2px 0' }
const kpiRow = { margin: '0 0 6px', display: 'block' }
const hr = { borderColor: '#e2e8f0', margin: '20px 0' }
const link = { color: '#2563eb', textDecoration: 'none', fontWeight: 600 }
const footer = { fontSize: '11px', color: '#94a3b8', textAlign: 'center' as const, margin: '20px 0 0' }
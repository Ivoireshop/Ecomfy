import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { APP_URL } from "../email-sender.ts";

const SITE_NAME = 'Ecomfy'

const ROLE_LABELS: Record<string, string> = {
  co_founder: 'Co-fondateur',
  shareholder: 'Actionnaire',
  admin: 'Administrateur',
}

interface Props {
  role?: string
  inviterName?: string
  loginUrl?: string
}

const FounderTeamInviteEmail = ({
  role = 'co_founder',
  inviterName = 'Ulrich DJATÉ',
  loginUrl,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vous rejoignez l'équipe dirigeante {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Félicitations !</Heading>
        <Text style={text}>
          {inviterName} (Fondateur Principal) vous a nommé en tant que{' '}
          <b>{ROLE_LABELS[role] || role}</b> sur la plateforme {SITE_NAME}.
        </Text>
        <Text style={text}>
          Vous pouvez maintenant vous connecter à votre compte et consulter la Console de
          Pilotage Fondateur.
        </Text>
        {loginUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={loginUrl} style={button}>
              Accéder à la console
            </Button>
          </Section>
        )}
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FounderTeamInviteEmail,
  subject: "Invitation à l'Équipe Dirigeante Ecomfy",
  displayName: "Invitation équipe dirigeante",
  previewData: { role: 'co_founder', inviterName: 'Ulrich DJATÉ', loginUrl: `${APP_URL}/auth` },
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

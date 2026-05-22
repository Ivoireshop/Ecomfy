/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirmez votre adresse e-mail pour VisuelPro</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>VisuelPro</Text>
        <Heading style={h1}>Confirmez votre e-mail</Heading>
        <Text style={text}>
          Bienvenue sur{' '}
          <Link href={siteUrl} style={link}>
            <strong>VisuelPro</strong>
          </Link>{' '}! Confirmez votre adresse{' '}
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
          pour activer votre compte et commencer à créer.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmer mon e-mail
        </Button>
        <Text style={footer}>
          Si vous n'avez pas créé de compte, ignorez simplement cet e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: 'hsl(214, 100%, 50%)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  margin: '0 0 24px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(220, 13%, 13%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(220, 9%, 46%)',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: 'hsl(214, 100%, 50%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(214, 100%, 50%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: 'hsl(220, 9%, 60%)', margin: '32px 0 0', lineHeight: '1.5' }

/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as financeWeeklySummary } from './finance-weekly-summary.tsx'
import { template as shopActivation } from './shop-activation.tsx'
import { template as adTokenExpiring } from './ad-token-expiring.tsx'
import { template as shopCollaboratorInvite } from './shop-collaborator-invite.tsx'
import { template as appIncidentAlert } from './app-incident-alert.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'finance-weekly-summary': financeWeeklySummary,
  'shop-activation': shopActivation,
  'ad-token-expiring': adTokenExpiring,
  'shop-collaborator-invite': shopCollaboratorInvite,
  'app-incident-alert': appIncidentAlert,
}
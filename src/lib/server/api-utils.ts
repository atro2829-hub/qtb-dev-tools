import type { BankAccount, Notification, SiteConfig, SubscriptionRequest, ToolJob } from '@prisma/client'

/* ------------------------------------------------------------------ */
/* Config serialization                                                */
/* ------------------------------------------------------------------ */

export interface PublicConfig {
  organization: string
  devName: string
  devEmail: string
  supportEmail: string
  logoUrl: string
  freeTrialEnabled: boolean
  announcement: string
}

export function toPublicConfig(cfg: SiteConfig | null): PublicConfig {
  return {
    organization: cfg?.organization ?? 'QTB DEV',
    devName: cfg?.devName ?? 'Mohammed AL-QUTAIBI',
    devEmail: cfg?.devEmail ?? 'dev@qutaibiv.com',
    supportEmail: cfg?.supportEmail ?? 'info@qutaibiv.com',
    logoUrl: cfg?.logoUrl ?? '',
    freeTrialEnabled: cfg?.freeTrialEnabled ?? true,
    announcement: cfg?.announcement ?? '',
  }
}

export interface FullConfig extends PublicConfig {
  id: string
  geminiApiKey: string
  agentApiKey: string
  admobAppId: string
  admobBannerId: string
  adsenseClientId: string
  adsenseSlotId: string
  freeTrialDays: number
  updatedAt: string
}

export function toFullConfig(cfg: SiteConfig | null): FullConfig {
  return {
    ...toPublicConfig(cfg),
    id: cfg?.id ?? 'main',
    geminiApiKey: cfg?.geminiApiKey ?? '',
    agentApiKey: cfg?.agentApiKey ?? '',
    admobAppId: cfg?.admobAppId ?? '',
    admobBannerId: cfg?.admobBannerId ?? '',
    adsenseClientId: cfg?.adsenseClientId ?? '',
    adsenseSlotId: cfg?.adsenseSlotId ?? '',
    freeTrialDays: cfg?.freeTrialDays ?? 365,
    updatedAt: (cfg?.updatedAt ?? new Date()).toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* JSON-safe serializers                                               */
/* ------------------------------------------------------------------ */

export interface JsonNotification {
  id: string
  title: string
  message: string
  type: string
  audience: string
  createdAt: string
}

export function toNotificationJson(n: Notification): JsonNotification {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    audience: n.audience,
    createdAt: n.createdAt.toISOString(),
  }
}

export function toBankJson(b: BankAccount): Record<string, unknown> {
  return {
    id: b.id,
    bankName: b.bankName,
    accountName: b.accountName,
    accountNumber: b.accountNumber,
    iban: b.iban,
    swiftCode: b.swiftCode,
    currency: b.currency,
    instructions: b.instructions,
    iconSvg: b.iconSvg,
    active: b.active,
    createdAt: b.createdAt.toISOString(),
  }
}

export function toToolJobJson(j: ToolJob): Record<string, unknown> {
  return {
    id: j.id,
    toolType: j.toolType,
    fileName: j.fileName,
    sourceFormat: j.sourceFormat,
    targetFormat: j.targetFormat,
    status: j.status,
    detail: j.detail,
    createdAt: j.createdAt.toISOString(),
  }
}

export function toRequestJson(r: SubscriptionRequest): Record<string, unknown> {
  return {
    id: r.id,
    userId: r.userId,
    plan: r.plan,
    bankAccountId: r.bankAccountId,
    bankName: r.bankName,
    amount: r.amount,
    currency: r.currency,
    paymentReference: r.paymentReference,
    proofFileName: r.proofFileName,
    note: r.note,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* Multipart helpers                                                   */
/* ------------------------------------------------------------------ */

export function getFormString(form: FormData, key: string): string {
  const value = form.get(key)
  if (typeof value === 'string') return value.trim()
  return ''
}

/** Returns the field as a File when present and actually a file-ish blob. */
export function getFormFile(form: FormData, key: string): File | null {
  const value = form.get(key)
  if (value instanceof File && value.size > 0) return value
  return null
}

/* ------------------------------------------------------------------ */
/* Misc                                                               */
/* ------------------------------------------------------------------ */

export function clampString(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 })
}

export function serverError(message = 'Internal server error'): Response {
  return Response.json({ error: message }, { status: 500 })
}

export function notFound(message = 'Not found'): Response {
  return Response.json({ error: message }, { status: 404 })
}

/**
 * Shared utilities for preview subdomain handling
 */

import { DOMAINS } from "@webalive/shared"

const PREVIEW_BASE = DOMAINS.PREVIEW_BASE

/**
 * Convert workspace domain to preview subdomain label
 *
 * @example
 * domainToPreviewLabel("protino.alive.best") // "protino-alive-best"
 * domainToPreviewLabel("demo.goalive.nl") // "demo-goalive-nl"
 */
export function domainToPreviewLabel(domain: string): string {
  return domain.replace(/\./g, "-")
}

/**
 * Convert workspace domain to full preview URL
 *
 * @example
 * getPreviewUrl("protino.alive.best") // "https://protino-alive-best.preview.terminal.goalive.nl/"
 */
export function getPreviewUrl(workspace: string): string {
  const label = domainToPreviewLabel(workspace)
  return `https://${label}.${PREVIEW_BASE}/`
}

/**
 * Convert preview label back to domain
 *
 * @example
 * previewLabelToDomain("protino-alive-best") // "protino.alive.best"
 */
export function previewLabelToDomain(label: string): string {
  return label.replace(/-/g, ".")
}

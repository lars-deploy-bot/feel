/**
 * Workspace URL utilities for the browser.
 *
 * Pure preview logic (domainToPreviewLabel, buildPreviewUrl) lives in @webalive/shared.
 * This file adds browser-specific wrappers that bind to env.NEXT_PUBLIC_PREVIEW_BASE.
 */

import { env } from "@webalive/env/client"
import { buildPreviewUrl, domainToPreviewLabel, PREVIEW_PREFIX } from "@webalive/shared"

/** The wildcard domain (e.g., "sonno.tech" or "alive.best") */
const WILDCARD_DOMAIN = env.NEXT_PUBLIC_PREVIEW_BASE

// Re-export pure functions for existing importers
export { domainToPreviewLabel }

/**
 * Convert preview label back to domain
 *
 * @example
 * previewLabelToDomain("protino-sonno-tech") // "protino.sonno.tech"
 */
export function previewLabelToDomain(label: string): string {
  return label.replace(/-/g, ".")
}

/**
 * Check if a hostname is a preview subdomain.
 */
export function isPreviewHost(host: string): boolean {
  return host.startsWith(PREVIEW_PREFIX)
}

/**
 * Extract the workspace domain from a preview hostname
 */
export function extractWorkspaceFromPreviewHost(host: string): string | null {
  if (!host.startsWith(PREVIEW_PREFIX)) {
    return null
  }

  const rest = host.slice(PREVIEW_PREFIX.length)
  const suffix = `.${WILDCARD_DOMAIN}`
  if (!rest.endsWith(suffix)) {
    return null
  }

  const label = rest.slice(0, -suffix.length)
  if (!label) {
    return null
  }

  return previewLabelToDomain(label)
}

/**
 * Get the actual site URL (production)
 */
export function getSiteUrl(workspace: string, path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `https://${workspace}${normalizedPath}`
}

/**
 * Get the preview URL (for iframe embedding with auth bypass).
 * Binds to WILDCARD_DOMAIN from env. For Node/server code, use buildPreviewUrl() directly.
 */
export function getPreviewUrl(workspace: string, options?: { path?: string; token?: string }): string {
  const base = buildPreviewUrl(workspace, WILDCARD_DOMAIN, options?.path)
  if (!options?.token) return base
  const url = new URL(base)
  url.searchParams.set("preview_token", options.token)
  return url.toString()
}

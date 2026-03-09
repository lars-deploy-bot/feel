/**
 * Server Config Zod Schema — SINGLE SOURCE OF TRUTH
 *
 * Validates /var/lib/alive/server-config.json at parse time.
 * One schema, one type, one parse function. Unknown keys cause errors.
 *
 * Production shape verified against both servers (alive.best, sonno.tech).
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Reusable validators
// ---------------------------------------------------------------------------

const pathStr = z.string().min(1)
const domainStr = z.string().regex(/^[a-z0-9.*-]+$/i)
const hostnameStr = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i,
    "sentry.host must be a bare hostname (e.g. sentry.example.com)",
  )

const sentrySchema = z
  .object({
    dsn: z.string().url(),
    url: z.string().url().optional(),
    projectId: z.string().min(1).optional(),
    // Legacy fields still present in some deployed server-config.json files.
    host: hostnameStr.optional(),
    org: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
  })
  .strict()
  .transform((sentry, ctx) => {
    const url = sentry.url ?? (sentry.host ? `https://${sentry.host}` : undefined)
    const projectId = sentry.projectId ?? extractProjectIdFromDsn(sentry.dsn)

    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sentry.url is required (or provide legacy sentry.host)",
      })
    }

    if (!projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sentry.projectId is required (or include it in sentry.dsn path)",
      })
    }

    if (!url || !projectId) {
      return z.NEVER
    }

    return {
      dsn: sentry.dsn,
      url,
      projectId,
      org: sentry.org,
      project: sentry.project,
    }
  })

const wildcardOriginCertSchema = z
  .object({
    certFile: pathStr,
    keyFile: pathStr,
  })
  .strict()

const tlsSchema = z
  .object({
    wildcardOriginCert: wildcardOriginCertSchema,
  })
  .strict()

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const serverConfigSchema = z
  .object({
    serverId: z.string().regex(/^srv_.{6,}$/),
    serverIp: z.string().regex(/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/),
    serverIpv6: z.string().min(1),
    automationPrimary: z.boolean(),

    paths: z
      .object({
        aliveRoot: pathStr,
        sitesRoot: pathStr,
        templatesRoot: pathStr,
        imagesStorage: pathStr,
        e2bScratchRoot: pathStr.optional(),
      })
      .strict(),

    domains: z
      .object({
        main: domainStr,
        wildcard: domainStr,
        cookieDomain: z.string().min(1),
        previewBase: domainStr,
        frameAncestors: z.array(z.string().min(1)),
      })
      .strict(),

    tls: tlsSchema.optional(),

    urls: z
      .object({
        prod: z.string().url(),
        staging: z.string().url(),
        dev: z.string().url(),
      })
      .strict(),

    shell: z
      .object({
        domains: z.array(domainStr),
        listen: z.string().min(1),
        upstream: z.string().min(1),
        e2bUpstream: z.string().min(1).optional(),
      })
      .strict(),

    sentry: sentrySchema,

    contactEmail: z.string().email(),

    previewProxy: z
      .object({
        port: z.number().int().min(1).max(65535),
      })
      .strict(),

    generated: z
      .object({
        dir: pathStr,
        caddySites: pathStr,
        caddyShell: pathStr,
        nginxMap: pathStr,
      })
      .strict(),
  })
  .strict()

// ---------------------------------------------------------------------------
// Derived type
// ---------------------------------------------------------------------------

export type ServerConfig = z.infer<typeof serverConfigSchema>

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Strip `_comment` keys recursively. The example file uses them for
 * documentation, but they must not reach the strict schema.
 */
function stripCommentKeys(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return
  if (Array.isArray(obj)) {
    for (const item of obj) stripCommentKeys(item)
    return
  }
  const record = obj as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (key === "_comment") {
      delete record[key]
    } else {
      stripCommentKeys(record[key])
    }
  }
}

/**
 * Parse and validate raw JSON string as ServerConfig.
 * Throws an Error on malformed JSON, or a ZodError on schema validation failure.
 */
export function parseServerConfig(raw: string): ServerConfig {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (e) {
    throw new Error(`Invalid JSON in server config: ${e instanceof Error ? e.message : String(e)}`)
  }
  stripCommentKeys(data)
  rejectRemovedKeys(data)
  return serverConfigSchema.parse(data)
}

/**
 * Reject known removed keys with actionable error messages.
 * Crashes on startup so operators fix config immediately.
 */
function rejectRemovedKeys(obj: unknown): void {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return
  const record = obj as Record<string, unknown>

  if ("templates" in record) {
    throw new Error(
      'server-config.json contains removed key "templates". ' +
        "Template paths are now resolved dynamically from paths.templatesRoot + the template directory name. " +
        'Remove the "templates" object from server-config.json. ' +
        'Ensure "paths.templatesRoot" points to your templates directory (e.g. "/srv/webalive/templates").',
    )
  }
}

function extractProjectIdFromDsn(dsn: string): string {
  try {
    const pathname = new URL(dsn).pathname.replace(/^\/+/, "").trim()
    return pathname
  } catch {
    return ""
  }
}

import type { env } from "../../config/env"

// ---------------------------------------------------------------------------
// Environment mapping
// ---------------------------------------------------------------------------

type PolarEnv = "sandbox" | "production"

function resolveEnv(aliveEnv: typeof env.ALIVE_ENV): PolarEnv {
  return aliveEnv === "production" ? "production" : "sandbox"
}

// ---------------------------------------------------------------------------
// Domain → Environment mapping
//
// Each domain hits ONE Polar environment. Only one webhook URL per Polar
// environment to avoid double-processing (e.g. double credit awards).
//
//   Domain                  ALIVE_ENV     Polar env     Server
//   ──────────────────────  ────────────  ────────────  ────────
//   app.alive.best          production    production    Server 1
//   staging.alive.best      staging       sandbox       Server 1
//   staging.sonno.tech      staging       sandbox       Server 2
//   dev.sonno.tech          dev           sandbox       Server 2
//
// Webhook receives:
//   sandbox    → staging.sonno.tech  (Server 2 is the primary staging receiver)
//   production → app.alive.best      (Server 1 is production)
//
// staging.alive.best does NOT receive webhooks — Server 2 is the single
// staging webhook target. This prevents double credit awards.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Products — must have IDs for BOTH environments (prevents drift)
// ---------------------------------------------------------------------------

interface PolarProduct {
  sandbox: string
  production: string
  credits: number
  label: string
}

const PRODUCTS = {
  CREDIT_TOPUP_100: {
    sandbox: "19394fe4-33c6-4508-a826-12a147befc16",
    production: "31597423-2715-45ed-b695-55cd4821bba0",
    credits: 100,
    label: "100 Credits",
  },
  WEB_SUITE: {
    sandbox: "47eb59dd-4abc-4874-801c-f58b5aedf8f6",
    production: "2171ea62-42b1-4df9-b8d3-e620b28f1360",
    credits: 0,
    label: "Web Suite",
  },
} as const satisfies Record<string, PolarProduct>

// ---------------------------------------------------------------------------
// Webhook endpoints — must have config for BOTH environments (prevents drift)
// ---------------------------------------------------------------------------

interface PolarWebhook {
  sandbox: { id: string; url: string }
  production: { id: string; url: string }
  events: readonly string[]
}

const WEBHOOK_ENDPOINT = {
  sandbox: {
    id: "152c00c7-bb12-41ff-bc6f-9a04cc3fa80c",
    url: "https://staging.sonno.tech/api/polar/webhook",
  },
  production: {
    id: "43cbb28e-a742-4b5d-8f73-dc3542396cfa",
    url: "https://app.alive.best/api/polar/webhook",
  },
  events: ["order.paid", "subscription.active", "subscription.canceled", "subscription.revoked"],
} as const satisfies PolarWebhook

// ---------------------------------------------------------------------------
// Startup validation — crash immediately if anything is misconfigured
// ---------------------------------------------------------------------------

function validate(): void {
  const errors: string[] = []

  // Products: all IDs must be non-empty
  for (const [name, product] of Object.entries(PRODUCTS)) {
    if (!product.sandbox) errors.push(`Product ${name}: missing sandbox ID`)
    if (!product.production) errors.push(`Product ${name}: missing production ID`)
  }

  // Webhooks: both environments must have ID + URL
  if (!WEBHOOK_ENDPOINT.sandbox.id) errors.push("Webhook: missing sandbox endpoint ID")
  if (!WEBHOOK_ENDPOINT.sandbox.url) errors.push("Webhook: missing sandbox endpoint URL")
  if (!WEBHOOK_ENDPOINT.production.id) errors.push("Webhook: missing production endpoint ID")
  if (!WEBHOOK_ENDPOINT.production.url) errors.push("Webhook: missing production endpoint URL")
  if (errors.length > 0) {
    throw new Error(`[Polar] Configuration is incomplete:\n  ${errors.join("\n  ")}`)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get the product ID → credit mapping for the current environment. */
export function getPolarProducts(aliveEnv: typeof env.ALIVE_ENV): Record<string, { credits: number; label: string }> {
  const polarEnv = resolveEnv(aliveEnv)
  const result: Record<string, { credits: number; label: string }> = {}

  for (const product of Object.values(PRODUCTS)) {
    result[product[polarEnv]] = { credits: product.credits, label: product.label }
  }

  return result
}

/** Get a specific product's ID for the current environment. */
export function getProductId(name: keyof typeof PRODUCTS, aliveEnv: typeof env.ALIVE_ENV): string {
  return PRODUCTS[name][resolveEnv(aliveEnv)]
}

/** Get the webhook endpoint config for the current environment. */
export function getWebhookEndpoint(aliveEnv: typeof env.ALIVE_ENV): { id: string; url: string } {
  return WEBHOOK_ENDPOINT[resolveEnv(aliveEnv)]
}

/** 1 USD = 10 credits (matches existing conversion rate) */
export const USD_TO_CREDITS = 10

// Fail fast at module load
validate()

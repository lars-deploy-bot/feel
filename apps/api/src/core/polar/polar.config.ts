import type { env } from "../../config/env"

/**
 * Each product must have IDs for BOTH environments.
 * This prevents product drift — you can't add a sandbox product
 * without also adding the production counterpart (and vice versa).
 *
 * Empty strings are caught at startup by validatePolarProducts().
 */
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

type PolarEnv = "sandbox" | "production"

function resolveEnv(aliveEnv: typeof env.ALIVE_ENV): PolarEnv {
  return aliveEnv === "production" ? "production" : "sandbox"
}

/**
 * Validate all products have non-empty IDs for both environments.
 * Call at startup — crashes immediately if any product is misconfigured.
 */
export function validatePolarProducts(): void {
  const errors: string[] = []

  for (const [name, product] of Object.entries(PRODUCTS)) {
    if (!product.sandbox) {
      errors.push(`${name}: missing sandbox product ID`)
    }
    if (!product.production) {
      errors.push(`${name}: missing production product ID`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`[Polar] Product configuration is incomplete:\n  ${errors.join("\n  ")}`)
  }
}

/**
 * Get the product ID → credit mapping for the current environment.
 */
export function getPolarProducts(aliveEnv: typeof env.ALIVE_ENV): Record<string, { credits: number; label: string }> {
  const polarEnv = resolveEnv(aliveEnv)
  const result: Record<string, { credits: number; label: string }> = {}

  for (const product of Object.values(PRODUCTS)) {
    result[product[polarEnv]] = { credits: product.credits, label: product.label }
  }

  return result
}

/**
 * Get a specific product's ID for the current environment.
 */
export function getProductId(name: keyof typeof PRODUCTS, aliveEnv: typeof env.ALIVE_ENV): string {
  const polarEnv = resolveEnv(aliveEnv)
  return PRODUCTS[name][polarEnv]
}

/** 1 USD = 10 credits (matches existing conversion rate) */
export const USD_TO_CREDITS = 10

// Fail fast at module load — if product IDs are missing, crash immediately
validatePolarProducts()

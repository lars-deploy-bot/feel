import type { env } from "../../config/env"

/**
 * Each product must have IDs for BOTH environments.
 * This prevents product drift — you can't add a sandbox product
 * without also adding the production counterpart (and vice versa).
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
 * Get the product ID → credit mapping for the current environment.
 * Builds the map at runtime from the dual-environment product definitions.
 */
export function getPolarProducts(aliveEnv: typeof env.ALIVE_ENV): Record<string, { credits: number; label: string }> {
  const polarEnv = resolveEnv(aliveEnv)
  const result: Record<string, { credits: number; label: string }> = {}

  for (const product of Object.values(PRODUCTS)) {
    const id = product[polarEnv]
    if (id) {
      result[id] = { credits: product.credits, label: product.label }
    }
  }

  return result
}

/**
 * Get a specific product's ID for the current environment.
 */
export function getProductId(name: keyof typeof PRODUCTS, aliveEnv: typeof env.ALIVE_ENV): string {
  const polarEnv = resolveEnv(aliveEnv)
  const id = PRODUCTS[name][polarEnv]
  if (!id) {
    throw new Error(`Polar product ${name} has no ${polarEnv} ID configured`)
  }
  return id
}

/** 1 USD = 10 credits (matches existing conversion rate) */
export const USD_TO_CREDITS = 10

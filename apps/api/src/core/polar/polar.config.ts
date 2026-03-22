/**
 * Polar product → credit mapping.
 *
 * When a product is purchased, we award the corresponding number of credits
 * to the buyer's organization. Product IDs come from the Polar dashboard.
 *
 * Update these after creating products in the Polar sandbox/production dashboard.
 */
export const POLAR_PRODUCTS: Record<string, { credits: number; label: string }> = {
  "31597423-2715-45ed-b695-55cd4821bba0": { credits: 100, label: "100 Credits" },
}

/** 1 USD = 10 credits (matches existing conversion rate) */
export const USD_TO_CREDITS = 10

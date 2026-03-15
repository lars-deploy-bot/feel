/**
 * Settings UI styles — warm, alive palette
 *
 * Inspired by natural materials: washi paper, unglazed clay, moss on stone.
 * Colors are hand-picked, not from any Tailwind scale.
 *
 * Light backgrounds sit on #faf8f5 (kinari, unbleached cloth).
 * Dark backgrounds sit on #141311 (sumi, warm charcoal).
 *
 * The green tint (#4a7c59 / emerald-ish) is "alive" — used at very low
 * opacity for fills and borders. You feel it more than see it.
 */

// =============================================================================
// INTERACTIVE ELEMENTS
// =============================================================================

/** Icon button (close, action icons) */
export const iconButton = `
  inline-flex items-center justify-center size-9 rounded-xl
  text-[#8a8578] dark:text-[#7a756b]
  hover:text-[#5c574d] dark:hover:text-[#b5af a3]
  bg-[#4a7c59]/[0.04] dark:bg-[#7cb88a]/[0.04]
  hover:bg-[#4a7c59]/[0.08] dark:hover:bg-[#7cb88a]/[0.08]
  active:bg-[#4a7c59]/[0.12] dark:active:bg-[#7cb88a]/[0.12]
  active:scale-95 transition-all duration-150
`
  .replace(/\s+/g, " ")
  .trim()

/** Primary button (save, submit) */
export const primaryButton = `
  inline-flex items-center justify-center h-10 px-4
  bg-[#2c2a26] dark:bg-[#e8e4dc] text-[#faf8f5] dark:text-[#1a1816]
  text-sm font-medium rounded-xl
  hover:bg-[#3d3a34] dark:hover:bg-[#d4d0c8]
  active:scale-[0.98] transition-all duration-150
  disabled:opacity-30
`
  .replace(/\s+/g, " ")
  .trim()

/** Secondary button (clear, cancel) */
export const secondaryButton = `
  inline-flex items-center justify-center h-10 px-4
  bg-[#4a7c59]/[0.06] dark:bg-[#7cb88a]/[0.06] text-[#5c574d] dark:text-[#b5afa3]
  text-sm font-medium rounded-xl
  hover:bg-[#4a7c59]/[0.10] dark:hover:bg-[#7cb88a]/[0.10]
  active:bg-[#4a7c59]/[0.14] dark:active:bg-[#7cb88a]/[0.14]
  active:scale-[0.98] transition-all duration-150
`
  .replace(/\s+/g, " ")
  .trim()

/** Danger button (delete, logout) */
export const dangerButton = `
  inline-flex items-center justify-center h-10 px-4
  bg-red-500/10 dark:bg-red-500/10 text-red-600 dark:text-red-400
  text-sm font-medium rounded-xl
  hover:bg-red-500/15 dark:hover:bg-red-500/15
  active:bg-red-500/20 dark:active:bg-red-500/20
  active:scale-[0.98] transition-all duration-150
`
  .replace(/\s+/g, " ")
  .trim()

/** Small button (inline actions like "Get more") */
export const smallButton = `
  inline-flex items-center justify-center h-8 px-3
  bg-[#4a7c59]/[0.06] dark:bg-[#7cb88a]/[0.06] text-[#6b6560] dark:text-[#9a958c]
  text-xs font-medium rounded-lg
  hover:bg-[#4a7c59]/[0.10] dark:hover:bg-[#7cb88a]/[0.10]
  hover:text-[#3d3a34] dark:hover:text-[#d4d0c8]
  active:bg-[#4a7c59]/[0.14] dark:active:bg-[#7cb88a]/[0.14]
  active:scale-95 transition-all duration-150
  disabled:opacity-30
`
  .replace(/\s+/g, " ")
  .trim()

// =============================================================================
// FORM ELEMENTS
// =============================================================================

/** Text input / textarea */
export const input = `
  w-full px-4 py-2.5
  bg-white/50 dark:bg-white/[0.03]
  border border-[#4a7c59]/[0.12] dark:border-[#7cb88a]/[0.08]
  rounded-xl text-sm text-[#2c2a26] dark:text-[#e8e4dc]
  placeholder:text-[#b5afa3] dark:placeholder:text-[#5c574d]
  focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/[0.12] dark:focus:ring-[#7cb88a]/[0.10]
  focus:border-[#4a7c59]/[0.20] dark:focus:border-[#7cb88a]/[0.18]
  transition-all duration-150
`
  .replace(/\s+/g, " ")
  .trim()

/** Select dropdown */
export const select = `
  w-full px-4 py-2.5
  bg-white/50 dark:bg-white/[0.03]
  border border-[#4a7c59]/[0.12] dark:border-[#7cb88a]/[0.08]
  rounded-xl text-sm text-[#2c2a26] dark:text-[#e8e4dc]
  focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/[0.12] dark:focus:ring-[#7cb88a]/[0.10]
  focus:border-[#4a7c59]/[0.20] dark:focus:border-[#7cb88a]/[0.18]
  transition-all duration-150
  disabled:opacity-40 disabled:cursor-not-allowed
`
  .replace(/\s+/g, " ")
  .trim()

/** Read-only display field */
export const readOnlyField = `
  w-full px-4 py-2.5
  bg-[#4a7c59]/[0.03] dark:bg-[#7cb88a]/[0.03]
  border border-[#4a7c59]/[0.08] dark:border-[#7cb88a]/[0.06]
  rounded-xl text-sm text-[#5c574d] dark:text-[#b5afa3]
`
  .replace(/\s+/g, " ")
  .trim()

// =============================================================================
// CONTAINERS & CARDS
// =============================================================================

/** Info card (tips, notices) */
export const infoCard = `
  p-4 rounded-xl
  bg-[#4a7c59]/[0.03] dark:bg-[#7cb88a]/[0.03]
  border border-[#4a7c59]/[0.08] dark:border-[#7cb88a]/[0.06]
`
  .replace(/\s+/g, " ")
  .trim()

/** Warning card (low credits, etc) */
export const warningCard = `
  p-4 rounded-xl
  bg-amber-500/5 dark:bg-amber-500/5
  border border-amber-500/20 dark:border-amber-500/20
`
  .replace(/\s+/g, " ")
  .trim()

/** Section divider — faint green-tinted line */
export const sectionDivider = `
  pt-5 mt-5 border-t border-[#4a7c59]/[0.08] dark:border-[#7cb88a]/[0.06]
`
  .replace(/\s+/g, " ")
  .trim()

// =============================================================================
// SELECTION CARDS (theme picker, etc)
// =============================================================================

/** Selection card - base */
export const selectionCardBase = `
  flex flex-col items-center justify-center gap-2 p-4
  min-h-[88px] rounded-xl
  border transition-all duration-150 active:scale-[0.98]
`
  .replace(/\s+/g, " ")
  .trim()

/** Selection card - inactive */
export const selectionCardInactive = `
  ${selectionCardBase}
  bg-white/30 dark:bg-white/[0.02]
  border-[#4a7c59]/[0.08] dark:border-[#7cb88a]/[0.06]
  hover:bg-white/60 dark:hover:bg-white/[0.04]
  hover:border-[#4a7c59]/[0.16] dark:hover:border-[#7cb88a]/[0.12]
`
  .replace(/\s+/g, " ")
  .trim()

/** Selection card - active */
export const selectionCardActive = `
  ${selectionCardBase}
  bg-[#4a7c59]/[0.06] dark:bg-[#7cb88a]/[0.06]
  border-[#4a7c59]/[0.20] dark:border-[#7cb88a]/[0.18]
  ring-1 ring-[#4a7c59]/[0.08] dark:ring-[#7cb88a]/[0.06]
`
  .replace(/\s+/g, " ")
  .trim()

// =============================================================================
// TEXT STYLES
// =============================================================================

export const text = {
  /** Section label — warm dark, reads like ink on washi */
  label: "text-sm font-medium text-[#2c2a26] dark:text-[#e8e4dc]",
  /** Helper/description text */
  description: "text-xs text-[#8a8578] dark:text-[#7a756b]",
  /** Muted secondary text */
  muted: "text-xs text-[#b5afa3] dark:text-[#5c574d]",
  /** Success message */
  success: "text-xs text-emerald-600 dark:text-emerald-400",
  /** Error message */
  error: "text-xs text-red-600 dark:text-red-400",
} as const

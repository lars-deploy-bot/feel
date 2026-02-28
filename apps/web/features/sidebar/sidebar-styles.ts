// Shared style constants for sidebar components
export const styles = {
  // Backgrounds
  panel: "bg-white dark:bg-neutral-900",
  backdrop: "bg-black/40 dark:bg-black/60",
  // Borders - consistent opacity scale
  border: "border-black/[0.08] dark:border-white/[0.08]",
  borderSubtle: "border-black/[0.06] dark:border-white/[0.06]",
  // Hover states - low opacity fills
  hoverFill: "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
  activeFill: "bg-black/[0.04] dark:bg-white/[0.06]",
  hoverFillStrong: "hover:bg-black/[0.07] dark:hover:bg-white/[0.09]",
  // Text colors
  textPrimary: "text-black dark:text-white",
  textMuted: "text-black/40 dark:text-white/40",
  textSubtle: "text-black/30 dark:text-white/30",
  // Button styles
  iconButton:
    "inline-flex items-center justify-center size-8 rounded-lg text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] active:bg-black/[0.12] dark:active:bg-white/[0.12] active:scale-95",
  // Transitions
  transition: "transition-colors duration-150 ease-in-out",
  transitionAll: "transition-all duration-200 ease-in-out",
} as const

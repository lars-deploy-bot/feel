/**
 * Shared form styles for automation editor components.
 *
 * Single source of truth — used by GeneralTab, TriggerTab, ScheduleInput, ToolsTab.
 */

/** Standard input field class */
export const inputClass =
  "w-full h-9 px-3 rounded-lg text-sm bg-black/[0.04] dark:bg-white/[0.06] text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 border-0 focus:outline-none focus:ring-1 focus:ring-black/[0.08] dark:focus:ring-white/[0.08] transition-all"

/** Native select chevron (replaces browser default) */
export const selectChevron = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: "36px",
} as const

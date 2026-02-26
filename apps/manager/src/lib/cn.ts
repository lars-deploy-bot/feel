/** Minimal classname joiner — no dependencies needed */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

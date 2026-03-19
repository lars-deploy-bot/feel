/**
 * Get the display name for a React element type.
 * Checks displayName, then render.displayName, then render.name.
 */
export function getTypeName(type: unknown): string {
  if (typeof type === "string") return type

  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string }
    if (fn.displayName) return fn.displayName
    if (fn.name) return fn.name
    return "Unknown"
  }

  if (typeof type === "object" && type !== null) {
    const t = type as {
      displayName?: string
      render?: { displayName?: string; name?: string }
    }
    if (t.displayName) return t.displayName
    if (t.render?.displayName) return t.render.displayName
    if (t.render?.name) return t.render.name
    return "Unknown"
  }

  return "Unknown"
}

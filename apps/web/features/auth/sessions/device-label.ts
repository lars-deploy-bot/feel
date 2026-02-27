/**
 * Lightweight UA parser → "Chrome on macOS"
 * No dependencies, covers the common browsers and OSes.
 */

function parseBrowser(ua: string): string {
  // Order matters: check specific before generic
  if (ua.includes("Edg/") || ua.includes("Edge/")) return "Edge"
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera"
  if (ua.includes("Firefox/")) return "Firefox"
  if (ua.includes("CriOS/")) return "Chrome"
  if (ua.includes("Chrome/") && !ua.includes("Chromium/")) return "Chrome"
  if (ua.includes("Chromium/")) return "Chromium"
  if (ua.includes("Safari/") && ua.includes("Version/")) return "Safari"
  return "Unknown Browser"
}

function parseOS(ua: string): string {
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS"
  if (ua.includes("Android")) return "Android"
  if (ua.includes("Mac OS X") || ua.includes("Macintosh")) return "macOS"
  if (ua.includes("Windows")) return "Windows"
  if (ua.includes("Linux")) return "Linux"
  if (ua.includes("CrOS")) return "ChromeOS"
  return "Unknown OS"
}

export function parseDeviceLabel(userAgent: string | null): string | null {
  if (!userAgent) return null
  const browser = parseBrowser(userAgent)
  const os = parseOS(userAgent)
  return `${browser} on ${os}`
}

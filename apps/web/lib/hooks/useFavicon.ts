"use client"

import { useEffect, useState } from "react"

const FAVICON_CACHE_PREFIX = "alive:favicon:"
const FAVICON_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Load a site's favicon via Google's favicon service (same-origin friendly, no CSP issues).
 * Returns a data URL or null. Caches in localStorage for 7 days.
 */
export function useFavicon(hostname: string): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const cached = localStorage.getItem(`${FAVICON_CACHE_PREFIX}${hostname}`)
    if (!cached) return null
    try {
      const { url, ts } = JSON.parse(cached)
      if (Date.now() - ts < FAVICON_CACHE_TTL) return url
      localStorage.removeItem(`${FAVICON_CACHE_PREFIX}${hostname}`)
    } catch {
      /* corrupted cache */
    }
    return null
  })

  useEffect(() => {
    if (src) return

    // Same-origin proxy for Google's favicon service — no CORS/CSP issues
    const proxyUrl = `/api/favicon?domain=${encodeURIComponent(hostname)}`

    const img = new Image()
    img.onload = () => {
      setSrc(proxyUrl)
      localStorage.setItem(`${FAVICON_CACHE_PREFIX}${hostname}`, JSON.stringify({ url: proxyUrl, ts: Date.now() }))
    }
    img.onerror = () => {}
    img.src = proxyUrl
  }, [hostname, src])

  return src
}

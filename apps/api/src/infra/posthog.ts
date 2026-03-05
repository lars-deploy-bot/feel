import type { ManagerUserDevice, ManagerUserLocation, ManagerUserProfile } from "@webalive/shared"
import { env } from "../config/env"

const POSTHOG_HOST = env.POSTHOG_HOST
const POSTHOG_API_KEY = env.POSTHOG_API_KEY
const POSTHOG_PROJECT_ID = env.POSTHOG_PROJECT_ID

function isConfigured(): boolean {
  return Boolean(POSTHOG_HOST && POSTHOG_API_KEY && POSTHOG_PROJECT_ID)
}

export interface PostHogEvent {
  id: string
  event: string
  distinct_id: string
  timestamp: string
  properties: Record<string, unknown>
}

interface PostHogEventsResponse {
  results: PostHogEvent[]
  next: string | null
}

/**
 * Fetch events for a specific user from PostHog.
 * Returns empty array if PostHog is not configured.
 */
export async function fetchUserEvents(
  distinctId: string,
  options: { limit?: number; eventType?: string } = {},
): Promise<PostHogEvent[]> {
  if (!isConfigured()) {
    return []
  }

  const { limit = 50, eventType } = options

  const url = new URL(`/api/projects/${POSTHOG_PROJECT_ID}/events/`, POSTHOG_HOST)
  url.searchParams.set("distinct_id", distinctId)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("ordering", "-timestamp")

  if (eventType) {
    url.searchParams.set("event", eventType)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${POSTHOG_API_KEY}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`PostHog API error (${response.status}): ${text}`)
  }

  const data = (await response.json()) as PostHogEventsResponse
  return data.results
}

function str(p: Record<string, unknown>, key: string): string | null {
  const v = p[key]
  return typeof v === "string" && v.length > 0 ? v : null
}

/**
 * Build a user profile from their recent PostHog events.
 * Scans recent events to find all unique devices and locations.
 */
export async function fetchUserProfile(distinctId: string): Promise<ManagerUserProfile | null> {
  if (!isConfigured()) {
    return null
  }

  // Fetch more events to catch multiple devices/locations
  const events = await fetchUserEvents(distinctId, { limit: 100 })
  if (events.length === 0) return null

  // Dedupe devices by "browser + os + screen" fingerprint
  const deviceMap = new Map<string, ManagerUserDevice>()
  // Dedupe locations by "city + country"
  const locationMap = new Map<string, ManagerUserLocation>()

  for (const event of events) {
    const p = event.properties

    // Devices
    const browser = str(p, "$browser")
    const os = str(p, "$os")
    const screenW = p.$screen_width
    const screenH = p.$screen_height
    const screen = typeof screenW === "number" && typeof screenH === "number" ? `${screenW}x${screenH}` : null
    const deviceKey = `${browser ?? ""}|${os ?? ""}|${screen ?? ""}`

    if (deviceKey !== "||" && !deviceMap.has(deviceKey)) {
      deviceMap.set(deviceKey, {
        browser,
        browser_version: str(p, "$browser_version"),
        os,
        os_version: str(p, "$os_version"),
        device_type: str(p, "$device_type"),
        screen,
        last_seen: event.timestamp,
      })
    }

    // Locations
    const city = str(p, "$geoip_city_name")
    const country = str(p, "$geoip_country_name")
    const locKey = `${city ?? ""}|${country ?? ""}`

    if (locKey !== "|" && !locationMap.has(locKey)) {
      locationMap.set(locKey, {
        city,
        country,
        region: str(p, "$geoip_subdivision_1_name"),
        timezone: str(p, "$geoip_time_zone"),
        last_seen: event.timestamp,
      })
    }
  }

  return {
    devices: [...deviceMap.values()],
    locations: [...locationMap.values()],
    referrer: str(events[0].properties, "$referrer"),
    initial_referrer: str(events[0].properties, "$initial_referrer"),
  }
}

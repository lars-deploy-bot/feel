/**
 * Google Search Console API Client
 *
 * Direct fetch-based client — same approach as the proven mini-tools service.
 * Two API surfaces: Webmasters v3 (sites, analytics) and Search Console v1 (URL inspection).
 */

const WEBMASTERS_BASE = "https://www.googleapis.com/webmasters/v3"
const INSPECTION_BASE = "https://searchconsole.googleapis.com/v1"

export class GoogleApiError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = "GoogleApiError"
    this.statusCode = statusCode
  }
}

const FRIENDLY_ERRORS: Record<number, string> = {
  401: "Google access token is invalid or expired. The user needs to re-authenticate with Google.",
  403: "Access denied. The Google account does not have permission for this Search Console property.",
  404: "Search Console property not found. Check the siteUrl format (e.g. sc-domain:example.com).",
  429: "Google API rate limit exceeded. Try again in a few minutes.",
}

function isErrorResponse(val: unknown): val is { error: { code: number; message: string } } {
  if (typeof val !== "object" || val === null || !("error" in val)) return false
  const obj = val as Record<string, unknown>
  const err = obj.error
  if (typeof err !== "object" || err === null) return false
  const errObj = err as Record<string, unknown>
  return typeof errObj.code === "number" && typeof errObj.message === "string"
}

function extractGoogleError(val: unknown, httpStatus: number): GoogleApiError {
  if (isErrorResponse(val)) {
    const code = val.error.code
    const message = FRIENDLY_ERRORS[code] ?? `Google API error: ${val.error.message}`
    return new GoogleApiError(message, code)
  }
  const message = FRIENDLY_ERRORS[httpStatus] ?? `Google API error: HTTP ${httpStatus}`
  return new GoogleApiError(message, httpStatus)
}

interface GoogleApiOptions<T> {
  token: string
  path: string
  method: "GET" | "POST"
  body?: Record<string, unknown>
  base?: "webmasters" | "inspection"
  validate: (json: unknown) => T
}

const REQUEST_TIMEOUT_MS = 30_000

export async function googleApi<T>(options: GoogleApiOptions<T>): Promise<T> {
  const { token, path, method, body, base = "webmasters", validate } = options
  const baseUrl = base === "inspection" ? INSPECTION_BASE : WEBMASTERS_BASE
  const url = `${baseUrl}${path}`

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new GoogleApiError("Google API request timed out after 30s. Try again.", 408)
    }
    throw new GoogleApiError(
      `Network error reaching Google API: ${err instanceof Error ? err.message : String(err)}`,
      503,
    )
  }

  // Google sometimes returns HTML on 502/503 — handle non-JSON gracefully
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new GoogleApiError(
      `Google API returned non-JSON response (HTTP ${res.status}). The service may be temporarily unavailable.`,
      res.status,
    )
  }

  if (!res.ok) {
    throw extractGoogleError(json, res.status)
  }

  return validate(json)
}

// ============================================================
// Shared Types
// ============================================================

export interface AnalyticsRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface DimensionFilter {
  dimension: string
  operator?: string
  expression: string
}

export interface DimensionFilterGroup {
  groupType?: string
  filters: DimensionFilter[]
}

export interface AnalyticsQuery {
  siteUrl: string
  startDate: string
  endDate: string
  dimensions?: string[]
  type?: string
  dimensionFilterGroups?: DimensionFilterGroup[]
  aggregationType?: string
  rowLimit?: number
  startRow?: number
  dataState?: string
}

export interface InspectionResult {
  inspectionResult?: {
    inspectionResultLink?: string
    indexStatusResult?: Record<string, unknown>
    mobileUsabilityResult?: Record<string, unknown>
    richResultsResult?: Record<string, unknown>
  }
}

// ============================================================
// Sites
// ============================================================

export async function listSites(token: string): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
  interface SitesResponse {
    siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>
  }

  const result = await googleApi<SitesResponse>({
    token,
    path: "/sites",
    method: "GET",
    validate: (json): SitesResponse => {
      if (typeof json !== "object" || json === null) return { siteEntry: [] }
      const obj = json as Record<string, unknown>
      return {
        siteEntry: Array.isArray(obj.siteEntry) ? obj.siteEntry : [],
      }
    },
  })

  return (result.siteEntry ?? []).map(entry => ({
    siteUrl: entry.siteUrl ?? "",
    permissionLevel: entry.permissionLevel ?? "unknown",
  }))
}

// ============================================================
// Search Analytics
// ============================================================

export async function querySearchAnalytics(
  token: string,
  query: AnalyticsQuery,
): Promise<{ rows: AnalyticsRow[]; responseAggregationType: string | null }> {
  interface AnalyticsResponse {
    rows?: AnalyticsRow[]
    responseAggregationType?: string
  }

  const { siteUrl, ...requestBody } = query
  const encodedSiteUrl = encodeURIComponent(siteUrl)

  const result = await googleApi<AnalyticsResponse>({
    token,
    path: `/sites/${encodedSiteUrl}/searchAnalytics/query`,
    method: "POST",
    body: requestBody,
    validate: (json): AnalyticsResponse => {
      if (typeof json !== "object" || json === null) return { rows: [] }
      const obj = json as Record<string, unknown>
      return {
        rows: Array.isArray(obj.rows) ? obj.rows : [],
        responseAggregationType:
          typeof obj.responseAggregationType === "string" ? obj.responseAggregationType : undefined,
      }
    },
  })

  return {
    rows: result.rows ?? [],
    responseAggregationType: result.responseAggregationType ?? null,
  }
}

// ============================================================
// URL Inspection
// ============================================================

export async function inspectUrl(
  token: string,
  inspectionUrl: string,
  siteUrl: string,
  languageCode?: string,
): Promise<InspectionResult> {
  return googleApi<InspectionResult>({
    token,
    path: "/urlInspection/index:inspect",
    method: "POST",
    body: {
      inspectionUrl,
      siteUrl,
      ...(languageCode ? { languageCode } : {}),
    },
    base: "inspection",
    validate: (json): InspectionResult => (typeof json === "object" && json !== null ? (json as InspectionResult) : {}),
  })
}

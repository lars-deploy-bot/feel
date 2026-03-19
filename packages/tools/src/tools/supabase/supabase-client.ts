/**
 * Supabase Management API Client for MCP Tools
 *
 * Handles authentication, project ref resolution, and API calls.
 * OAuth tokens and project ref are fetched from the API server.
 */

import { COOKIE_NAMES } from "@webalive/shared"
import { z } from "zod"
import { errorResult, getApiBaseUrl, type ToolResult } from "../../lib/api-client.js"

const SUPABASE_API_BASE = "https://api.supabase.com"

/** Schema for Supabase context response */
const supabaseContextSchema = z.object({
  accessToken: z.string(),
  projectRef: z.string(),
})

/** Schema for project list response */
const projectListSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    region: z.string(),
    organization_id: z.string(),
  }),
)

/** Schema for single project response */
const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  status: z.string(),
})

/**
 * Supabase connection context retrieved from the API server
 */
export interface SupabaseContext {
  accessToken: string
  projectRef: string
}

/**
 * Get Supabase access token and project ref from the API server
 *
 * The server stores:
 * - OAuth tokens in lockbox.user_secrets (via oauth-core)
 * - Project ref in org-level settings (user configures after OAuth)
 */
export async function getSupabaseContext(): Promise<SupabaseContext | ToolResult> {
  try {
    const apiUrl = `${getApiBaseUrl()}/api/integrations/supabase/context`
    const sessionCookie = process.env.ALIVE_SESSION_COOKIE

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(sessionCookie && { Cookie: `${COOKIE_NAMES.SESSION}=${sessionCookie}` }),
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return errorResult(
          "Not connected to Supabase",
          "Please connect your Supabase account first via Settings > Integrations.",
        )
      }
      if (response.status === 404) {
        return errorResult(
          "No Supabase project configured",
          "You've connected Supabase, but haven't selected a project yet. Go to Settings > Integrations > Supabase to select your project.",
        )
      }
      const errorText = await response.text()
      return errorResult("Failed to get Supabase context", `HTTP ${response.status}: ${errorText}`)
    }

    const raw: unknown = await response.json()
    return supabaseContextSchema.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return errorResult("Failed to connect to Supabase", message)
  }
}

/**
 * Check if result is an error (ToolResult) vs valid context
 */
export function isToolError(result: SupabaseContext | ToolResult): result is ToolResult {
  return "isError" in result && result.isError === true
}

/**
 * Execute a SQL query via Supabase Management API
 */
export async function executeQuery(
  accessToken: string,
  projectRef: string,
  query: string,
  readOnly = false,
): Promise<{ data?: unknown[]; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_API_BASE}/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        read_only: readOnly,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => response.text())
      const errorMsg = typeof errorData === "object" ? JSON.stringify(errorData, null, 2) : errorData
      return { error: `Query failed (${response.status}): ${errorMsg}` }
    }

    const data = await response.json()
    return { data: Array.isArray(data) ? data : [data] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: `Request failed: ${message}` }
  }
}

/**
 * List all projects via Supabase Management API
 */
export async function fetchProjects(
  accessToken: string,
): Promise<{ data?: z.infer<typeof projectListSchema>; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_API_BASE}/v1/projects`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { error: `Failed to list projects (${response.status}): ${errorText}` }
    }

    const raw: unknown = await response.json()
    const data = projectListSchema.parse(raw)
    return { data }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: `Request failed: ${message}` }
  }
}

/**
 * Get project details via Supabase Management API
 */
export async function fetchProject(
  accessToken: string,
  projectRef: string,
): Promise<{ data?: z.infer<typeof projectSchema>; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_API_BASE}/v1/projects/${projectRef}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { error: `Failed to get project (${response.status}): ${errorText}` }
    }

    const raw: unknown = await response.json()
    const data = projectSchema.parse(raw)
    return { data }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { error: `Request failed: ${message}` }
  }
}

/**
 * Typed API helpers for E2E tests.
 *
 * WHY THIS EXISTS:
 * Playwright's APIResponse has `.ok()` as a METHOD, not a property.
 * Native fetch has `.ok` as a PROPERTY. This mismatch causes silent bugs:
 *
 *   expect(res.ok).toBe(true)   // BUG: comparing a function to true
 *   expect(res.ok()).toBe(true)  // correct, but easy to forget
 *
 * These helpers return a plain object where `ok` is a boolean.
 * Tests should ALWAYS use these instead of raw `request.get()`/`request.post()`.
 */

import type { APIRequestContext, Request } from "@playwright/test"
import type { ValidatedBody } from "@/types/guards/api"

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T
}

/**
 * GET a JSON API endpoint. Returns a plain object with `ok` as a boolean.
 * Throws if the response is not valid JSON (by design — all our API endpoints return JSON).
 */
export async function apiGet<T = unknown>(request: APIRequestContext, url: string): Promise<ApiResult<T>> {
  const response = await request.get(url)
  const data = (await response.json()) as T
  return {
    ok: response.ok(),
    status: response.status(),
    data,
  }
}

/**
 * POST to a JSON API endpoint. Returns a plain object with `ok` as a boolean.
 * Throws if the response is not valid JSON (by design — all our API endpoints return JSON).
 */
export async function apiPost<T = unknown>(
  request: APIRequestContext,
  url: string,
  body: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const response = await request.post(url, { data: body })
  const data = (await response.json()) as T
  return {
    ok: response.ok(),
    status: response.status(),
    data,
  }
}

/**
 * Parse a Playwright Request's POST body as the canonical ValidatedBody type.
 * Use this to inspect intercepted /api/claude/stream requests in E2E tests.
 */
export function parseValidatedBody(request: Request): ValidatedBody {
  const postData = request.postData()
  if (!postData) {
    throw new Error("Missing /api/claude/stream request body")
  }
  return JSON.parse(postData) as ValidatedBody
}

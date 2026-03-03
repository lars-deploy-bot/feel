import type { EndpointSchema } from "@alive-brug/alrighty"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes } from "@/lib/error-codes"
import { formDataToObject } from "./form-data"
import { structuredErrorResponse } from "./responses"
import { apiSchemas, type Endpoint, type Params, type Query, type Req, type ResPayload } from "./schemas"

interface ValidationIssue {
  code: string
  path: PropertyKey[]
  message: string
}

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

/** Options for `handleBody` — all optional, backwards-compatible. */
export interface HandleBodyOptions {
  /** Add CORS headers to all error responses from handleBody */
  cors?: string | null
}

/** Endpoints that define a `params` schema. */
export type EndpointWithParams = {
  [K in Endpoint]: Params<K> extends never ? never : K
}[Endpoint]

/** Endpoints that define a `req` schema (including `z.undefined()` request schemas). */
export type EndpointWithReq = {
  [K in Endpoint]: Req<K> extends never ? never : K
}[Endpoint]

/** Endpoints that define a `query` schema. */
export type EndpointWithQuery = {
  [K in Endpoint]: Query<K> extends never ? never : K
}[Endpoint]

/** Endpoints that define both `params` and `req` schemas. */
export type EndpointWithReqAndParams = Extract<EndpointWithReq, EndpointWithParams>

/** Options for `handleQuery`. */
export interface HandleQueryOptions extends HandleBodyOptions {
  /** Optional query source override (defaults to `new URL(req.url).searchParams`) */
  searchParams?: URLSearchParams
}

/** Options for `handleParams`. */
export interface HandleParamsOptions<P> extends HandleBodyOptions {
  /** URL path params from Next.js route context (`await context.params`) */
  params: P | Promise<P>
}

/** Options for `handleRoute`. */
export interface HandleRouteOptions<P> extends HandleParamsOptions<P> {}

/** Options for `alrighty`. */
export interface AlrightyOptions {
  /** Add CORS headers to the success response */
  cors?: string | null
  /** HTTP status code (default: 200) */
  status?: number
  /** Extra headers to add */
  headers?: HeadersInit
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Wrap a NextResponse with CORS headers if `cors` is provided */
function withCors(res: NextResponse, cors: string | null | undefined): NextResponse {
  if (cors !== undefined) {
    addCorsHeaders(res, cors)
  }
  return res
}

/** structuredErrorResponse + CORS */
function corsStructuredError(
  code: Parameters<typeof structuredErrorResponse>[0],
  opts: Parameters<typeof structuredErrorResponse>[1],
  cors: string | null | undefined,
): NextResponse {
  const res = structuredErrorResponse(code, opts)
  return withCors(res, cors)
}

/**
 * Convert URLSearchParams into a plain object.
 * Repeated keys become arrays, single keys stay strings.
 */
function searchParamsToObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}

  for (const [key, value] of searchParams.entries()) {
    const existing = out[key]
    if (existing === undefined) {
      out[key] = value
      continue
    }

    if (Array.isArray(existing)) {
      existing.push(value)
      continue
    }

    out[key] = [existing, value]
  }

  return out
}

// ---------------------------------------------------------------------------
// handleQuery
// ---------------------------------------------------------------------------

/**
 * Validates URL query/search params using the endpoint's `query` schema.
 */
export async function handleQuery<E extends EndpointWithQuery>(
  endpoint: E,
  req: Request,
  options?: HandleQueryOptions,
): Promise<Query<E> | NextResponse> {
  const cors = options?.cors
  try {
    const entry: EndpointSchema = apiSchemas[endpoint]
    const querySchema = entry.query
    if (!querySchema) {
      return corsStructuredError(
        ErrorCodes.INTERNAL_ERROR,
        {
          status: 500,
          details: {
            reason: `No query schema defined for ${String(endpoint)}`,
          },
        },
        cors,
      )
    }

    const searchParams = options?.searchParams ?? new URL(req.url).searchParams
    const raw = searchParamsToObject(searchParams)
    const result = querySchema.safeParse(raw)
    if (result.success) return result.data as Query<E>

    const firstIssue = result.error.issues[0]
    const field = firstIssue ? firstIssue.path.map(segment => String(segment)).join(".") : undefined
    const message = firstIssue?.message || "Query params failed validation"
    const issues = result.error.issues.map((issue: ValidationIssue) => ({
      code: issue.code,
      path: issue.path.map(segment => String(segment)).join("."),
      message: issue.message,
    }))

    return corsStructuredError(
      ErrorCodes.INVALID_REQUEST,
      {
        status: 400,
        details: {
          input: "query",
          ...(field ? { field } : {}),
          message,
          issues,
        },
      },
      cors,
    )
  } catch (e) {
    console.error("handleQuery error:", e)
    Sentry.captureException(e)
    return corsStructuredError(
      ErrorCodes.INTERNAL_ERROR,
      {
        status: 500,
        details: {
          reason: "Internal error during query handling",
        },
      },
      cors,
    )
  }
}

// ---------------------------------------------------------------------------
// handleParams
// ---------------------------------------------------------------------------

/**
 * Validates URL path params using the endpoint's `params` schema.
 */
export async function handleParams<E extends EndpointWithParams>(
  endpoint: E,
  options: HandleParamsOptions<Params<E>>,
): Promise<Params<E> | NextResponse> {
  const cors = options.cors
  try {
    const resolvedParams = await options.params
    const entry: EndpointSchema = apiSchemas[endpoint]
    const paramsSchema = entry.params
    if (!paramsSchema) {
      return corsStructuredError(
        ErrorCodes.INTERNAL_ERROR,
        {
          status: 500,
          details: {
            reason: `No params schema defined for ${String(endpoint)}`,
          },
        },
        cors,
      )
    }

    const result = paramsSchema.safeParse(resolvedParams)
    if (result.success) return result.data as Params<E>

    const firstIssue = result.error.issues[0]
    const issues = result.error.issues.map((issue: ValidationIssue) => ({
      code: issue.code,
      path: issue.path.map(segment => String(segment)).join("."),
      message: issue.message,
    }))
    return corsStructuredError(
      ErrorCodes.INVALID_REQUEST,
      {
        status: 400,
        details: {
          input: "params",
          message: firstIssue?.message || "URL params failed validation",
          issues,
        },
      },
      cors,
    )
  } catch (e) {
    console.error("handleParams error:", e)
    Sentry.captureException(e)
    return corsStructuredError(
      ErrorCodes.INTERNAL_ERROR,
      {
        status: 500,
        details: {
          input: "params",
          reason: "Internal error during params handling",
        },
      },
      cors,
    )
  }
}

// ---------------------------------------------------------------------------
// handleBody
// ---------------------------------------------------------------------------

/**
 * Validates and parses a request body using the `req` schema
 * from apiSchemas[endpoint]. Supports JSON, multipart/form-data,
 * and lenient fallback for mutation methods with missing Content-Type.
 *
 * Usage in a route handler:
 *   const parsed = await handleBody('call', req)
 *   if (isHandleBodyError(parsed)) return parsed
 *   // parsed is now typed as Req<'call'>
 *
 * With CORS:
 *   const parsed = await handleBody('call', req, { cors: origin })
 *   if (isHandleBodyError(parsed)) return parsed  // CORS already set
 */
export async function handleBody<E extends EndpointWithReq>(
  endpoint: E,
  req: Request,
  options?: HandleBodyOptions,
): Promise<Req<E> | NextResponse> {
  const cors = options?.cors
  try {
    const { method } = req
    const entry: EndpointSchema = apiSchemas[endpoint]
    if (method === "OPTIONS" || method === "HEAD") {
      return withCors(
        NextResponse.json({ error: "This method does not support request bodies" }, { status: 400 }),
        cors,
      )
    }

    if (method === "GET" && entry.query) {
      return corsStructuredError(
        ErrorCodes.INVALID_REQUEST,
        {
          status: 400,
          details: {
            input: "query",
            message: `Endpoint ${String(endpoint)} expects query params. Use handleQuery() instead of handleBody().`,
          },
        },
        cors,
      )
    }

    const contentType = req.headers.get("Content-Type") || ""
    let raw: unknown

    try {
      if (contentType.includes("multipart/form-data")) {
        const fd = await req.formData()
        raw = formDataToObject(fd)
      } else if (contentType.includes("application/json")) {
        raw = await req.json()
      } else if (contentType === "" && (method === "GET" || method === "DELETE")) {
        // No body expected, allow empty body if your schema is z.never() or optional
        raw = undefined
      } else if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        // Lenient: attempt JSON parsing regardless of Content-Type.
        // Matches behavior of raw `req.json()` which all unmigrated routes use.
        try {
          raw = await req.json()
        } catch {
          raw = undefined // Let Zod validation handle the missing body
        }
      } else {
        raw = undefined
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        return corsStructuredError(
          ErrorCodes.INVALID_REQUEST,
          {
            status: 400,
            details: {
              input: "body",
              message: "Malformed JSON body",
            },
          },
          cors,
        )
      }
      throw e
    }

    // `handleBody` must only be used with endpoints that define `req`.
    const reqSchema = entry.req
    if (!reqSchema) {
      return withCors(
        NextResponse.json({ error: `No request schema defined for ${String(endpoint)}` }, { status: 500 }),
        cors,
      )
    }

    const result = reqSchema.safeParse(raw)
    if (result.success) return result.data as Req<E>

    const firstIssue = result.error.issues[0]
    const field = firstIssue ? firstIssue.path.map(segment => String(segment)).join(".") : undefined
    const message = firstIssue?.message || "Request body failed validation"

    const issues = result.error.issues.map((issue: ValidationIssue) => ({
      code: issue.code,
      path: issue.path.map(segment => String(segment)).join("."),
      message: issue.message,
    }))

    return corsStructuredError(
      ErrorCodes.INVALID_REQUEST,
      {
        status: 400,
        details: {
          input: "body",
          ...(field ? { field } : {}),
          message,
          issues,
        },
      },
      cors,
    )
  } catch (e) {
    console.error("handleBody error:", e)
    Sentry.captureException(e)
    return corsStructuredError(
      ErrorCodes.INTERNAL_ERROR,
      {
        status: 500,
        details: {
          input: "body",
          reason: "Internal error during body handling",
        },
      },
      cors,
    )
  }
}

export const isHandleBodyError = (x: unknown): x is NextResponse => x instanceof NextResponse

// ---------------------------------------------------------------------------
// handleRoute — params-aware wrapper
// ---------------------------------------------------------------------------

/**
 * Validates both request body AND URL path params in one call.
 * Returns `{ body, params }` on success, or a CORS-aware NextResponse on failure.
 *
 * Usage:
 *   const result = await handleRoute("automations/update", req, {
 *     cors: origin,
 *     params: await context.params,
 *   })
 *   if (isHandleBodyError(result)) return result
 *   const { body, params } = result
 */
export async function handleRoute<E extends EndpointWithReqAndParams>(
  endpoint: E,
  req: Request,
  options: HandleRouteOptions<Params<E>>,
): Promise<{ body: Req<E>; params: Params<E> } | NextResponse> {
  const paramsResult = await handleParams(endpoint, options)
  if (isHandleBodyError(paramsResult)) return paramsResult

  // Validate body
  const bodyResult = await handleBody(endpoint, req, { cors: options.cors })
  if (isHandleBodyError(bodyResult)) return bodyResult

  return { body: bodyResult, params: paramsResult }
}

// ---------------------------------------------------------------------------
// alrighty
// ---------------------------------------------------------------------------

/**
 * Creates a typed JSON response that is validated against the
 * apiSchemas[endpoint].res schema *before* sending to the client.
 *
 * Automatically injects `ok: true` — callers never need to pass it.
 *
 * The payload must have the same top-level keys as the response schema
 * (minus `ok`), but values can be wider types (e.g. DB rows with `Json`
 * where the schema expects `string | null`). Zod validates exact types
 * at runtime.
 *
 * Usage:
 *   return alrighty('automations/create', { automation: dbRow })
 *
 * With CORS:
 *   return alrighty('automations/create', { automation: dbRow }, { cors: origin })
 */
export function alrighty<E extends Endpoint>(
  endpoint: E,
  payload: { [K in keyof ResPayload<E>]: unknown },
  options?: AlrightyOptions,
): NextResponse
export function alrighty<E extends Endpoint>(
  endpoint: E,
  payload: { [K in keyof ResPayload<E>]: unknown },
  init?: ResponseInit,
): NextResponse
export function alrighty<E extends Endpoint>(
  endpoint: E,
  payload: { [K in keyof ResPayload<E>]: unknown },
  optionsOrInit?: AlrightyOptions | ResponseInit,
): NextResponse {
  const schema = apiSchemas[endpoint].res
  const parsed = schema.parse({ ok: true, ...payload })

  const { init, cors } = normalizeAlrightyOptions(optionsOrInit)
  const res = NextResponse.json(parsed, init)
  return withCors(res, cors)
}

function normalizeAlrightyOptions(optionsOrInit: AlrightyOptions | ResponseInit | undefined): {
  init: ResponseInit
  cors: string | null | undefined
} {
  if (!optionsOrInit) {
    return { init: {}, cors: undefined }
  }

  if ("cors" in optionsOrInit) {
    const init: ResponseInit = {}
    if (optionsOrInit.status !== undefined) init.status = optionsOrInit.status
    if (optionsOrInit.headers !== undefined) init.headers = optionsOrInit.headers
    return { init, cors: optionsOrInit.cors }
  }

  return { init: optionsOrInit, cors: undefined }
}

/**
 * Convenience for the common { success:false, error } shape.
 * Works if your endpoint's res schema accepts that shape.
 */
export function fail<E extends Endpoint>(
  endpoint: E,
  message: string,
  options?: { code?: string; status?: number },
): NextResponse {
  const body: unknown = {
    success: false,
    error: {
      code: options?.code ?? "INTERNAL_ERROR",
      message,
      timestamp: new Date().toISOString(),
    },
  }
  const schema = apiSchemas[endpoint].res
  const parsed = schema.parse(body)
  return NextResponse.json(parsed, { status: options?.status ?? 500 })
}

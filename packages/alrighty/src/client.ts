import { ZodError } from "zod"
import { ApiError } from "./error.js"
import type {
  BodyReqEndpoint,
  ClientOptions,
  Endpoint,
  EndpointWithReq,
  ReadEndpoint,
  Req,
  Res,
  SchemaRegistry,
  UndefinedReqEndpoint,
} from "./types.js"

function resolvePath(
  basePath: string,
  endpoint: string,
  schemaPath: string | undefined,
  pathOverride: string | undefined,
): string {
  if (pathOverride) {
    // Relative paths (e.g. "/api/automations") need the origin from basePath.
    // In browsers, fetch("/api/...") works (relative to page origin), but in
    // Node.js/Bun there is no implicit origin — fetch throws "URL is invalid".
    if (pathOverride.startsWith("/") && /^https?:\/\//.test(basePath)) {
      const origin = basePath.replace(/^(https?:\/\/[^/]+).*$/, "$1")
      return `${origin}${pathOverride}`
    }
    return pathOverride
  }

  const rawPath = schemaPath ?? endpoint
  if (/^https?:\/\//.test(rawPath)) {
    return rawPath
  }

  return `${basePath.replace(/\/$/, "")}/${rawPath.replace(/^\//, "")}`
}

/**
 * Creates a typed API client from a schema registry
 */
export function createClient<T extends SchemaRegistry>(schemas: T, options: ClientOptions = {}) {
  const {
    basePath = "/api",
    credentials = "include",
    headers: defaultHeaders,
    allowAbsolutePathOverride = false,
  } = options

  async function api<E extends Endpoint<T>>(
    endpoint: E,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    body?: unknown,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>> {
    if (pathOverride && /^https?:\/\//.test(pathOverride) && !allowAbsolutePathOverride) {
      throw new ApiError(
        "Absolute pathOverride URLs are disabled. Use a relative '/api/...' path or enable allowAbsolutePathOverride.",
        undefined,
        "UNSAFE_PATH_OVERRIDE",
      )
    }

    const schemaPath = schemas[endpoint]?.path
    const path = resolvePath(basePath, String(endpoint), schemaPath, pathOverride)
    const hasBody = method !== "GET"

    // Validate request body against schema (runs even for undefined to catch missing required fields)
    if (hasBody && schemas[endpoint].req) {
      try {
        schemas[endpoint].req.parse(body)
      } catch (e) {
        throw new ApiError(
          "Request validation failed",
          undefined,
          "REQUEST_VALIDATION_ERROR",
          e instanceof ZodError ? e.issues : e,
        )
      }
    }

    // Fetch
    let res: Response
    try {
      res = await fetch(path, {
        ...init,
        method,
        credentials,
        headers: { "Content-Type": "application/json", ...defaultHeaders, ...init?.headers },
        body: hasBody && body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (e) {
      throw new ApiError("Network error", undefined, "NETWORK_ERROR", e)
    }

    // Parse response
    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new ApiError("Non-JSON response", res.status, "NON_JSON_RESPONSE")
    }

    // Handle HTTP errors
    // Supports: { error: { message, code } }, { error: "CODE", message: "..." }, { message: "..." }
    if (!res.ok) {
      const err = json as Record<string, unknown>
      const nested = err?.error as Record<string, unknown> | string | undefined
      // Prefer top-level message (user-friendly from server) over raw error code string
      const message =
        (typeof err?.message === "string" && err.message ? err.message : undefined) ??
        (typeof nested === "object" && typeof nested?.message === "string" ? nested.message : undefined) ??
        (typeof nested === "string" ? nested : undefined) ??
        `HTTP ${res.status}`
      const code =
        (typeof nested === "object" && typeof nested?.code === "string" ? nested.code : undefined) ??
        (typeof nested === "string" ? nested : undefined) ??
        (typeof err?.code === "string" ? err.code : undefined) ??
        "HTTP_ERROR"
      throw new ApiError(message, res.status, code, json)
    }

    // Validate response
    try {
      return schemas[endpoint].res.parse(json) as Res<T, E>
    } catch (e) {
      if (e instanceof ZodError) {
        throw new ApiError("Response validation failed", res.status, "VALIDATION_ERROR", e.issues)
      }
      throw new ApiError("Response parsing failed", res.status, "PARSE_ERROR", e)
    }
  }

  function resolveDeleteArgs<E extends Endpoint<T>>(
    endpoint: E,
    bodyOrInit?: Req<T, E> | undefined | Omit<RequestInit, "body" | "method">,
    initOrPath?: Omit<RequestInit, "body" | "method"> | string,
    pathOverrideMaybe?: string,
  ): {
    body: unknown
    init: Omit<RequestInit, "body" | "method"> | undefined
    pathOverrideResolved: string | undefined
  } {
    let body: unknown
    let init: Omit<RequestInit, "body" | "method"> | undefined
    let pathOverrideResolved: string | undefined

    if (typeof pathOverrideMaybe === "string") {
      // New form: deletty(endpoint, body, init?, pathOverride)
      body = bodyOrInit
      init = initOrPath as Omit<RequestInit, "body" | "method"> | undefined
      pathOverrideResolved = pathOverrideMaybe
    } else if (typeof initOrPath === "string") {
      // For endpoints with request schemas, second arg is body.
      if (schemas[endpoint].req) {
        body = bodyOrInit
      } else {
        // Backward compatible form: deletty(endpoint, init?, pathOverride)
        init = bodyOrInit as Omit<RequestInit, "body" | "method"> | undefined
      }
      pathOverrideResolved = initOrPath
    } else if (initOrPath !== undefined) {
      // New form: deletty(endpoint, body, init)
      body = bodyOrInit
      init = initOrPath as Omit<RequestInit, "body" | "method"> | undefined
    } else if (bodyOrInit === undefined) {
      init = undefined
    } else if (schemas[endpoint].req) {
      // New form: deletty(endpoint, body)
      body = bodyOrInit
    } else {
      // Endpoint has no request schema; treat second arg as RequestInit for compatibility.
      init = bodyOrInit as Omit<RequestInit, "body" | "method">
    }

    return { body, init, pathOverrideResolved }
  }

  function deletty<E extends BodyReqEndpoint<T>>(
    endpoint: E,
    body: Req<T, E>,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>>
  function deletty<E extends BodyReqEndpoint<T>>(endpoint: E, body: Req<T, E>, pathOverride: string): Promise<Res<T, E>>
  function deletty<E extends UndefinedReqEndpoint<T>>(endpoint: E): Promise<Res<T, E>>
  function deletty<E extends UndefinedReqEndpoint<T>>(
    endpoint: E,
    body: undefined,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>>
  function deletty<E extends UndefinedReqEndpoint<T>>(
    endpoint: E,
    body: undefined,
    pathOverride: string,
  ): Promise<Res<T, E>>
  function deletty<E extends ReadEndpoint<T>>(
    endpoint: E,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>>
  function deletty<E extends Endpoint<T>>(
    endpoint: E,
    bodyOrInit?: Req<T, E> | undefined | Omit<RequestInit, "body" | "method">,
    initOrPath?: Omit<RequestInit, "body" | "method"> | string,
    pathOverrideMaybe?: string,
  ): Promise<Res<T, E>> {
    const { body, init, pathOverrideResolved } = resolveDeleteArgs(endpoint, bodyOrInit, initOrPath, pathOverrideMaybe)
    return api(endpoint, "DELETE", body, init, pathOverrideResolved)
  }

  function delly<E extends BodyReqEndpoint<T>>(
    endpoint: E,
    body: Req<T, E>,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>>
  function delly<E extends BodyReqEndpoint<T>>(endpoint: E, body: Req<T, E>, pathOverride: string): Promise<Res<T, E>>
  function delly<E extends UndefinedReqEndpoint<T>>(endpoint: E): Promise<Res<T, E>>
  function delly<E extends UndefinedReqEndpoint<T>>(
    endpoint: E,
    body: undefined,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>>
  function delly<E extends UndefinedReqEndpoint<T>>(
    endpoint: E,
    body: undefined,
    pathOverride: string,
  ): Promise<Res<T, E>>
  function delly<E extends ReadEndpoint<T>>(
    endpoint: E,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>>
  function delly<E extends Endpoint<T>>(
    endpoint: E,
    bodyOrInit?: Req<T, E> | undefined | Omit<RequestInit, "body" | "method">,
    initOrPath?: Omit<RequestInit, "body" | "method"> | string,
    pathOverrideMaybe?: string,
  ): Promise<Res<T, E>> {
    const { body, init, pathOverrideResolved } = resolveDeleteArgs(endpoint, bodyOrInit, initOrPath, pathOverrideMaybe)
    return api(endpoint, "DELETE", body, init, pathOverrideResolved)
  }

  function postty<E extends BodyReqEndpoint<T>>(
    endpoint: E,
    body: Req<T, E>,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>>
  function postty<E extends BodyReqEndpoint<T>>(endpoint: E, body: Req<T, E>, pathOverride: string): Promise<Res<T, E>>
  function postty<E extends UndefinedReqEndpoint<T>>(endpoint: E): Promise<Res<T, E>>
  function postty<E extends UndefinedReqEndpoint<T>>(
    endpoint: E,
    body: undefined,
    init?: Omit<RequestInit, "body" | "method">,
    pathOverride?: string,
  ): Promise<Res<T, E>>
  function postty<E extends UndefinedReqEndpoint<T>>(
    endpoint: E,
    body: undefined,
    pathOverride: string,
  ): Promise<Res<T, E>>
  function postty<E extends EndpointWithReq<T>>(
    endpoint: E,
    bodyOrUndefined?: Req<T, E> | undefined,
    initOrPath?: Omit<RequestInit, "body" | "method"> | string,
    pathOverrideMaybe?: string,
  ): Promise<Res<T, E>> {
    let body: unknown
    let init: Omit<RequestInit, "body" | "method"> | undefined
    let pathOverrideResolved: string | undefined

    if (typeof pathOverrideMaybe === "string") {
      body = bodyOrUndefined
      init = initOrPath as Omit<RequestInit, "body" | "method"> | undefined
      pathOverrideResolved = pathOverrideMaybe
    } else if (typeof initOrPath === "string") {
      body = bodyOrUndefined
      pathOverrideResolved = initOrPath
    } else if (initOrPath !== undefined) {
      body = bodyOrUndefined
      init = initOrPath
    } else {
      body = bodyOrUndefined
    }

    return api(endpoint, "POST", body, init, pathOverrideResolved)
  }

  return {
    getty: <E extends ReadEndpoint<T>>(
      endpoint: E,
      init?: Omit<RequestInit, "body" | "method">,
      pathOverride?: string,
    ) => api(endpoint, "GET", undefined, init, pathOverride),
    postty,
    putty: <E extends EndpointWithReq<T>>(
      endpoint: E,
      body: Req<T, E>,
      init?: Omit<RequestInit, "body" | "method">,
      pathOverride?: string,
    ) => api(endpoint, "PUT", body, init, pathOverride),
    patchy: <E extends EndpointWithReq<T>>(
      endpoint: E,
      body: Req<T, E>,
      init?: Omit<RequestInit, "body" | "method">,
      pathOverride?: string,
    ) => api(endpoint, "PATCH", body, init, pathOverride),
    deletty,
    /** Alias for deletty */
    delly,
  }
}

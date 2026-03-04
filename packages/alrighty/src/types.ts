import type { z } from "zod"

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/**
 * Schema definition for a single endpoint.
 * `req` is optional - omit it for GET/DELETE endpoints.
 */
export interface EndpointSchema {
  /**
   * Optional URL path override for this endpoint.
   *
   * Use when the schema key is a lookup key rather than the actual route path.
   * Examples:
   * - key: "automations/create", path: "automations"
   * - key: "automations/trigger", path left undefined, call-site passes dynamic pathOverride
   */
  path?: string
  /** Validates URL path params (e.g., `z.object({ id: z.string() })`) */
  params?: z.ZodTypeAny
  /** Validates URL query/search params (e.g., `z.object({ limit: z.coerce.number() })`) */
  query?: z.ZodTypeAny
  req?: z.ZodTypeAny
  res: z.ZodTypeAny
}

/**
 * Registry of all endpoint schemas.
 *
 * ```typescript
 * const schemas = {
 *   user: { res: z.object({...}) },                    // GET - no req needed
 *   login: { req: z.object({...}), res: z.object({...}) }, // POST
 * } satisfies SchemaRegistry
 * ```
 */
export type SchemaRegistry = Record<string, EndpointSchema>

/**
 * Extract endpoint names from a schema registry
 */
export type Endpoint<T extends SchemaRegistry> = keyof T & string

/**
 * Endpoints that have a request body schema (for POST/PUT/PATCH)
 */
export type MutationEndpoint<T extends SchemaRegistry> = {
  [K in keyof T]: T[K]["req"] extends z.ZodTypeAny ? K : never
}[keyof T] &
  string

/** Alias for endpoints that define a request schema. */
export type EndpointWithReq<T extends SchemaRegistry> = MutationEndpoint<T>

/**
 * Endpoints that have NO request body schema (for GET/DELETE)
 */
export type ReadEndpoint<T extends SchemaRegistry> = {
  [K in keyof T]: T[K]["req"] extends z.ZodTypeAny ? never : K
}[keyof T] &
  string

/** Endpoints whose request schema input is exactly `undefined` (e.g. `z.undefined()`). */
export type UndefinedReqEndpoint<T extends SchemaRegistry> = {
  [K in EndpointWithReq<T>]: [ReqInput<T, K>] extends [undefined] ? K : never
}[EndpointWithReq<T>] &
  string

/** Endpoints that require a non-undefined request body. */
export type BodyReqEndpoint<T extends SchemaRegistry> = Exclude<EndpointWithReq<T>, UndefinedReqEndpoint<T>>

/**
 * Extract request type for an endpoint.
 * Returns `never` if no req schema (prevents passing body to GET endpoints).
 */
export type Req<T extends SchemaRegistry, E extends Endpoint<T>> = T[E]["req"] extends z.ZodTypeAny
  ? z.infer<T[E]["req"]>
  : never

/**
 * Extract raw request input type for an endpoint (before parse/transform/brand).
 * Returns `never` if no req schema.
 */
export type ReqInput<T extends SchemaRegistry, E extends Endpoint<T>> = T[E]["req"] extends z.ZodTypeAny
  ? z.input<T[E]["req"]>
  : never

/**
 * Extract response type for an endpoint (validated output)
 */
export type Res<T extends SchemaRegistry, E extends Endpoint<T>> = z.infer<T[E]["res"]>

/**
 * Extract params type for an endpoint.
 * Returns `never` if no params schema defined.
 */
export type Params<T extends SchemaRegistry, E extends Endpoint<T>> = T[E]["params"] extends z.ZodTypeAny
  ? z.infer<T[E]["params"]>
  : never

/**
 * Extract query type for an endpoint.
 * Returns `never` if no query schema defined.
 */
export type Query<T extends SchemaRegistry, E extends Endpoint<T>> = T[E]["query"] extends z.ZodTypeAny
  ? z.infer<T[E]["query"]>
  : never

/**
 * Response payload type for an endpoint — what callers actually pass.
 * Strips `ok` since alrighty auto-injects `ok: true`.
 */
export type ResPayload<T extends SchemaRegistry, E extends Endpoint<T>> = Omit<Res<T, E>, "ok">

/**
 * Client configuration options
 */
export interface ClientOptions {
  /** Base path for all endpoints (default: /api) */
  basePath?: string
  /** Fetch credentials mode (default: include) */
  credentials?: RequestCredentials
  /** Default headers for all requests (e.g., auth tokens). Use Record<string, string>, not Headers instance. */
  headers?: Record<string, string>
  /** Allow absolute URL `pathOverride` values (default: false for SSRF safety). */
  allowAbsolutePathOverride?: boolean
}

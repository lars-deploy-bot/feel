/**
 * Shared API Types & Type Guards
 *
 * Single source of truth for API request/response types.
 * Used by both API routes and frontend consumers.
 */

// ============================================================================
// Base Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  ok: boolean
  error?: string
  message?: string
  data?: T
}

export interface ApiError {
  ok: false
  error: string
  message?: string
}

// ============================================================================
// Auth API Types
// ============================================================================

export interface Organization {
  org_id: string
  name: string
  credits: number
  workspace_count?: number
}

export interface OrganizationsResponse {
  ok: true
  organizations: Organization[]
}

export interface WorkspacesResponse {
  ok: true
  workspaces: string[]
}

export interface LoginResponse {
  ok: true
  message?: string
}

export interface LogoutResponse {
  ok: true
  message: string
}

export interface VerifyResponse {
  ok: true
  verified: true
  workspace: string
  message: string
  requestId: string
}

export interface TokensResponse {
  ok: true
  tokens: number
  credits: number
  workspace: string
}

// ============================================================================
// Deploy API Types
// ============================================================================

export interface DeployResponse {
  ok: true
  message: string
  workspace: string
  url: string
}

export interface DeploySubdomainResponse {
  ok: true
  message: string
  subdomain: string
  workspace: string
}

// ============================================================================
// Sites API Types
// ============================================================================

export interface CheckAvailabilityResponse {
  ok: true
  available: boolean
  domain: string
}

export interface SiteMetadataResponse {
  ok: true
  metadata: {
    title?: string
    description?: string
    favicon?: string
    og_image?: string
  }
}

// ============================================================================
// Images API Types
// ============================================================================

export interface ImageUploadResponse {
  ok: true
  key: string
  url: string
  size: number
}

export interface ImageListResponse {
  ok: true
  images: Array<{
    key: string
    url: string
    size: number
    uploaded: number
  }>
}

export interface ImageDeleteResponse {
  ok: true
  deleted: string
}

// ============================================================================
// Feedback API Types
// ============================================================================

export interface FeedbackResponse {
  ok: true
  message: string
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for basic API response shape
 */
export function isApiResponse(data: unknown): data is ApiResponse {
  return typeof data === "object" && data !== null && "ok" in data && typeof (data as ApiResponse).ok === "boolean"
}

/**
 * Type guard for API error response
 */
export function isApiError(data: unknown): data is ApiError {
  return isApiResponse(data) && data.ok === false && typeof data.error === "string"
}

/**
 * Type guard for successful API response
 */
export function isApiSuccess<T>(data: unknown): data is ApiResponse<T> & { ok: true } {
  return isApiResponse(data) && data.ok === true
}

/**
 * Type guard for Organization object
 */
export function isOrganization(data: unknown): data is Organization {
  return (
    typeof data === "object" &&
    data !== null &&
    "org_id" in data &&
    typeof (data as Organization).org_id === "string" &&
    "name" in data &&
    typeof (data as Organization).name === "string" &&
    "credits" in data &&
    typeof (data as Organization).credits === "number"
  )
}

/**
 * Type guard for OrganizationsResponse
 */
export function isOrganizationsResponse(data: unknown): data is OrganizationsResponse {
  if (!isApiSuccess(data)) return false

  return (
    "organizations" in data &&
    Array.isArray(data.organizations) &&
    data.organizations.every(org => isOrganization(org))
  )
}

/**
 * Type guard for WorkspacesResponse
 */
export function isWorkspacesResponse(data: unknown): data is WorkspacesResponse {
  if (!isApiSuccess(data)) return false

  return "workspaces" in data && Array.isArray(data.workspaces) && data.workspaces.every(w => typeof w === "string")
}

/**
 * Type guard for LoginResponse
 */
export function isLoginResponse(data: unknown): data is LoginResponse {
  return isApiSuccess(data)
}

/**
 * Type guard for LogoutResponse
 */
export function isLogoutResponse(data: unknown): data is LogoutResponse {
  return isApiSuccess(data) && "message" in data && typeof (data as LogoutResponse).message === "string"
}

/**
 * Type guard for VerifyResponse
 */
export function isVerifyResponse(data: unknown): data is VerifyResponse {
  return (
    isApiSuccess(data) &&
    "verified" in data &&
    "workspace" in data &&
    typeof (data as VerifyResponse).workspace === "string"
  )
}

/**
 * Type guard for TokensResponse
 */
export function isTokensResponse(data: unknown): data is TokensResponse {
  return (
    isApiSuccess(data) &&
    "tokens" in data &&
    "credits" in data &&
    "workspace" in data &&
    typeof (data as TokensResponse).tokens === "number" &&
    typeof (data as TokensResponse).credits === "number"
  )
}

/**
 * Type guard for DeployResponse
 */
export function isDeployResponse(data: unknown): data is DeployResponse {
  return (
    isApiSuccess(data) &&
    "message" in data &&
    "workspace" in data &&
    "url" in data &&
    typeof (data as DeployResponse).workspace === "string"
  )
}

/**
 * Type guard for CheckAvailabilityResponse
 */
export function isCheckAvailabilityResponse(data: unknown): data is CheckAvailabilityResponse {
  return (
    isApiSuccess(data) &&
    "available" in data &&
    "domain" in data &&
    typeof (data as CheckAvailabilityResponse).available === "boolean"
  )
}

/**
 * Type guard for ImageUploadResponse
 */
export function isImageUploadResponse(data: unknown): data is ImageUploadResponse {
  return (
    isApiSuccess(data) &&
    "key" in data &&
    "url" in data &&
    typeof (data as ImageUploadResponse).key === "string"
  )
}

/**
 * Type guard for ImageListResponse
 */
export function isImageListResponse(data: unknown): data is ImageListResponse {
  return isApiSuccess(data) && "images" in data && Array.isArray((data as ImageListResponse).images)
}

/**
 * Type guard for FeedbackResponse
 */
export function isFeedbackResponse(data: unknown): data is FeedbackResponse {
  return isApiSuccess(data) && "message" in data && typeof (data as FeedbackResponse).message === "string"
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> & { ok: true } {
  return {
    ok: true,
    data,
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(error: string, message?: string): ApiError {
  return {
    ok: false,
    error,
    ...(message && { message }),
  }
}

/**
 * Assert that data matches a type guard, throw if not
 */
export function assertType<T>(data: unknown, guard: (data: unknown) => data is T, errorMessage?: string): asserts data is T {
  if (!guard(data)) {
    throw new Error(errorMessage || "Type assertion failed")
  }
}

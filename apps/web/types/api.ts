/**
 * API Response Types
 * Centralized type definitions for API endpoints
 */

// /api/tokens response
export interface TokensResponse {
  ok: true
  tokens: number
  credits: number
  workspace: string
}

export interface TokensErrorResponse {
  ok: false
  error: string
}

export type TokensAPIResponse = TokensResponse | TokensErrorResponse

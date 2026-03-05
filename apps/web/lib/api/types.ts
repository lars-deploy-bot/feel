/**
 * Shared API Types
 *
 * Single source of truth for API request/response types.
 * Used by both API routes and frontend consumers.
 */

import type { OrgRole } from "@webalive/shared"

// ============================================================================
// Base Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  ok: boolean
  error?: string
  message?: string
  data?: T
}

// ============================================================================
// Auth API Types
// ============================================================================

export interface Organization {
  org_id: string
  name: string
  credits: number
  workspace_count: number
  role: OrgRole
}

export interface OrganizationsResponse {
  ok: true
  organizations: Organization[]
  current_user_id: string
}

export interface WorkspacesResponse {
  ok: true
  workspaces: string[]
}

export interface TokensResponse {
  ok: true
  tokens: number
  credits: number
  workspace: string
}

export type TokensAPIResponse = TokensResponse | { ok: false; error: string }

// ============================================================================
// Referral API Types
// ============================================================================

export interface ReferralData {
  inviteCode: string
  inviteLink: string
  stats: {
    totalReferrals: number
    creditsEarned: number
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createSuccessResponse<T>(data: T): ApiResponse<T> & { ok: true } {
  return {
    ok: true,
    data,
  }
}

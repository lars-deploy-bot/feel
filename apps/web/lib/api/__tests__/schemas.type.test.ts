/**
 * Type Tests for API Schema System
 *
 * These tests verify compile-time type safety using Vitest's expectTypeOf.
 * They are PURE TYPE TESTS - they verify types without executing code.
 *
 * Run: bun run test schemas.type.test.ts
 */

import { describe, expectTypeOf, it } from "vitest"
import type { ApiError } from "../api-client"
import type { Endpoint, Params, Query, Req, ReqInput, Res } from "../schemas"
import { validateRequest } from "../schemas"

describe("API Schema Type System", () => {
  describe("Endpoint type", () => {
    it("should only allow defined endpoints", () => {
      expectTypeOf<Endpoint>().toEqualTypeOf<
        | "login"
        | "user"
        | "feedback"
        | "signup"
        | "deploy"
        | "claude/stream/cancel"
        | "templates"
        | "manager/orgs"
        | "manager/templates"
        | "manager/templates/create"
        | "manager/templates/update"
        | "manager/templates/delete"
        | "auth/organizations"
        | "auth/all-workspaces"
        | "auth/workspaces"
        | "auth/org-members"
        | "auth/org-members/create"
        | "auth/org-members/delete"
        | "auth/organizations/update"
        | "user/update"
        | "deploy-subdomain"
        | "import-repo"
        | "automations"
        | "automations/enriched"
        | "automations/create"
        | "automations/get-by-id"
        | "automations/delete"
        | "automations/trigger"
        | "automations/update"
        | "automations/runs"
        | "automations/run"
        | "sessions/send"
        | "sites"
        | "worktrees"
        | "worktrees/create"
        | "worktrees/delete"
        | "integrations/available"
        | "integrations/disconnect"
        | "integrations/connect"
        | "gmail/send"
        | "gmail/draft"
        | "outlook/send"
        | "outlook/draft"
        | "drive/list"
        | "drive/read"
        | "drive/delete"
        | "google/calendar/create-event"
        | "google/calendar/delete-event"
        | "google/calendar/update-event"
        | "rename-site"
        | "user-env-keys"
        | "user-env-keys/create"
        | "user-env-keys/delete"
        | "auth/sessions"
        | "auth/sessions/revoke"
        | "auth/sessions/revoke-others"
        | "sessions/list"
        | "sessions/history"
        | "linear/issues"
        | "sites/check-availability"
        | "sites/metadata"
        | "referrals/history"
        | "conversations/list"
        | "conversations/messages"
        | "images/list"
        | "voice/transcribe"
        | "polar/billing"
        | "polar/checkout"
      >()
    })

    it("should be a union of string literals", () => {
      expectTypeOf<Endpoint>().toBeString()
      expectTypeOf<Endpoint>().not.toEqualTypeOf<string>() // Not just any string
    })
  })

  describe("Request types (Req<E>)", () => {
    it("should extract login request type with brand", () => {
      type LoginReq = Req<"login">

      // Should have required properties
      expectTypeOf<LoginReq>().toHaveProperty("email")
      expectTypeOf<LoginReq>().toHaveProperty("password")

      // Should be branded (not assignable from plain object)
      type PlainObj = { email: string; password: string }
      expectTypeOf<PlainObj>().not.toMatchTypeOf<LoginReq>()
    })

    it("should extract feedback request type with brand", () => {
      type FeedbackReq = Req<"feedback">

      expectTypeOf<FeedbackReq>().toHaveProperty("feedback")
      expectTypeOf<FeedbackReq>().toMatchTypeOf<{ feedback: string }>()

      // Optional properties should be optional
      expectTypeOf<FeedbackReq>().toHaveProperty("email")
      expectTypeOf<FeedbackReq>().toHaveProperty("workspace")
      expectTypeOf<FeedbackReq>().toHaveProperty("conversationId")
    })

    it("should infer never for user GET endpoint (no request schema)", () => {
      type UserReq = Req<"user">

      expectTypeOf<UserReq>().toEqualTypeOf<never>()
    })

    it("should not allow plain objects as branded types", () => {
      type LoginReq = Req<"login">
      type PlainLogin = { email: string; password: string }

      // Plain object is NOT the same as branded type
      expectTypeOf<PlainLogin>().not.toEqualTypeOf<LoginReq>()
      expectTypeOf<PlainLogin>().not.toMatchTypeOf<LoginReq>()
    })
  })

  describe("Request input types (ReqInput<E>)", () => {
    it("should model raw input separately from branded output", () => {
      type LoginInput = ReqInput<"login">
      type LoginReq = Req<"login">

      expectTypeOf<LoginInput>().toEqualTypeOf<{ email: string; password: string }>()
      expectTypeOf<LoginInput>().not.toEqualTypeOf<LoginReq>()
    })

    it("should enforce undefined input for no-body mutation endpoints", () => {
      expectTypeOf<ReqInput<"automations/trigger">>().toEqualTypeOf<undefined>()
      expectTypeOf<Record<string, never>>().not.toMatchTypeOf<ReqInput<"automations/trigger">>()
    })
  })

  describe("validateRequest typing", () => {
    it("allows undefined-body endpoints without payload", () => {
      validateRequest("automations/trigger")
      validateRequest("automations/trigger", undefined)
    })

    it("rejects object payload for undefined-body endpoints", () => {
      type TriggerInput = ReqInput<"automations/trigger">
      expectTypeOf<TriggerInput>().toEqualTypeOf<undefined>()
      expectTypeOf<Record<string, never>>().not.toMatchTypeOf<TriggerInput>()
    })

    it("requires payload for object-body endpoints", () => {
      type LoginInput = ReqInput<"login">
      expectTypeOf<LoginInput>().toEqualTypeOf<{ email: string; password: string }>()
      expectTypeOf<LoginInput>().not.toEqualTypeOf<undefined>()
    })
  })

  describe("Response types (Res<E>)", () => {
    it("should infer login response type correctly", () => {
      type LoginRes = Res<"login">

      expectTypeOf<LoginRes>().toMatchTypeOf<{ ok: boolean }>()
      expectTypeOf<LoginRes>().toHaveProperty("ok")
      expectTypeOf<LoginRes>().toHaveProperty("userId")
      expectTypeOf<LoginRes>().toHaveProperty("error")
    })

    it("should infer user response type with nullable user", () => {
      type UserRes = Res<"user">

      expectTypeOf<UserRes>().toHaveProperty("user")
      expectTypeOf<UserRes>().toMatchTypeOf<{
        user: {
          id: string
          email: string
          name: string | null
          canSelectAnyModel: boolean
          isAdmin: boolean
          isSuperadmin: boolean
          enabledModels: string[]
        } | null
      }>()
    })

    it("should infer feedback response type", () => {
      type FeedbackRes = Res<"feedback">

      expectTypeOf<FeedbackRes>().toHaveProperty("ok")
      expectTypeOf<FeedbackRes>().toHaveProperty("id")
      expectTypeOf<FeedbackRes>().toHaveProperty("timestamp")
    })
  })

  describe("Params types (Params<E>)", () => {
    it("extracts params for dynamic automation endpoints", () => {
      expectTypeOf<Params<"automations/update">>().toEqualTypeOf<{ id: string }>()
      expectTypeOf<Params<"automations/get-by-id">>().toEqualTypeOf<{ id: string }>()
      expectTypeOf<Params<"automations/delete">>().toEqualTypeOf<{ id: string }>()
      expectTypeOf<Params<"automations/trigger">>().toEqualTypeOf<{ id: string }>()
      expectTypeOf<Params<"automations/runs">>().toEqualTypeOf<{ id: string }>()
      expectTypeOf<Params<"automations/run">>().toEqualTypeOf<{ id: string; runId: string }>()
    })

    it("extracts params for provider integration endpoints", () => {
      expectTypeOf<Params<"integrations/connect">>().toEqualTypeOf<{ provider: string }>()
      expectTypeOf<Params<"integrations/disconnect">>().toEqualTypeOf<{ provider: string }>()
    })

    it("returns never for endpoints without params schema", () => {
      expectTypeOf<Params<"login">>().toEqualTypeOf<never>()
      expectTypeOf<Params<"templates">>().toEqualTypeOf<never>()
    })
  })

  describe("Query types (Query<E>)", () => {
    it("extracts query params for list/detail endpoints", () => {
      expectTypeOf<Query<"automations">>().toEqualTypeOf<{
        org_id?: string
        site_id?: string
        limit: number
      }>()
      expectTypeOf<Query<"automations/runs">>().toEqualTypeOf<{
        limit: number
        offset: number
        status?: "success" | "failure" | "pending" | "running" | "skipped"
      }>()
      expectTypeOf<Query<"automations/run">>().toEqualTypeOf<{
        includeMessages: boolean
      }>()
    })

    it("returns never for endpoints without query schema", () => {
      expectTypeOf<Query<"login">>().toEqualTypeOf<never>()
      expectTypeOf<Query<"automations/update">>().toEqualTypeOf<never>()
    })
  })

  describe("API Error type", () => {
    it("should have correct error structure", () => {
      expectTypeOf<ApiError>().toHaveProperty("message")
      expectTypeOf<ApiError>().toHaveProperty("status")
      expectTypeOf<ApiError>().toHaveProperty("code")
      expectTypeOf<ApiError>().toHaveProperty("details")
    })
  })

  describe("Type safety guarantees", () => {
    it("should prevent mixing endpoint request types", () => {
      type LoginReq = Req<"login">
      type FeedbackReq = Req<"feedback">

      // Different endpoints have different branded types
      expectTypeOf<LoginReq>().not.toEqualTypeOf<FeedbackReq>()
      expectTypeOf<LoginReq>().not.toMatchTypeOf<FeedbackReq>()
    })

    it("should have distinct brands per endpoint", () => {
      type Login = Req<"login">
      type Feedback = Req<"feedback">
      type Trigger = Req<"automations/trigger">

      // All three should be different types
      expectTypeOf<Login>().not.toEqualTypeOf<Feedback>()
      expectTypeOf<Login>().not.toEqualTypeOf<Trigger>()
      expectTypeOf<Feedback>().not.toEqualTypeOf<Trigger>()
    })
  })

  describe("Optional and nullable fields", () => {
    it("should handle optional request fields correctly", () => {
      type FeedbackReq = Req<"feedback">

      // Feedback has required 'feedback' field
      expectTypeOf<FeedbackReq>().toHaveProperty("feedback")

      // Email is optional
      expectTypeOf<FeedbackReq>().toHaveProperty("email")
      expectTypeOf<FeedbackReq>().toHaveProperty("workspace")
    })

    it("should handle nullable response fields correctly", () => {
      type UserRes = Res<"user">

      // User is non-nullable (401 returned for unauthenticated requests)
      expectTypeOf<UserRes>().toEqualTypeOf<{
        user: {
          id: string
          email: string
          name: string | null
          firstName: string | null
          lastName: string | null
          canSelectAnyModel: boolean
          isAdmin: boolean
          isSuperadmin: boolean
          enabledModels: string[]
        }
      }>()
    })
  })

  describe("Branded type enforcement", () => {
    it("login request should require LoginRequest brand", () => {
      // The branded type includes the brand marker
      type LoginReq = Req<"login">
      type UnbrandedLogin = { email: string; password: string }

      // Branded type is NOT assignable from unbranded
      expectTypeOf<UnbrandedLogin>().not.toMatchTypeOf<LoginReq>()
    })

    it("feedback request should require FeedbackRequest brand", () => {
      type FeedbackReq = Req<"feedback">
      type UnbrandedFeedback = { feedback: string }

      // Branded type is NOT assignable from unbranded
      expectTypeOf<UnbrandedFeedback>().not.toMatchTypeOf<FeedbackReq>()
    })
  })
})

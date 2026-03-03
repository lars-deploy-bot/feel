import type { NextResponse } from "next/server"
import { describe, expectTypeOf, it } from "vitest"
import type { Params, Query, Req } from "../schemas"
import {
  type AlrightyOptions,
  type alrighty,
  type handleBody,
  type handleParams,
  handleQuery,
  handleRoute,
} from "../server"

describe("API server helper types", () => {
  it("handleBody accepts generic Request", () => {
    type HandleBodyReqParam = Parameters<typeof handleBody>[1]
    expectTypeOf<HandleBodyReqParam>().toEqualTypeOf<Request>()
  })

  it("handleBody is only callable for endpoints that define req", () => {
    type HandleBodyEndpoint = Parameters<typeof handleBody>[0]
    expectTypeOf<Extract<HandleBodyEndpoint, "login">>().toEqualTypeOf<"login">()
    expectTypeOf<Extract<HandleBodyEndpoint, "auth/sessions/revoke-others">>().toEqualTypeOf<never>()
  })

  it("handleRoute is only callable for endpoints that define params", () => {
    type HandleRouteEndpoint = Parameters<typeof handleRoute>[0]

    expectTypeOf<Extract<HandleRouteEndpoint, "automations/update">>().toEqualTypeOf<"automations/update">()
    expectTypeOf<Extract<HandleRouteEndpoint, "integrations/connect">>().toEqualTypeOf<"integrations/connect">()
    expectTypeOf<Extract<HandleRouteEndpoint, "login">>().toEqualTypeOf<never>()
  })

  it("handleParams accepts params-only endpoints", () => {
    type HandleParamsEndpoint = Parameters<typeof handleParams>[0]
    expectTypeOf<Extract<HandleParamsEndpoint, "automations/get-by-id">>().toEqualTypeOf<"automations/get-by-id">()
    expectTypeOf<Extract<HandleParamsEndpoint, "login">>().toEqualTypeOf<never>()
  })

  it("handleQuery is only callable for endpoints that define query", () => {
    type HandleQueryEndpoint = Parameters<typeof handleQuery>[0]
    expectTypeOf<Extract<HandleQueryEndpoint, "automations">>().toEqualTypeOf<"automations">()
    expectTypeOf<Extract<HandleQueryEndpoint, "automations/runs">>().toEqualTypeOf<"automations/runs">()
    expectTypeOf<Extract<HandleQueryEndpoint, "login">>().toEqualTypeOf<never>()
  })

  it("handleRoute success return includes typed params", () => {
    async function callHandleRoute(req: Request) {
      return handleRoute("automations/update", req, {
        params: { id: "job_123" },
      })
    }

    expectTypeOf<Awaited<ReturnType<typeof callHandleRoute>>>().toEqualTypeOf<
      { body: Req<"automations/update">; params: Params<"automations/update"> } | NextResponse
    >()
  })

  it("handleQuery success return includes typed query fields", () => {
    async function callHandleQuery(req: Request) {
      return handleQuery("automations/runs", req)
    }

    expectTypeOf<Awaited<ReturnType<typeof callHandleQuery>>>().toEqualTypeOf<
      Query<"automations/runs"> | NextResponse
    >()
  })

  it("alrighty still accepts both AlrightyOptions and ResponseInit", () => {
    type AlrightyThirdArg = Parameters<typeof alrighty>[2]
    type NonNullableThirdArg = Exclude<AlrightyThirdArg, undefined>

    type AcceptsResponseInit = ResponseInit extends NonNullableThirdArg ? true : false
    type AcceptsAlrightyOptions = AlrightyOptions extends NonNullableThirdArg ? true : false

    expectTypeOf<AcceptsResponseInit>().toEqualTypeOf<true>()
    expectTypeOf<AcceptsAlrightyOptions>().toEqualTypeOf<true>()
  })

  it("rejects invalid endpoint/params combinations at compile time", () => {
    // login has no params schema → should not be accepted by handleRoute
    type HandleRouteEndpoint = Parameters<typeof handleRoute>[0]
    expectTypeOf<Extract<HandleRouteEndpoint, "login">>().toEqualTypeOf<never>()

    // auth/sessions/revoke-others has no req schema → should not be accepted by handleBody
    type HandleBodyEndpoint = Parameters<typeof handleBody>[0]
    expectTypeOf<Extract<HandleBodyEndpoint, "auth/sessions/revoke-others">>().toEqualTypeOf<never>()
  })
})

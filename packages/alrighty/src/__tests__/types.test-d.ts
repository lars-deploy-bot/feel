import { assertType, describe, expectTypeOf, it } from "vitest"
import { z } from "zod"
import {
  createClient,
  type Endpoint,
  type MutationEndpoint,
  type Params,
  type Query,
  type ReadEndpoint,
  type Req,
  type Res,
  type SchemaRegistry,
} from "../index.js"

// Test schema registry
const schemas = {
  // GET - no req
  user: {
    res: z.object({ id: z.string(), email: z.string() }),
  },
  // POST - has req
  login: {
    req: z.object({ email: z.string(), password: z.string() }),
    res: z.object({ ok: z.boolean(), token: z.string().optional() }),
  },
  // PUT - has req
  update: {
    req: z.object({ name: z.string() }),
    res: z.object({ ok: z.boolean() }),
  },
  // POST - no req (bodyless action/trigger)
  trigger: {
    res: z.object({ ok: z.boolean(), count: z.number() }),
  },
} satisfies SchemaRegistry

type TestSchemas = typeof schemas

describe("Type Tests", () => {
  describe("Endpoint type", () => {
    it("extracts endpoint names as string union", () => {
      expectTypeOf<Endpoint<TestSchemas>>().toEqualTypeOf<"user" | "login" | "update" | "trigger">()
    })
  })

  describe("MutationEndpoint type", () => {
    it("extracts only endpoints with req schema", () => {
      expectTypeOf<MutationEndpoint<TestSchemas>>().toEqualTypeOf<"login" | "update">()
    })
  })

  describe("ReadEndpoint type", () => {
    it("extracts only endpoints without req schema", () => {
      expectTypeOf<ReadEndpoint<TestSchemas>>().toEqualTypeOf<"user" | "trigger">()
    })
  })

  describe("Req type", () => {
    it("extracts request type for POST endpoint", () => {
      type LoginReq = Req<TestSchemas, "login">
      expectTypeOf<LoginReq>().toEqualTypeOf<{ email: string; password: string }>()
    })

    it("returns never for GET endpoint without req", () => {
      type UserReq = Req<TestSchemas, "user">
      expectTypeOf<UserReq>().toEqualTypeOf<never>()
    })
  })

  describe("Res type", () => {
    it("extracts response type correctly", () => {
      type UserRes = Res<TestSchemas, "user">
      expectTypeOf<UserRes>().toEqualTypeOf<{ id: string; email: string }>()
    })

    it("handles optional fields in response", () => {
      type LoginRes = Res<TestSchemas, "login">
      expectTypeOf<LoginRes>().toEqualTypeOf<{ ok: boolean; token?: string }>()
    })
  })

  describe("Params type", () => {
    const paramsSchemas = {
      "items/update": {
        params: z.object({ id: z.string() }),
        req: z.object({ name: z.string() }),
        res: z.object({ ok: z.boolean() }),
      },
      "items/list": {
        res: z.object({ items: z.array(z.string()) }),
      },
    } satisfies SchemaRegistry

    it("extracts params type when schema has params", () => {
      expectTypeOf<Params<typeof paramsSchemas, "items/update">>().toEqualTypeOf<{ id: string }>()
    })

    it("returns never when schema has no params", () => {
      expectTypeOf<Params<typeof paramsSchemas, "items/list">>().toEqualTypeOf<never>()
    })

    it("returns never for schemas from the main test registry (no params)", () => {
      expectTypeOf<Params<TestSchemas, "user">>().toEqualTypeOf<never>()
      expectTypeOf<Params<TestSchemas, "login">>().toEqualTypeOf<never>()
    })
  })

  describe("Query type", () => {
    const querySchemas = {
      "items/list": {
        query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().optional() }),
        res: z.object({ items: z.array(z.string()) }),
      },
      "items/get": {
        params: z.object({ id: z.string() }),
        res: z.object({ item: z.string() }),
      },
    } satisfies SchemaRegistry

    it("extracts query type when schema has query", () => {
      expectTypeOf<Query<typeof querySchemas, "items/list">>().toEqualTypeOf<{ limit: number; cursor?: string }>()
    })

    it("returns never when schema has no query", () => {
      expectTypeOf<Query<typeof querySchemas, "items/get">>().toEqualTypeOf<never>()
      expectTypeOf<Query<TestSchemas, "user">>().toEqualTypeOf<never>()
    })
  })

  describe("EndpointSchema allows params to be optional", () => {
    it("accepts schemas with and without params", () => {
      const mixed = {
        noParams: { res: z.object({ ok: z.boolean() }) },
        withParams: {
          params: z.object({ id: z.string() }),
          res: z.object({ ok: z.boolean() }),
        },
        withQuery: {
          query: z.object({ limit: z.coerce.number() }),
          res: z.object({ ok: z.boolean() }),
        },
      } satisfies SchemaRegistry

      assertType<SchemaRegistry>(mixed)
    })
  })

  describe("createClient return types", () => {
    const { getty, postty, putty, patchy, deletty } = createClient(schemas)

    it("getty returns correct response type", async () => {
      const result = await getty("user")
      expectTypeOf(result).toEqualTypeOf<{ id: string; email: string }>()
    })

    it("getty does not accept body parameter", () => {
      // @ts-expect-error - getty should not have body parameter
      getty("user", { body: {} })
    })

    it("postty requires correct body type", async () => {
      const result = await postty("login", { email: "test@test.com", password: "123" })
      expectTypeOf(result).toEqualTypeOf<{ ok: boolean; token?: string }>()
    })

    it("postty supports bodyless POST for endpoints without req", () => {
      assertType<Promise<{ ok: boolean; count: number }>>(postty("trigger"))
    })

    it("postty supports bodyless POST with pathOverride", () => {
      assertType<Promise<{ ok: boolean; count: number }>>(postty("trigger", undefined, "/api/custom"))
    })

    it("postty rejects wrong body type", () => {
      // @ts-expect-error - wrong body shape
      postty("login", { wrong: "shape" })
    })

    it("postty rejects missing required fields", () => {
      // @ts-expect-error - missing password
      postty("login", { email: "test@test.com" })
    })

    it("putty requires correct body type", async () => {
      const result = await putty("update", { name: "Test" })
      expectTypeOf(result).toEqualTypeOf<{ ok: boolean }>()
    })

    it("putty rejects GET-only endpoints", () => {
      // @ts-expect-error - user is GET only
      putty("user", undefined)
    })

    it("patchy requires correct body type", () => {
      assertType<Promise<{ ok: boolean }>>(patchy("update", { name: "Test" }))
    })

    it("patchy rejects GET-only endpoints", () => {
      // @ts-expect-error - user is GET only
      patchy("user", undefined)
    })

    it("deletty works on any endpoint", () => {
      // deletty should work on both GET and mutation endpoints
      assertType<Promise<{ id: string; email: string }>>(deletty("user"))
      assertType<Promise<{ ok: boolean; token?: string }>>(deletty("login"))
      assertType<Promise<{ ok: boolean; token?: string }>>(deletty("login", { email: "", password: "" }))
    })

    it("deletty validates DELETE body shape when provided", () => {
      // @ts-expect-error - missing password
      deletty("login", { email: "" })
    })
  })

  describe("endpoint name type safety", () => {
    const { getty, postty } = createClient(schemas)

    it("rejects invalid endpoint names", () => {
      // @ts-expect-error - invalid endpoint
      getty("nonexistent")
    })

    it("accepts valid endpoint names", () => {
      assertType<Promise<{ id: string; email: string }>>(getty("user"))
      assertType<Promise<{ ok: boolean; token?: string }>>(postty("login", { email: "", password: "" }))
    })
  })

  describe("ClientOptions types", () => {
    it("accepts valid options", () => {
      createClient(schemas, {
        basePath: "/v2",
        credentials: "include",
        headers: { Authorization: "Bearer token" },
      })
    })

    it("accepts Record<string, string> headers", () => {
      createClient(schemas, { headers: { "X-Custom": "value" } })
    })

    it("rejects Headers instance", () => {
      // @ts-expect-error - Headers instance not allowed, use Record<string, string>
      createClient(schemas, { headers: new Headers({ "X-Custom": "value" }) })
    })
  })

  describe("SchemaRegistry constraint", () => {
    it("requires res in every endpoint", () => {
      // @ts-expect-error - missing res property
      const _badSchemas: SchemaRegistry = { noRes: { req: z.object({}) } }
    })

    it("allows req to be optional", () => {
      const goodSchemas = {
        getOnly: { res: z.object({ ok: z.boolean() }) },
      } satisfies SchemaRegistry

      assertType<SchemaRegistry>(goodSchemas)
    })
  })
})

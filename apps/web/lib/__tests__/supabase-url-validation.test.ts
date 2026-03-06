import { describe, expect, it } from "vitest"
import { supabaseUrl } from "@webalive/env"
import { supabaseClientSchema, supabaseServerSchema } from "@/lib/env/schema"

describe("supabase URL validation", () => {
  it("accepts HTTPS and loopback HTTP URLs", () => {
    expect(() => supabaseUrl.parse("https://project.supabase.co")).not.toThrow()
    expect(() => supabaseUrl.parse("http://127.0.0.1:18000")).not.toThrow()
    expect(() => supabaseUrl.parse("http://localhost:54321")).not.toThrow()
  })

  it("rejects non-loopback HTTP URLs", () => {
    expect(() => supabaseUrl.parse("http://10.8.0.1:8000")).toThrow(
      "Must use HTTPS, or HTTP on localhost/127.0.0.1 for local Supabase",
    )
  })

  it("allows loopback HTTP in app Supabase env schemas", () => {
    expect(() =>
      supabaseServerSchema.parse({
        SUPABASE_URL: "http://127.0.0.1:18000",
        SUPABASE_ANON_KEY: "eyJ.test",
        SUPABASE_SERVICE_ROLE_KEY: "eyJ.test",
      }),
    ).not.toThrow()

    expect(() =>
      supabaseClientSchema.parse({
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:18000",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJ.test",
      }),
    ).not.toThrow()
  })
})

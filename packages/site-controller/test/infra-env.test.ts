import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  loadCanonicalInfraEnvFromFile,
  mergeCanonicalInfraEnv,
  readCanonicalInfraEnvFromProcess,
} from "../src/infra-env"

describe("loadCanonicalInfraEnvFromFile", () => {
  it("loads only infra-critical production keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "infra-env-"))
    const envFile = join(dir, ".env.production")

    try {
      writeFileSync(
        envFile,
        [
          "DATABASE_URL=postgresql://prod-db",
          "DATABASE_PASSWORD=secret",
          "E2B_DOMAIN=e2b.test.example",
          "SUPABASE_URL=https://prod.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY=prod-service-role",
          "NEXT_PUBLIC_SUPABASE_URL=https://browser.supabase.co",
        ].join("\n"),
        "utf-8",
      )

      expect(loadCanonicalInfraEnvFromFile(envFile)).toEqual({
        DATABASE_URL: "postgresql://prod-db",
        DATABASE_PASSWORD: "secret",
        E2B_DOMAIN: "e2b.test.example",
        SUPABASE_URL: "https://prod.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "prod-service-role",
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("throws when the canonical env file is missing", () => {
    const missingFile = join(tmpdir(), "does-not-exist.env")
    expect(() => loadCanonicalInfraEnvFromFile(missingFile)).toThrow("Canonical infra env file not found")
  })
})

describe("readCanonicalInfraEnvFromProcess", () => {
  it("reads only infra-critical keys from runtime env", () => {
    expect(
      readCanonicalInfraEnvFromProcess({
        DATABASE_URL: "postgresql://runtime-db",
        DATABASE_PASSWORD: "runtime-secret",
        E2B_DOMAIN: "e2b.runtime.tech",
        SUPABASE_URL: "https://runtime.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "runtime-service-role",
        NEXT_PUBLIC_SUPABASE_URL: "https://browser.supabase.co",
      }),
    ).toEqual({
      DATABASE_URL: "postgresql://runtime-db",
      DATABASE_PASSWORD: "runtime-secret",
      E2B_DOMAIN: "e2b.runtime.tech",
      SUPABASE_URL: "https://runtime.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "runtime-service-role",
    })
  })

  it("omits missing or empty runtime values", () => {
    expect(
      readCanonicalInfraEnvFromProcess({
        DATABASE_URL: "",
        SUPABASE_URL: "https://runtime.supabase.co",
      }),
    ).toEqual({
      SUPABASE_URL: "https://runtime.supabase.co",
    })
  })
})

describe("mergeCanonicalInfraEnv", () => {
  it("prefers runtime values and backfills missing keys from file env", () => {
    expect(
      mergeCanonicalInfraEnv(
        {
          DATABASE_URL: "postgresql://prod-db",
          E2B_DOMAIN: "e2b.prod.tech",
          SUPABASE_URL: "https://prod.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "prod-service-role",
        },
        {
          SUPABASE_URL: "https://staging.supabase.local",
          SUPABASE_SERVICE_ROLE_KEY: "staging-service-role",
        },
      ),
    ).toEqual({
      DATABASE_URL: "postgresql://prod-db",
      E2B_DOMAIN: "e2b.prod.tech",
      SUPABASE_URL: "https://staging.supabase.local",
      SUPABASE_SERVICE_ROLE_KEY: "staging-service-role",
    })
  })
})

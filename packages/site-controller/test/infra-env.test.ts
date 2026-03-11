import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { loadCanonicalInfraEnvFromFile } from "../src/infra-env"

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
          "E2B_DOMAIN=e2b.sonno.tech",
          "SUPABASE_URL=https://prod.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY=prod-service-role",
          "NEXT_PUBLIC_SUPABASE_URL=https://browser.supabase.co",
        ].join("\n"),
        "utf-8",
      )

      expect(loadCanonicalInfraEnvFromFile(envFile)).toEqual({
        DATABASE_URL: "postgresql://prod-db",
        DATABASE_PASSWORD: "secret",
        E2B_DOMAIN: "e2b.sonno.tech",
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

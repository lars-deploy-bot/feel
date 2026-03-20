import { describe, expect, it } from "vitest"
import { environments } from "../environments"

describe("environments", () => {
  it("points staging and production at isolated build directories", () => {
    expect(environments.production.serverScript).toBe(".builds/production/standalone/apps/web/server.js")
    expect(environments.staging.serverScript).toBe(".builds/staging/standalone/apps/web/server.js")
  })
})

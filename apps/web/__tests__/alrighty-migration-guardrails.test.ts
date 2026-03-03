import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function collectRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectRouteFiles(full))
      continue
    }
    if (entry === "route.ts") {
      files.push(full)
    }
  }

  return files
}

describe("alrighty migration guardrails", () => {
  it("forces handleQuery usage on migrated GET query routes", () => {
    const checks = [
      "app/api/automations/route.ts",
      "app/api/sites/route.ts",
      "app/api/worktrees/route.ts",
      "app/api/auth/org-members/route.ts",
      "app/api/auth/workspaces/route.ts",
      "app/api/sessions/route.ts",
      "app/api/sessions/history/route.ts",
      "app/api/linear/issues/route.ts",
      "app/api/sites/check-availability/route.ts",
      "app/api/sites/metadata/route.ts",
      "app/api/referrals/history/route.ts",
      "app/api/conversations/route.ts",
      "app/api/conversations/messages/route.ts",
      "app/api/images/list/route.ts",
    ]

    for (const rel of checks) {
      const content = readFileSync(join(process.cwd(), rel), "utf-8")
      expect(content, `${rel} must use handleQuery()`).toContain("handleQuery(")
      expect(content, `${rel} must not use raw searchParams.get()`).not.toMatch(/searchParams\.get\(/)
    }
  })

  it("requires params validation helpers on dynamic automations routes", () => {
    const checks = [
      "app/api/automations/[id]/route.ts",
      "app/api/automations/[id]/trigger/route.ts",
      "app/api/automations/[id]/runs/route.ts",
      "app/api/automations/[id]/runs/[runId]/route.ts",
    ]

    for (const rel of checks) {
      const content = readFileSync(join(process.cwd(), rel), "utf-8")
      expect(content).toContain("handleParams(")
    }

    const updateRoute = readFileSync(join(process.cwd(), "app/api/automations/[id]/route.ts"), "utf-8")
    expect(updateRoute).toContain('handleRoute("automations/update"')
  })

  it("blocks cookie-loss pattern: no direct `return alrighty(...)` in cookie-mutating routes", () => {
    const routeFiles = collectRouteFiles(join(process.cwd(), "app/api"))

    for (const file of routeFiles) {
      const content = readFileSync(file, "utf-8")
      if (content.includes("cookies.set(") && content.includes("alrighty(")) {
        expect(content).not.toMatch(/\breturn\s+alrighty\(/)
      }
    }
  })

  it("blocks alrighty usage in stream responses", () => {
    const routeFiles = collectRouteFiles(join(process.cwd(), "app/api"))

    for (const file of routeFiles) {
      const content = readFileSync(file, "utf-8")
      const isStreamingRoute =
        content.includes("new ReadableStream") ||
        content.includes("text/event-stream") ||
        content.includes("application/x-ndjson")

      if (isStreamingRoute) {
        expect(content).not.toContain("alrighty(")
      }
    }
  })

  it("VERBOTEN: no raw .json() in fully-migrated alrighty routes", () => {
    const routeFiles = collectRouteFiles(join(process.cwd(), "app/api"))

    for (const file of routeFiles) {
      const content = readFileSync(file, "utf-8")

      // Only check routes that use alrighty() for responses
      if (!content.includes("alrighty(")) continue

      const rel = file.replace(`${process.cwd()}/`, "")

      // NextResponse.json( and Response.json( are VERBOTEN in alrighty routes.
      // Use alrighty() for success responses, structuredErrorResponse() for errors.
      expect(
        content,
        "\n" +
          "╔══════════════════════════════════════════════════════════════╗\n" +
          "║  ACHTUNG! STRENG VERBOTEN!                                 ║\n" +
          "║                                                            ║\n" +
          `║  ${rel.padEnd(56)}  ║\n` +
          "║                                                            ║\n" +
          "║  You used .json() in an alrighty route. NEVER DO THIS!     ║\n" +
          "║                                                            ║\n" +
          "║  ✗ NextResponse.json(...)  → use alrighty()                ║\n" +
          "║  ✗ Response.json(...)      → use structuredErrorResponse() ║\n" +
          "║                                                            ║\n" +
          "║  Run: /alrighty to learn how. No excuses!                  ║\n" +
          "╚══════════════════════════════════════════════════════════════╝",
      ).not.toMatch(/(?:NextResponse|Response)\.json\(/)
    }
  })

  it("protects webhook raw-body signature verification flow", () => {
    const routePath = join(process.cwd(), "app/api/webhook/deploy/route.ts")
    const content = readFileSync(routePath, "utf-8")

    expect(content).toContain("const payload = await req.text()")
    expect(content).toContain("verifySignature(payload, signature)")
    expect(content).not.toContain("handleBody(")

    const rawBodyIndex = content.indexOf("const payload = await req.text()")
    const verifyIndex = content.indexOf("verifySignature(payload, signature)")
    expect(rawBodyIndex).toBeGreaterThan(-1)
    expect(verifyIndex).toBeGreaterThan(rawBodyIndex)
  })
})

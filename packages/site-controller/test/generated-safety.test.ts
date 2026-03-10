import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  assertNoDangerousCountDrop,
  readExistingGeneratedCaddyDomainCount,
  readExistingPortMapCount,
} from "../src/generated-safety"

describe("generated-safety", () => {
  it("blocks implausible count drops for live-generated artifacts", () => {
    expect(() =>
      assertNoDangerousCountDrop({
        kind: "routing",
        filePath: "/tmp/generated",
        existingCount: 142,
        nextCount: 4,
      }),
    ).toThrow("Refusing to overwrite")
  })

  it("allows small or proportional count changes", () => {
    expect(() =>
      assertNoDangerousCountDrop({
        kind: "routing",
        filePath: "/tmp/generated",
        existingCount: 142,
        nextCount: 137,
      }),
    ).not.toThrow()
  })

  it("reads generated Caddy domain counts from the header", () => {
    const dir = mkdtempSync(join(tmpdir(), "generated-caddy-"))
    const filePath = join(dir, "Caddyfile.sites")

    try {
      writeFileSync(filePath, "# GENERATED FILE - DO NOT EDIT\n# domains: 137\n", "utf-8")
      expect(readExistingGeneratedCaddyDomainCount(filePath)).toBe(137)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("reads port-map entry counts from JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "generated-port-map-"))
    const filePath = join(dir, "port-map.json")

    try {
      writeFileSync(filePath, JSON.stringify({ a: 1, b: 2, c: 3 }), "utf-8")
      expect(readExistingPortMapCount(filePath)).toBe(3)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("returns 0 for malformed port-map JSON instead of crashing", () => {
    const dir = mkdtempSync(join(tmpdir(), "generated-port-map-malformed-"))
    const filePath = join(dir, "port-map.json")

    try {
      writeFileSync(filePath, "{ truncated", "utf-8")
      expect(readExistingPortMapCount(filePath)).toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

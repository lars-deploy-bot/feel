/**
 * Unit tests for sync.ts — static route building, Caddyfile generation,
 * hostname validation, and site count guard.
 */

import { describe, expect, it } from "vitest"
import { generateCaddyInternal, HOSTNAME_REGEX, isValidHostname, MIN_EXPECTED_SITES } from "../sync.js"

// ---------------------------------------------------------------------------
// isValidHostname
// ---------------------------------------------------------------------------

describe("isValidHostname", () => {
  it("accepts valid hostnames", () => {
    expect(isValidHostname("larry.alive.best")).toBe(true)
    expect(isValidHostname("blank.alive.best")).toBe(true)
    expect(isValidHostname("my-site.alive.best")).toBe(true)
    expect(isValidHostname("a.b.c.d.e")).toBe(true)
    expect(isValidHostname("x")).toBe(true)
  })

  it("rejects empty string", () => {
    expect(isValidHostname("")).toBe(false)
  })

  it("rejects hostnames with spaces", () => {
    expect(isValidHostname("has space.alive.best")).toBe(false)
  })

  it("rejects hostnames with special characters (Caddy injection)", () => {
    expect(isValidHostname('evil"; rm -rf /')).toBe(false)
    expect(isValidHostname("test\nhost")).toBe(false)
    expect(isValidHostname("test{host}")).toBe(false)
  })

  it("rejects hostnames starting or ending with hyphen", () => {
    expect(isValidHostname("-leading.alive.best")).toBe(false)
    expect(isValidHostname("trailing-.alive.best")).toBe(false)
  })

  it("rejects uppercase (DNS names are lowercase)", () => {
    expect(isValidHostname("UPPER.alive.best")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateCaddyInternal
// ---------------------------------------------------------------------------

describe("generateCaddyInternal", () => {
  it("generates valid Caddy map syntax with sites", () => {
    const sites = new Map([
      ["larry.alive.best", 3356],
      ["blank.alive.best", 3594],
    ])

    const output = generateCaddyInternal(sites, 5055)

    expect(output).toContain(":8444 {")
    expect(output).toContain("map {host} {site_upstream}")
    expect(output).toContain('blank.alive.best "localhost:3594"')
    expect(output).toContain('larry.alive.best "localhost:3356"')
    expect(output).toContain('*.alive.best "localhost:5055"')
    expect(output).toContain('default "localhost:5055"')
    expect(output).toContain("reverse_proxy {site_upstream}")
    expect(output).toContain("handle_path /_images/*")
    expect(output).toContain("handle_path /files/*")
  })

  it("sorts hostnames alphabetically", () => {
    const sites = new Map([
      ["zebra.alive.best", 3001],
      ["alpha.alive.best", 3002],
      ["middle.alive.best", 3003],
    ])

    const output = generateCaddyInternal(sites, 5055)
    const lines = output.split("\n")
    const siteLines = lines.filter(l => l.includes(".alive.best") && l.includes('"localhost:300'))
    expect(siteLines[0]).toContain("alpha.alive.best")
    expect(siteLines[1]).toContain("middle.alive.best")
    expect(siteLines[2]).toContain("zebra.alive.best")
  })

  it("skips invalid hostnames", () => {
    const sites = new Map([
      ["good.alive.best", 3001],
      ['evil"; drop table', 3002],
    ])

    const output = generateCaddyInternal(sites, 5055)
    expect(output).toContain("good.alive.best")
    expect(output).not.toContain("evil")
    expect(output).not.toContain("drop table")
  })

  it("uses provided preview proxy port", () => {
    const sites = new Map([["test.alive.best", 3001]])
    const output = generateCaddyInternal(sites, 9999)
    expect(output).toContain('*.alive.best "localhost:9999"')
    expect(output).toContain('default "localhost:9999"')
  })

  it("handles empty sites map", () => {
    const output = generateCaddyInternal(new Map(), 5055)
    expect(output).toContain(":8444 {")
    expect(output).toContain('*.alive.best "localhost:5055"')
    expect(output).toContain('default "localhost:5055"')
  })

  it("includes AUTO-GENERATED header", () => {
    const output = generateCaddyInternal(new Map(), 5055)
    expect(output).toContain("AUTO-GENERATED")
    expect(output).toContain("DO NOT EDIT MANUALLY")
  })

  it("includes image serving with immutable cache header", () => {
    const output = generateCaddyInternal(new Map(), 5055)
    expect(output).toContain("/srv/webalive/storage")
    expect(output).toContain("immutable")
  })

  it("includes per-site file serving", () => {
    const output = generateCaddyInternal(new Map(), 5055)
    expect(output).toContain("/srv/webalive/sites/{host}/user/.alive/files")
    expect(output).toContain("no-cache")
  })
})

// ---------------------------------------------------------------------------
// MIN_EXPECTED_SITES
// ---------------------------------------------------------------------------

describe("MIN_EXPECTED_SITES guard", () => {
  it("is a reasonable minimum (at least 10)", () => {
    expect(MIN_EXPECTED_SITES).toBeGreaterThanOrEqual(10)
  })
})

// ---------------------------------------------------------------------------
// HOSTNAME_REGEX
// ---------------------------------------------------------------------------

describe("HOSTNAME_REGEX", () => {
  it("matches standard DNS hostnames", () => {
    expect(HOSTNAME_REGEX.test("example.com")).toBe(true)
    expect(HOSTNAME_REGEX.test("sub.example.com")).toBe(true)
    expect(HOSTNAME_REGEX.test("a-b-c.example.com")).toBe(true)
  })

  it("rejects non-DNS strings", () => {
    expect(HOSTNAME_REGEX.test("")).toBe(false)
    expect(HOSTNAME_REGEX.test("has space")).toBe(false)
    expect(HOSTNAME_REGEX.test("-starts-with-dash")).toBe(false)
    expect(HOSTNAME_REGEX.test("ends-with-dash-")).toBe(false)
    expect(HOSTNAME_REGEX.test("has..double.dots")).toBe(false)
  })
})

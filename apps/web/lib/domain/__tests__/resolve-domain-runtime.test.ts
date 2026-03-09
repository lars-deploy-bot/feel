import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock("@/lib/supabase/app", () => ({
  createAppClient: vi.fn(() => ({ from: mockFrom })),
}))

const { resolveDomainRuntime } = await import("../resolve-domain-runtime")

describe("resolveDomainRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns DomainRuntime for a known domain", async () => {
    const domainData = {
      domain_id: "dom_123",
      hostname: "example.com",
      port: 3701,
      is_test_env: false,
      execution_mode: "e2b",
      sandbox_id: "sbx_abc",
      sandbox_status: "running",
    }
    mockSingle.mockResolvedValue({ data: domainData })

    const result = await resolveDomainRuntime("example.com")

    expect(result).toEqual(domainData)
    expect(mockFrom).toHaveBeenCalledWith("domains")
    expect(mockSelect).toHaveBeenCalledWith(
      "domain_id, hostname, port, is_test_env, execution_mode, sandbox_id, sandbox_status",
    )
    expect(mockEq).toHaveBeenCalledWith("hostname", "example.com")
  })

  it("returns null for an unknown domain", async () => {
    mockSingle.mockResolvedValue({ data: null })

    const result = await resolveDomainRuntime("nonexistent.com")

    expect(result).toBeNull()
  })

  it("returns systemd domain with null sandbox fields", async () => {
    const domainData = {
      domain_id: "dom_456",
      hostname: "systemd-site.com",
      port: 3700,
      is_test_env: null,
      execution_mode: "systemd",
      sandbox_id: null,
      sandbox_status: null,
    }
    mockSingle.mockResolvedValue({ data: domainData })

    const result = await resolveDomainRuntime("systemd-site.com")

    expect(result).toEqual(domainData)
    expect(result?.execution_mode).toBe("systemd")
    expect(result?.sandbox_id).toBeNull()
  })
})

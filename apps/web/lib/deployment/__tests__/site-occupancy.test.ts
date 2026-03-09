import { beforeEach, describe, expect, it, vi } from "vitest"

const existsSyncMock = vi.fn<(path: string) => boolean>()
const execFileSyncMock = vi.fn()

vi.mock("@/lib/config", () => ({
  WORKSPACE_BASE: "/srv/webalive/sites",
  buildSubdomain: (slug: string) => `${slug}.alive.best`,
}))

vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return {
    ...actual,
    existsSync: (input: string) => existsSyncMock(input),
  }
})

vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}))

const { inspectSiteOccupancy } = await import("../site-occupancy")

describe("inspectSiteOccupancy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existsSyncMock.mockReturnValue(false)
    execFileSyncMock.mockImplementation(() => "")
  })

  it("reports workspace directories as occupied", () => {
    existsSyncMock.mockImplementation(input => input === "/srv/webalive/sites/testsite.alive.best")

    expect(inspectSiteOccupancy("testsite")).toEqual({
      occupied: true,
      reason: "workspace directory exists",
    })
  })

  it("reports active systemd services as occupied when filesystem is clean", () => {
    execFileSyncMock.mockImplementation(() => "")

    expect(inspectSiteOccupancy("testsite")).toEqual({
      occupied: true,
      reason: "systemd service is still active",
    })
  })

  it("reports a slug as free when no resources remain", () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error("inactive")
    })

    expect(inspectSiteOccupancy("testsite")).toEqual({
      occupied: false,
    })
  })
})

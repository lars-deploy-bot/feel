import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const inspectSiteOccupancyMock = vi.fn()

vi.mock("@/lib/deployment/site-occupancy", () => ({
  inspectSiteOccupancy: (...args: unknown[]) => inspectSiteOccupancyMock(...args),
}))

const { GET } = await import("../route")

describe("GET /api/sites/check-availability", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inspectSiteOccupancyMock.mockReturnValue({ occupied: false })
  })

  it("returns available=true when host resources are clear", async () => {
    const response = await GET(new NextRequest("http://localhost/api/sites/check-availability?slug=testsite"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      available: true,
      slug: "testsite",
    })
  })

  it("returns available=false with a reason when host resources remain", async () => {
    inspectSiteOccupancyMock.mockReturnValueOnce({
      occupied: true,
      reason: "systemd service is still active",
    })

    const response = await GET(new NextRequest("http://localhost/api/sites/check-availability?slug=testsite"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      available: false,
      slug: "testsite",
      reason: "systemd service is still active",
    })
  })

  it("returns 400 for invalid slugs", async () => {
    const response = await GET(new NextRequest("http://localhost/api/sites/check-availability?slug=NOPE!"))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_SLUG" })
  })
})

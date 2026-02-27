import { describe, expect, it } from "vitest"
import { parseDeviceLabel } from "../device-label"

describe("parseDeviceLabel", () => {
  it("returns null for null input", () => {
    expect(parseDeviceLabel(null)).toBeNull()
  })

  it("parses Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    expect(parseDeviceLabel(ua)).toBe("Chrome on macOS")
  })

  it("parses Safari on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    expect(parseDeviceLabel(ua)).toBe("Safari on macOS")
  })

  it("parses Firefox on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
    expect(parseDeviceLabel(ua)).toBe("Firefox on Windows")
  })

  it("parses Edge on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
    expect(parseDeviceLabel(ua)).toBe("Edge on Windows")
  })

  it("parses Chrome on iPhone (CriOS)", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1"
    expect(parseDeviceLabel(ua)).toBe("Chrome on iOS")
  })

  it("parses Chrome on Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36"
    expect(parseDeviceLabel(ua)).toBe("Chrome on Android")
  })

  it("parses Safari on iPhone", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    expect(parseDeviceLabel(ua)).toBe("Safari on iOS")
  })

  it("parses Chrome on Linux", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    expect(parseDeviceLabel(ua)).toBe("Chrome on Linux")
  })

  it("handles unknown browser/OS", () => {
    const ua = "SomeBot/1.0"
    expect(parseDeviceLabel(ua)).toBe("Unknown Browser on Unknown OS")
  })
})

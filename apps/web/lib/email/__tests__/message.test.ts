import { describe, expect, it } from "vitest"
import { base64UrlEncode, createRawEmail } from "../message"

describe("createRawEmail", () => {
  it("builds base64url-encoded RFC 2822 message", () => {
    const raw = createRawEmail({
      from: "sender@test.com",
      to: ["a@test.com"],
      subject: "Hello",
      body: "World",
    })

    const decoded = Buffer.from(raw, "base64").toString("utf-8")
    expect(decoded).toContain("From: <sender@test.com>")
    expect(decoded).toContain("To: a@test.com")
    expect(decoded).toContain("Subject: Hello")
    expect(decoded).toContain("MIME-Version: 1.0")
    expect(decoded).toContain("Content-Type: text/plain; charset=utf-8")
    expect(decoded).toContain("World")
  })

  it("includes Cc header when cc is provided", () => {
    const raw = createRawEmail({
      from: "s@t.com",
      to: ["a@t.com"],
      cc: ["b@t.com", "c@t.com"],
      subject: "Hi",
      body: "Hey",
    })

    const decoded = Buffer.from(raw, "base64").toString("utf-8")
    expect(decoded).toContain("Cc: b@t.com, c@t.com")
  })

  it("includes Bcc header when bcc is provided", () => {
    const raw = createRawEmail({
      from: "s@t.com",
      to: ["a@t.com"],
      bcc: ["hidden@t.com"],
      subject: "Hi",
      body: "Hey",
    })

    const decoded = Buffer.from(raw, "base64").toString("utf-8")
    expect(decoded).toContain("Bcc: hidden@t.com")
  })

  it("omits Cc and Bcc headers when not provided", () => {
    const raw = createRawEmail({
      from: "s@t.com",
      to: ["a@t.com"],
      subject: "Hi",
      body: "Hey",
    })

    const decoded = Buffer.from(raw, "base64").toString("utf-8")
    expect(decoded).not.toContain("Cc:")
    expect(decoded).not.toContain("Bcc:")
  })

  it("omits Cc when cc is empty array", () => {
    const raw = createRawEmail({
      from: "s@t.com",
      to: ["a@t.com"],
      cc: [],
      subject: "Hi",
      body: "Hey",
    })

    const decoded = Buffer.from(raw, "base64").toString("utf-8")
    expect(decoded).not.toContain("Cc:")
  })

  it("joins multiple To addresses", () => {
    const raw = createRawEmail({
      from: "s@t.com",
      to: ["a@t.com", "b@t.com"],
      subject: "Hi",
      body: "Hey",
    })

    const decoded = Buffer.from(raw, "base64").toString("utf-8")
    expect(decoded).toContain("To: a@t.com, b@t.com")
  })
})

describe("base64UrlEncode", () => {
  it("replaces + with - and / with _", () => {
    // Characters that would produce + and / in standard base64
    const result = base64UrlEncode("subjects?")
    expect(result).not.toContain("+")
    expect(result).not.toContain("/")
  })

  it("strips trailing padding", () => {
    const result = base64UrlEncode("a")
    expect(result).not.toContain("=")
  })
})

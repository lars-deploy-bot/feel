import { describe, expect, it } from "vitest"
import { getSystemPrompt } from "../systemPrompt"

describe("getSystemPrompt", () => {
  // --- No email providers ---

  it("omits email instructions when no providers connected", () => {
    const prompt = getSystemPrompt({ connectedEmailProviders: [] })

    expect(prompt).not.toContain("GMAIL:")
    expect(prompt).not.toContain("OUTLOOK:")
    expect(prompt).not.toContain("compose_email")
  })

  it("omits email instructions by default (no param)", () => {
    const prompt = getSystemPrompt()

    expect(prompt).not.toContain("compose_email")
  })

  // --- Gmail (pipeline ready) ---

  it("includes Gmail compose instruction when gmail connected", () => {
    const prompt = getSystemPrompt({ connectedEmailProviders: ["gmail"] })

    expect(prompt).toContain("GMAIL:")
    expect(prompt).toContain("mcp__gmail__compose_email")
    expect(prompt).toContain("Never write emails as plain text")
  })

  // --- Outlook (pipeline ready) ---

  it("includes Outlook compose instruction when outlook connected", () => {
    const prompt = getSystemPrompt({ connectedEmailProviders: ["outlook"] })

    expect(prompt).toContain("OUTLOOK:")
    expect(prompt).toContain("mcp__outlook__compose_email")
    expect(prompt).toContain("Never write emails as plain text")
  })

  // --- Both providers ---

  it("includes both Gmail and Outlook compose when both are connected", () => {
    const prompt = getSystemPrompt({ connectedEmailProviders: ["gmail", "outlook"] })

    expect(prompt).toContain("GMAIL:")
    expect(prompt).toContain("mcp__gmail__compose_email")
    expect(prompt).toContain("OUTLOOK:")
    expect(prompt).toContain("mcp__outlook__compose_email")
  })

  it("includes disambiguation instruction when multiple email providers connected", () => {
    const prompt = getSystemPrompt({ connectedEmailProviders: ["gmail", "outlook"] })

    expect(prompt).toContain("MULTIPLE EMAIL ACCOUNTS:")
    expect(prompt).toContain("ask which one to use")
  })

  it("omits disambiguation instruction when only one email provider connected", () => {
    const gmailOnly = getSystemPrompt({ connectedEmailProviders: ["gmail"] })
    const outlookOnly = getSystemPrompt({ connectedEmailProviders: ["outlook"] })

    expect(gmailOnly).not.toContain("MULTIPLE EMAIL ACCOUNTS:")
    expect(outlookOnly).not.toContain("MULTIPLE EMAIL ACCOUNTS:")
  })

  // --- Stripe ---

  it("includes Stripe instruction when hasStripeMcpAccess is true", () => {
    const prompt = getSystemPrompt({ hasStripeMcpAccess: true })

    expect(prompt).toContain("STRIPE:")
  })

  it("omits Stripe instruction when hasStripeMcpAccess is false", () => {
    const prompt = getSystemPrompt({ hasStripeMcpAccess: false })

    expect(prompt).not.toContain("STRIPE:")
  })

  // --- Context injection ---

  it("includes project when provided", () => {
    const prompt = getSystemPrompt({ projectId: "proj-123" })

    expect(prompt).toContain("Project: proj-123")
  })
})

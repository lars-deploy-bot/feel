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

  // --- Outlook (pipeline NOT ready yet) ---

  it("does NOT include Outlook compose instruction because send pipeline is not wired", () => {
    const prompt = getSystemPrompt({ connectedEmailProviders: ["outlook"] })

    // Outlook compose tool must NOT appear until UI renderer + send endpoint exist
    expect(prompt).not.toContain("OUTLOOK:")
    expect(prompt).not.toContain("mcp__outlook__compose_email")
  })

  // --- Both providers ---

  it("includes Gmail but not Outlook compose when both are connected", () => {
    const prompt = getSystemPrompt({ connectedEmailProviders: ["gmail", "outlook"] })

    expect(prompt).toContain("GMAIL:")
    expect(prompt).toContain("mcp__gmail__compose_email")
    // Outlook blocked until pipeline ships
    expect(prompt).not.toContain("OUTLOOK:")
    expect(prompt).not.toContain("mcp__outlook__compose_email")
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

  // --- Production mode ---

  it("includes production warning when isProduction is true", () => {
    const prompt = getSystemPrompt({ isProduction: true })

    expect(prompt).toContain("PRODUCTION MODE:")
  })

  // --- Context injection ---

  it("includes workspace and project when provided", () => {
    const prompt = getSystemPrompt({
      projectId: "proj-123",
      userId: "user-456",
      workspaceFolder: "/srv/webalive/sites/example.com",
    })

    expect(prompt).toContain("Project: proj-123")
    expect(prompt).toContain("User: user-456")
    expect(prompt).toContain("Workspace: /srv/webalive/sites/example.com")
  })

  it("excludes workspace when folder is /src (default)", () => {
    const prompt = getSystemPrompt({ workspaceFolder: "/src" })

    expect(prompt).not.toContain("Workspace:")
  })
})

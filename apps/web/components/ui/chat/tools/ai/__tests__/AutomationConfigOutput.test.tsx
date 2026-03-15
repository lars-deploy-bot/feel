// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock @webalive/shared to avoid node: builtins in happy-dom.
// The barrel export pulls in invite-code.ts (node:crypto) and path-security.ts (node:path)
// which crash in browser test environments.
vi.mock("@webalive/shared", () => ({
  CLAUDE_MODELS: {
    SONNET: "claude-sonnet-4-6",
    OPUS: "claude-opus-4-6",
    HAIKU: "claude-haiku-4-5",
  },
  DEFAULTS: {
    TEMPLATE_ID_PREFIX: "tmpl_",
    WILDCARD_DOMAIN: "test.example",
    SERVER_IP: "0.0.0.0",
  },
  ORG_ROLES: { OWNER: "owner", ADMIN: "admin", MEMBER: "member" },
  RESERVED_USER_ENV_KEYS: [],
  getModelDisplayName: (id: string) => {
    const names: Record<string, string> = {
      "claude-sonnet-4-6": "Sonnet",
      "claude-opus-4-6": "Opus",
      "claude-haiku-4-5": "Haiku",
    }
    return names[id] ?? id
  },
  isValidClaudeModel: (id: string) => ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"].includes(id),
}))

vi.mock("@/lib/api/api-client", () => ({
  ApiError: class ApiError extends Error {},
  postty: vi.fn(),
}))

import { postty } from "@/lib/api/api-client"
import { AutomationConfigOutput } from "../AutomationConfigOutput"

const mockedPostty = vi.mocked(postty)

const baseData = {
  type: "automation_config" as const,
  sites: [{ id: "site-1", hostname: "example.test.example" }],
  defaultName: "Daily summary",
  defaultPrompt: "Review the website and summarize key updates for today.",
}

describe("AutomationConfigOutput", () => {
  beforeEach(() => {
    mockedPostty.mockReset()
  })

  it("sends a cancellation message to the chat framework", () => {
    const onSubmitAnswer = vi.fn()

    render(<AutomationConfigOutput data={baseData} toolName="ask_automation_config" onSubmitAnswer={onSubmitAnswer} />)

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onSubmitAnswer).toHaveBeenCalledWith("User canceled automation configuration.")
    expect(screen.queryByText("Canceled")).not.toBeNull()
  })

  it("keeps form progress after submit errors so users can retry", async () => {
    mockedPostty.mockRejectedValueOnce(new Error("backend down"))

    render(<AutomationConfigOutput data={baseData} toolName="ask_automation_config" />)

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      const alert = screen.getByRole("alert")
      expect(alert.textContent).toContain("backend down")
    })

    expect(screen.queryByRole("button", { name: "Create" })).not.toBeNull()
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
  })
})

// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// Mock @webalive/shared to avoid node: builtins in happy-dom
// The barrel export pulls in invite-code.ts (node:crypto) and path-security.ts (node:path)
// which crash in browser test environments.
vi.mock("@webalive/shared", () => ({
  CLAUDE_MODELS: {
    SONNET: "claude-sonnet-4-6",
    OPUS: "claude-opus-4-6",
    HAIKU: "claude-haiku-4-5",
  },
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

import { AutomationConfig, type AutomationConfigData } from "../AutomationConfig"

const baseData: AutomationConfigData = {
  sites: [{ id: "site-1", hostname: "example.test.example" }],
  defaultName: "Daily summary",
  defaultPrompt: "Review the website and summarize key updates for today.",
}

describe("AutomationConfig", () => {
  it("hides Cancel when onCancel is not provided", () => {
    render(<AutomationConfig data={baseData} onComplete={vi.fn()} />)

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
  })

  it("renders Cancel and calls onCancel when provided", () => {
    const onCancel = vi.fn()
    render(<AutomationConfig data={baseData} onComplete={vi.fn()} onCancel={onCancel} />)

    const cancelButton = screen.getByRole("button", { name: "Cancel" })
    fireEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

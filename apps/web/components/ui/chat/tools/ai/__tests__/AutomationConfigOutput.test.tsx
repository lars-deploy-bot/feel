// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

const mockSetView = vi.fn()
const mockSetWorkbench = vi.fn()
const mockSetWorkbenchMinimized = vi.fn()
const mockStartCreate = vi.fn()

vi.mock("@/features/chat/lib/workbench-context", () => ({
  useWorkbenchContext: () => ({ setView: mockSetView }),
}))

vi.mock("@/lib/stores/debug-store", () => ({
  useDebugActions: () => ({
    setWorkbench: mockSetWorkbench,
    setWorkbenchMinimized: mockSetWorkbenchMinimized,
  }),
}))

vi.mock("@/lib/stores/agentCreateStore", () => ({
  useAgentCreateActions: () => ({ startCreate: mockStartCreate }),
}))

import { AutomationConfigOutput, validateAutomationConfig } from "../AutomationConfigOutput"

const baseData = {
  type: "automation_config" as const,
  sites: [{ id: "site-1", hostname: "example.test.example" }],
  defaultName: "Daily summary",
  defaultPrompt: "Review the website and summarize key updates for today.",
}

describe("AutomationConfigOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("opens the agents panel on mount", () => {
    render(<AutomationConfigOutput data={baseData} toolName="ask_automation_config" />)

    expect(mockSetWorkbench).toHaveBeenCalledWith(true)
    expect(mockSetWorkbenchMinimized).toHaveBeenCalledWith(false)
    expect(mockSetView).toHaveBeenCalledWith("agents")
    expect(mockStartCreate).toHaveBeenCalled()
  })

  it("renders the agent name as a re-open link", () => {
    render(<AutomationConfigOutput data={baseData} toolName="ask_automation_config" />)

    expect(screen.getByText("Daily summary")).not.toBeNull()
  })
})

describe("validateAutomationConfig", () => {
  it("returns true for valid data", () => {
    expect(validateAutomationConfig(baseData)).toBe(true)
  })

  it("returns false for missing sites", () => {
    expect(validateAutomationConfig({ type: "automation_config", sites: [] })).toBe(false)
  })

  it("returns false for non-object", () => {
    expect(validateAutomationConfig(null)).toBe(false)
    expect(validateAutomationConfig("string")).toBe(false)
  })
})

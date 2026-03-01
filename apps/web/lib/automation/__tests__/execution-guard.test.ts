import { describe, expect, it } from "vitest"
import { getAutomationExecutionGate } from "../execution-guard"

describe("automation execution gate", () => {
  it("allows execution on primary production server", () => {
    const gate = getAutomationExecutionGate({
      streamEnv: "production",
      isAutomationPrimary: true,
    })

    expect(gate.allowed).toBe(true)
  })

  it("blocks non-production environments", () => {
    const gate = getAutomationExecutionGate({
      streamEnv: "staging",
      isAutomationPrimary: true,
    })

    expect(gate.allowed).toBe(false)
    expect(gate.reason).toContain("STREAM_ENV")
  })

  it("blocks non-primary servers even in production", () => {
    const gate = getAutomationExecutionGate({
      streamEnv: "production",
      isAutomationPrimary: false,
    })

    expect(gate.allowed).toBe(false)
    expect(gate.reason).toContain("disabled")
  })
})

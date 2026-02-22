import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createAutomationParamsSchema } from "../src/tools/automations/create-automation.js"
import { zodToParams } from "../src/tools/meta/tool-registry.js"

describe("zodToParams", () => {
  it("preserves enum constraints in parameter descriptions", () => {
    const params = zodToParams(createAutomationParamsSchema) ?? []
    const triggerType = params.find(param => param.name === "trigger_type")
    const actionType = params.find(param => param.name === "action_type")

    expect(triggerType).toBeDefined()
    expect(triggerType?.type).toBe("string")
    expect(triggerType?.description).toContain('Allowed values: "cron", "one-time".')

    expect(actionType).toBeDefined()
    expect(actionType?.type).toBe("string")
    expect(actionType?.description).toContain('Allowed values: "prompt".')
  })

  it("extracts literal unions from JSON schema branches", () => {
    const params = zodToParams({
      execution_mode: z.union([z.literal("fast"), z.literal("safe")]).describe("Execution mode"),
    })

    expect(params).toHaveLength(1)
    expect(params?.[0]?.type).toBe("string")
    expect(params?.[0]?.description).toContain('Allowed values: "fast", "safe".')
  })
})

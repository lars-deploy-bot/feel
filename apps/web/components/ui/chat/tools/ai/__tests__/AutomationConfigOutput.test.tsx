// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AutomationConfigOutput } from "../AutomationConfigOutput"

vi.mock("@/lib/api/api-client", () => ({
  ApiError: class ApiError extends Error {},
  postty: vi.fn(),
}))

import { postty } from "@/lib/api/api-client"

const mockedPostty = vi.mocked(postty)

const baseData = {
  type: "automation_config" as const,
  sites: [{ id: "site-1", hostname: "example.alive.best" }],
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

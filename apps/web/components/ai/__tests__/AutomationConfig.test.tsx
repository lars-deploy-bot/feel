// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AutomationConfig, type AutomationConfigData } from "../AutomationConfig"

const baseData: AutomationConfigData = {
  sites: [{ id: "site-1", hostname: "example.alive.best" }],
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

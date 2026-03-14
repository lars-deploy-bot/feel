// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@webalive/shared", () => ({
  CLARIFICATION_MAX_QUESTIONS: 8,
  CLARIFICATION_OPTIONS_PER_QUESTION: 3,
}))

import { AskUserQuestionOutput } from "../AskUserQuestionOutput"

describe("AskUserQuestionOutput", () => {
  it("renders the question UI from AskUserQuestion tool input and submits the selected answer", () => {
    const onSubmitAnswer = vi.fn()

    render(
      <AskUserQuestionOutput
        data={null}
        toolName="AskUserQuestion"
        onSubmitAnswer={onSubmitAnswer}
        toolInput={{
          questions: [
            {
              header: "Scope",
              question: "What should I build first?",
              multiSelect: false,
              options: [
                { label: "Landing page", description: "Start with the homepage" },
                { label: "Dashboard", description: "Start with the app shell" },
                { label: "Auth flow", description: "Start with sign-in" },
              ],
            },
          ],
        }}
      />,
    )

    expect(screen.getByText("What should I build first?")).toBeTruthy()
    expect(screen.getByText("Landing page")).toBeTruthy()
    expect(screen.getByPlaceholderText("Other")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Landing page/i }))
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))

    expect(onSubmitAnswer).toHaveBeenCalledWith(
      "Here are my answers to your clarification questions:\n\n**What should I build first?**\n→ Landing page\n",
    )
    expect(screen.getByText("Answers submitted")).toBeTruthy()
  })

  it("returns nothing when the tool input is invalid", () => {
    const { container } = render(<AskUserQuestionOutput data={null} toolName="AskUserQuestion" toolInput={{}} />)

    expect(container.firstChild).toBeNull()
  })
})

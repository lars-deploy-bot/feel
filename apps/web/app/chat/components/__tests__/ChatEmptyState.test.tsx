// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChatEmptyState } from "../ChatEmptyState"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock onboarding store
vi.mock("@/lib/stores/onboardingStore", () => ({
  useOnboardingActions: () => ({
    setTemplateId: vi.fn(),
    setSiteIdea: vi.fn(),
    reset: vi.fn(),
  }),
}))

describe("ChatEmptyState", () => {
  it("shows pick-a-project state with site selector when user has sites", () => {
    const onImportGithub = vi.fn()
    const onSelectSite = vi.fn()

    render(
      <ChatEmptyState
        workspace={null}
        totalDomainCount={2}
        isLoading={false}
        onImportGithub={onImportGithub}
        onSelectSite={onSelectSite}
      />,
    )

    expect(screen.getByText("Pick a project to continue.")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Select a site" }))
    expect(onSelectSite).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: "Open from GitHub" }))
    expect(onImportGithub).toHaveBeenCalledTimes(1)
  })

  it("shows build-something welcome when user has no sites", () => {
    render(<ChatEmptyState workspace={null} totalDomainCount={0} isLoading={false} onImportGithub={() => {}} />)

    expect(screen.getByText("Build something.")).toBeTruthy()
  })

  it("shows regular workspace empty state when workspace is selected", () => {
    render(<ChatEmptyState workspace="example.com" totalDomainCount={3} isLoading={false} onImportGithub={() => {}} />)

    // Should show daily prompt text, no action buttons
    expect(screen.queryByRole("button", { name: "Open from GitHub" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Select a site" })).toBeNull()
  })

  it("renders nothing while loading", () => {
    const { container } = render(
      <ChatEmptyState workspace={null} totalDomainCount={0} isLoading={true} onImportGithub={() => {}} />,
    )

    expect(container.innerHTML).toBe("")
  })
})

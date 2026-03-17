// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const closeSidebarMock = vi.fn()

vi.mock("@/components/workspace/OrganizationWorkspaceSwitcher", () => ({
  OrganizationWorkspaceSwitcher: () => <div data-testid="workspace-switcher">Workspace Switcher</div>,
}))

vi.mock("@/components/workspace/WorktreeSwitcher", () => ({
  WorktreeSwitcher: () => <div data-testid="worktree-switcher">Worktree Switcher</div>,
}))

vi.mock("@/features/deployment/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      email: "reviewer@example.com",
      firstName: "Review",
      name: "Reviewer",
    },
  }),
}))

vi.mock("../components/AccountMenu", () => ({
  AccountMenu: () => <div data-testid="account-menu">Account</div>,
}))

vi.mock("@/features/settings/SettingsNav", () => ({
  SettingsNav: () => <div data-testid="settings-nav">Settings Navigation</div>,
}))

vi.mock("@/lib/hooks/useOrganizations", () => ({
  useOrganizations: () => ({ organizations: [{ org_id: "org-1" }] }),
}))

vi.mock("@/lib/hooks/useFavoriteWorkspaces", () => ({
  useFavoriteWorkspaces: () => ({ favorites: new Set<string>(), toggle: vi.fn() }),
}))

vi.mock("@/lib/stores/workspaceStore", () => ({
  useRecentWorkspaces: () => [{ domain: "example.com", orgId: "org-1", lastAccessed: Date.now() }],
  useWorkspaceActions: () => ({ removeRecentWorkspace: vi.fn() }),
}))

vi.mock("@/lib/analytics/events", () => ({
  trackSidebarClosed: () => undefined,
  trackSidebarOpened: () => undefined,
}))

vi.mock("@/lib/db/conversationSync", () => ({
  fetchConversations: vi.fn(),
}))

vi.mock("@/lib/db/dexieMessageStore", () => ({
  useDexieAllArchivedConversations: () => [],
  useDexieAllConversations: () => [{ id: "conv-1", workspace: "example.com" }],
  useDexieMessageActions: () => ({ setConversationFavorited: vi.fn() }),
  useDexieSession: () => "session-1",
}))

vi.mock("@/lib/stores/featureFlagStore", () => ({
  useFeatureFlag: () => false,
}))

vi.mock("@/lib/stores/streamingStore", () => ({
  useStreamingStore: (selector: (state: { tabs: Record<string, { isStreamActive: boolean }> }) => unknown) =>
    selector({ tabs: {} }),
}))

vi.mock("@/lib/stores/tabDataStore", () => ({
  useTabDataStore: (selector: (state: { tabsByWorkspace: Record<string, never[]> }) => unknown) =>
    selector({ tabsByWorkspace: {} }),
}))

vi.mock("../components/ArchivedConversationItem", () => ({
  ArchivedConversationItem: ({ conversation }: { conversation: { id: string } }) => <div>{conversation.id}</div>,
}))

vi.mock("../components/ConversationItem", () => ({
  ConversationItem: ({ conversation }: { conversation: { id: string } }) => <div>{conversation.id}</div>,
}))

vi.mock("../sidebarStore", () => ({
  useSidebarActions: () => ({ closeSidebar: closeSidebarMock }),
  useSidebarOpen: () => true,
}))

import { ConversationSidebar } from "../ConversationSidebar"

function renderSidebar(settingsMode = false) {
  return render(
    <ConversationSidebar
      workspace="example.com"
      worktree={null}
      isSuperadminWorkspace={false}
      activeTabGroupId="conv-1"
      onTabGroupSelect={() => undefined}
      onArchiveTabGroup={() => undefined}
      onUnarchiveTabGroup={() => undefined}
      onRenameTabGroup={() => undefined}
      onNewConversation={() => undefined}
      onNewConversationInWorkspace={() => undefined}
      onNewWorktree={() => undefined}
      onSelectWorktree={() => undefined}
      onToggleSettings={() => undefined}
      onSettingsClick={() => undefined}
      onFeedbackClick={() => undefined}
      onTemplatesClick={() => undefined}
      settingsMode={settingsMode}
    />,
  )
}

describe("ConversationSidebar", () => {
  beforeEach(() => {
    closeSidebarMock.mockReset()
  })

  it("renders both desktop and mobile sidebar variants when open", () => {
    renderSidebar()

    expect(screen.getAllByLabelText("Conversation history")).toHaveLength(2)
    expect(screen.getAllByText("conv-1")).toHaveLength(2)
    expect(screen.getAllByTestId("workspace-switcher")).toHaveLength(2)
    // Settings button uses aria-label, rendered in both desktop and mobile via header
    expect(screen.getAllByLabelText("Settings")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Feedback" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Components" })).toBeTruthy()
  })

  it("switches both variants into settings navigation mode", () => {
    renderSidebar(true)

    expect(screen.getAllByTestId("settings-nav")).toHaveLength(2)
    expect(screen.queryByText("conv-1")).toBeNull()
  })
})

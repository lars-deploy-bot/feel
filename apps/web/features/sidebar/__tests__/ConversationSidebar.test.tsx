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

vi.mock("@/features/settings/SettingsNav", () => ({
  SettingsNav: () => <div data-testid="settings-nav">Settings Navigation</div>,
}))

vi.mock("@/lib/stores/featureFlagStore", () => ({
  useFeatureFlag: () => false,
}))

// Mock extracted hooks — these are the boundaries we test against
vi.mock("../hooks/useConversationData", () => ({
  useConversationData: () => ({
    conversations: [{ id: "conv-1", workspace: "example.com", source: "chat", title: "Test", updatedAt: Date.now() }],
    archivedConversations: [],
    favorites: new Set<string>(),
    toggleFavoriteWorkspace: vi.fn(),
    setConversationFavorited: vi.fn(),
    userDisplay: "Reviewer",
  }),
}))

vi.mock("../hooks/useConversationGroups", () => ({
  useConversationGroups: () => ({
    favoriteGroups: [],
    activeConversations: [
      { id: "conv-1", workspace: "example.com", source: "chat", title: "Test", updatedAt: Date.now() },
    ],
    expandedWorkspaces: new Set<string>(),
    toggleExpanded: vi.fn(),
  }),
}))

vi.mock("../hooks/useStreamingConversations", () => ({
  useStreamingConversations: () => new Set<string>(),
}))

vi.mock("../hooks/useArchiveActions", () => ({
  useArchiveActions: () => ({
    archiveConfirmingId: null,
    handleArchiveClick: vi.fn(),
    handleCancelArchive: vi.fn(),
    handleArchiveAllInWorkspace: vi.fn(),
  }),
}))

vi.mock("../hooks/useFavoriteDragDrop", () => ({
  useFavoriteDragDrop: () => ({
    dragOverZone: null,
    handleDropFavorites: vi.fn(),
    handleDropBelow: vi.fn(),
    handleDragOverFavorites: vi.fn(),
    handleDragOverBelow: vi.fn(),
    handleDragLeave: vi.fn(),
  }),
}))

vi.mock("../components/AccountMenu", () => ({
  AccountMenu: () => <div data-testid="account-menu">Account</div>,
}))

vi.mock("../components/ArchivedSection", () => ({
  ArchivedSection: () => null,
}))

vi.mock("../components/CollapsedRail", () => ({
  CollapsedRail: () => <div data-testid="collapsed-rail">Rail</div>,
}))

vi.mock("../components/FavoritesList", () => ({
  FavoritesList: () => <div data-testid="favorites-list">Favorites</div>,
}))

vi.mock("../components/ConversationList", () => ({
  ConversationList: ({ conversations }: { conversations: Array<{ id: string }> }) => (
    <div data-testid="conversation-list">
      {conversations.map(c => (
        <div key={c.id} data-testid="conversation-item">
          {c.id}
        </div>
      ))}
    </div>
  ),
}))

vi.mock("../sidebarStore", () => ({
  useSidebarActions: () => ({ closeSidebar: closeSidebarMock, openSidebar: vi.fn() }),
  useSidebarOpen: () => true,
}))

import { ConversationSidebar } from "../ConversationSidebar"

const defaultProps = {
  workspace: "example.com",
  worktree: null,
  isSuperadminWorkspace: false,
  activeTabGroupId: "conv-1",
  onTabGroupSelect: vi.fn(),
  onArchiveTabGroup: vi.fn(),
  onUnarchiveTabGroup: vi.fn(),
  onRenameTabGroup: vi.fn(),
  onNewConversation: vi.fn(),
  onNewConversationInWorkspace: vi.fn(),
  onNewWorktree: vi.fn(),
  onSelectWorktree: vi.fn(),
  onToggleSettings: vi.fn(),
  onSettingsClick: vi.fn(),
  onFeedbackClick: vi.fn(),
  onTemplatesClick: vi.fn(),
} as const

describe("ConversationSidebar", () => {
  beforeEach(() => {
    closeSidebarMock.mockReset()
  })

  it("renders desktop and mobile sidebar when open", () => {
    render(<ConversationSidebar {...defaultProps} />)

    expect(screen.getAllByLabelText("Conversation history")).toHaveLength(2)
    expect(screen.getAllByTestId("workspace-switcher")).toHaveLength(2)
  })

  it("renders favorites list and conversation items in both viewports", () => {
    render(<ConversationSidebar {...defaultProps} />)

    expect(screen.getAllByTestId("favorites-list")).toHaveLength(2)
    expect(screen.getAllByTestId("conversation-item")).toHaveLength(2)
  })

  it("shows settings nav instead of conversations in settings mode", () => {
    render(<ConversationSidebar {...defaultProps} settingsMode />)

    expect(screen.getAllByTestId("settings-nav")).toHaveLength(2)
    expect(screen.queryByTestId("conversation-item")).toBeNull()
    expect(screen.queryByTestId("favorites-list")).toBeNull()
  })
})

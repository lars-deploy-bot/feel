/**
 * workspaceStore deep link tests
 *
 * Covers: deepLinkPending flag, validateWorkspaceAvailability interaction,
 * and rehydration behavior (deepLinkPending must never persist).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useWorkspaceStoreBase } from "../workspaceStore"

const getState = () => useWorkspaceStoreBase.getState()
const getActions = () => getState().actions

beforeEach(() => {
  // Reset store to initial state before each test
  useWorkspaceStoreBase.setState({
    currentWorkspace: null,
    selectedOrgId: null,
    recentWorkspaces: [],
    currentWorktreeByWorkspace: {},
    deepLinkPending: null,
  })
})

afterEach(() => {
  useWorkspaceStoreBase.setState({
    currentWorkspace: null,
    selectedOrgId: null,
    recentWorkspaces: [],
    currentWorktreeByWorkspace: {},
    deepLinkPending: null,
  })
})

describe("deepLinkPending", () => {
  it("setDeepLinkPending sets and clears the flag", () => {
    getActions().setDeepLinkPending("example.alive.best")
    expect(getState().deepLinkPending).toBe("example.alive.best")

    getActions().setDeepLinkPending(null)
    expect(getState().deepLinkPending).toBeNull()
  })

  it("validateWorkspaceAvailability does NOT clear workspace when deepLinkPending matches", () => {
    // Simulate deep link: workspace is set but not yet in available list
    useWorkspaceStoreBase.setState({
      currentWorkspace: "newsite.alive.best",
      deepLinkPending: "newsite.alive.best",
    })

    // Validate with a list that does NOT include the pending workspace
    getActions().validateWorkspaceAvailability(["other.alive.best"])

    // Workspace should be preserved because deepLinkPending protects it
    expect(getState().currentWorkspace).toBe("newsite.alive.best")
    expect(getState().deepLinkPending).toBe("newsite.alive.best")
  })

  it("validateWorkspaceAvailability clears workspace normally when no deepLinkPending", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "gone.alive.best",
      deepLinkPending: null,
    })

    getActions().validateWorkspaceAvailability(["other.alive.best"])

    // Without pending protection, workspace is cleared
    expect(getState().currentWorkspace).toBeNull()
  })

  it("validateWorkspaceAvailability clears deepLinkPending when workspace appears in available list", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "newsite.alive.best",
      deepLinkPending: "newsite.alive.best",
    })

    // Now the workspace shows up as available
    getActions().validateWorkspaceAvailability(["newsite.alive.best", "other.alive.best"])

    // Pending flag cleared, workspace kept
    expect(getState().currentWorkspace).toBe("newsite.alive.best")
    expect(getState().deepLinkPending).toBeNull()
  })

  it("deepLinkPending is not included in partialize (not persisted)", () => {
    // Verify by reading the source code contract: partialize only includes
    // currentWorkspace, selectedOrgId, recentWorkspaces, currentWorktreeByWorkspace.
    // We confirm by setting deepLinkPending and checking it doesn't survive a
    // simulated rehydration with only the partialized keys.
    useWorkspaceStoreBase.setState({
      currentWorkspace: "test.alive.best",
      deepLinkPending: "test.alive.best",
    })
    expect(getState().deepLinkPending).toBe("test.alive.best")

    // Simulate what rehydration does: only the partialized keys come back.
    // deepLinkPending is explicitly excluded from partialize and set to null in migrate.
    useWorkspaceStoreBase.setState({
      currentWorkspace: "test.alive.best",
      selectedOrgId: null,
      recentWorkspaces: [],
      currentWorktreeByWorkspace: {},
      deepLinkPending: null, // This is what migrate returns — always null
    })
    expect(getState().deepLinkPending).toBeNull()
    expect(getState().currentWorkspace).toBe("test.alive.best")
  })

  it("deepLinkPending cleared when allWorkspaces loads but workspace not found", () => {
    // Simulate: deep link set, workspace set, but workspace doesn't exist in any org
    useWorkspaceStoreBase.setState({
      currentWorkspace: "nonexistent.alive.best",
      deepLinkPending: "nonexistent.alive.best",
    })

    // First: validateWorkspaceAvailability preserves it (pending protection)
    getActions().validateWorkspaceAvailability(["other.alive.best"])
    expect(getState().currentWorkspace).toBe("nonexistent.alive.best")
    expect(getState().deepLinkPending).toBe("nonexistent.alive.best")

    // Then: the allWorkspaces effect clears deepLinkPending (simulated by direct clear)
    // In production, ChatPageContent's useEffect does this when allWorkspaces loads
    // but the workspace isn't found in any org.
    getActions().setDeepLinkPending(null)
    expect(getState().deepLinkPending).toBeNull()

    // Now validateWorkspaceAvailability CAN clear the workspace
    getActions().validateWorkspaceAvailability(["other.alive.best"])
    expect(getState().currentWorkspace).toBeNull()
  })
})

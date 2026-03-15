/**
 * workspacePreferencesSync tests
 *
 * Covers: mergeRecentWorkspaces deduplication, server sync atomicity (I6),
 * and sync throttling.
 *
 * Note: syncFromServer tests use @vitest-environment happy-dom to enable
 * the `window` global that syncFromServer checks.
 */

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __testing, syncFromServer } from "../workspacePreferencesSync"
import { useWorkspaceStoreBase } from "../workspaceStore"

const { mergeRecentWorkspaces, setLastSyncTime } = __testing

// ---------------------------------------------------------------------------
// Group 2: mergeRecentWorkspaces
// ---------------------------------------------------------------------------

describe("mergeRecentWorkspaces", () => {
  it("2.1 dedupes by domain+orgId, newest wins (server newer)", () => {
    const local = [{ domain: "a", orgId: "1", lastAccessed: 100 }]
    const server = [{ domain: "a", orgId: "1", lastAccessed: 200 }]

    const merged = mergeRecentWorkspaces(local, server)

    expect(merged).toHaveLength(1)
    expect(merged[0].lastAccessed).toBe(200)
  })

  it("2.2 local takes precedence when newer", () => {
    const local = [{ domain: "a", orgId: "1", lastAccessed: 300 }]
    const server = [{ domain: "a", orgId: "1", lastAccessed: 200 }]

    const merged = mergeRecentWorkspaces(local, server)

    expect(merged).toHaveLength(1)
    expect(merged[0].lastAccessed).toBe(300)
  })

  it("merges distinct entries from both sources", () => {
    const local = [{ domain: "local-only", orgId: "1", lastAccessed: 100 }]
    const server = [{ domain: "server-only", orgId: "1", lastAccessed: 200 }]

    const merged = mergeRecentWorkspaces(local, server)

    expect(merged).toHaveLength(2)
    // Sorted by lastAccessed desc
    expect(merged[0].domain).toBe("server-only")
    expect(merged[1].domain).toBe("local-only")
  })

  it("same domain in different orgs treated as separate entries", () => {
    const local = [{ domain: "a", orgId: "org-1", lastAccessed: 100 }]
    const server = [{ domain: "a", orgId: "org-2", lastAccessed: 200 }]

    const merged = mergeRecentWorkspaces(local, server)

    expect(merged).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Group 2: syncFromServer atomicity (I6)
// ---------------------------------------------------------------------------

describe("syncFromServer", () => {
  beforeEach(() => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: null,
      recentWorkspaces: [],
      currentWorktreeByWorkspace: {},
      deepLinkPending: null,
    })
    // Clear sync timestamp so throttle doesn't block
    setLastSyncTime(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: null,
      recentWorkspaces: [],
      currentWorktreeByWorkspace: {},
      deepLinkPending: null,
    })
  })

  it("2.3 sets workspace and org atomically from server (Bug C fix)", async () => {
    // Local: no workspace, has org-A
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: "org-A",
    })

    // Server returns workspace from org-B
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          currentWorkspace: "site-B",
          selectedOrgId: "org-B",
          recentWorkspaces: [],
          updatedAt: new Date().toISOString(),
        }),
        { status: 200 },
      ),
    )

    await syncFromServer()

    const state = useWorkspaceStoreBase.getState()
    // Both must update together — workspace from org-B requires orgId = org-B
    expect(state.currentWorkspace).toBe("site-B")
    expect(state.selectedOrgId).toBe("org-B")
  })

  it("2.4 recent sync skips state updates (60s throttle)", async () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: "org-local",
    })
    setLastSyncTime(Date.now())

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          currentWorkspace: "server-site",
          selectedOrgId: "org-server",
          recentWorkspaces: [],
          updatedAt: new Date().toISOString(),
        }),
        { status: 200 },
      ),
    )

    const result = await syncFromServer()

    expect(result).toBe(false)
    // State unchanged despite server having different values
    const state = useWorkspaceStoreBase.getState()
    expect(state.currentWorkspace).toBeNull()
    expect(state.selectedOrgId).toBe("org-local")
  })

  it("server org used when local has no org and server workspace set", async () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: null,
    })

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          currentWorkspace: "site-X",
          selectedOrgId: "org-X",
          recentWorkspaces: [],
          updatedAt: new Date().toISOString(),
        }),
        { status: 200 },
      ),
    )

    await syncFromServer()

    const state = useWorkspaceStoreBase.getState()
    expect(state.currentWorkspace).toBe("site-X")
    expect(state.selectedOrgId).toBe("org-X")
  })

  it("does not overwrite local workspace with server workspace", async () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "local-site",
      selectedOrgId: "org-A",
    })

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          currentWorkspace: "server-site",
          selectedOrgId: "org-B",
          recentWorkspaces: [],
          updatedAt: new Date().toISOString(),
        }),
        { status: 200 },
      ),
    )

    await syncFromServer()

    const state = useWorkspaceStoreBase.getState()
    // Local workspace wins — server only used when local is null
    expect(state.currentWorkspace).toBe("local-site")
    expect(state.selectedOrgId).toBe("org-A")
  })
})

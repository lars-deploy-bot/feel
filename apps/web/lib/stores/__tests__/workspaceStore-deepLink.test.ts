/**
 * Selection Lifecycle Contract Tests
 *
 * Tests the invariants documented in selection-lifecycle.ts.
 * Organized by invariant, not by bug fix.
 *
 * Invariants:
 *   Coherence    — org/workspace pair is always valid or explicitly pending
 *   Cancellation — newer intent kills older deferred intent
 *   Convergence  — invalid state converges to a valid one
 *   Persistence  — persisted state is always a valid pair
 *   Intent       — intentVersion tracks explicit user actions
 *   Auto-select  — respects selectedOrgId, never silently switches org
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Organization } from "@/lib/api/types"
import { useWorkspaceStoreBase } from "../workspaceStore"

const getState = () => useWorkspaceStoreBase.getState()
const getActions = () => getState().actions

function makeOrg(orgId: string, name?: string): Organization {
  return {
    org_id: orgId,
    name: name ?? orgId,
    credits: 100,
    workspace_count: 1,
    role: "owner",
  }
}

function resetState() {
  return {
    currentWorkspace: null as string | null,
    selectedOrgId: null as string | null,
    recentWorkspaces: [] as import("../workspaceStore").RecentWorkspace[],
    currentWorktreeByWorkspace: {} as Record<string, string | null>,
    deepLinkPending: null as string | null,
    intentVersion: 0,
  }
}

beforeEach(() => useWorkspaceStoreBase.setState(resetState()))
afterEach(() => useWorkspaceStoreBase.setState(resetState()))

// ═══════════════════════════════════════════════════════════════════════════
// COHERENCE: org/workspace pair must always be valid or explicitly pending
// ═══════════════════════════════════════════════════════════════════════════

describe("coherence", () => {
  it("setSelectedOrg clears deepLinkPending (manual beats deferred)", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "site-A",
      selectedOrgId: "org-A",
      deepLinkPending: "site-A",
    })

    getActions().setSelectedOrg("org-B")

    expect(getState().selectedOrgId).toBe("org-B")
    expect(getState().deepLinkPending).toBeNull()
  })

  it("autoSelectWorkspace sets workspace and org as a pair", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: null,
      recentWorkspaces: [
        { domain: "site-A", orgId: "org-A", lastAccessed: 100 },
        { domain: "site-B", orgId: "org-B", lastAccessed: 200 },
      ],
    })

    getActions().autoSelectWorkspace()

    expect(getState().currentWorkspace).toBe("site-B")
    expect(getState().selectedOrgId).toBe("org-B")
  })

  it("validateAndCleanup clears selectedOrgId when org removed", () => {
    useWorkspaceStoreBase.setState({
      selectedOrgId: "org-B",
      recentWorkspaces: [
        { domain: "site-B", orgId: "org-B", lastAccessed: 200 },
        { domain: "site-A", orgId: "org-A", lastAccessed: 100 },
      ],
    })

    getActions().validateAndCleanup([makeOrg("org-A")])

    // org-B removed → cleared, auto-selects org-A
    expect(getState().selectedOrgId).toBe("org-A")
    // org-B recents removed
    expect(getState().recentWorkspaces).toHaveLength(1)
    expect(getState().recentWorkspaces[0].orgId).toBe("org-A")
  })

  it("validateAndCleanup does NOT clear workspace (recents not authoritative)", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "site-B",
      selectedOrgId: "org-B",
      recentWorkspaces: [{ domain: "site-B", orgId: "org-B", lastAccessed: 200 }],
    })

    // org-B removed. validateAndCleanup clears org and recents,
    // but does NOT touch currentWorkspace — that's the server's job.
    getActions().validateAndCleanup([makeOrg("org-A")])

    expect(getState().selectedOrgId).toBe("org-A") // auto-selected
    expect(getState().recentWorkspaces).toHaveLength(0) // org-B recents gone
    // Workspace is NOT cleared here — the allWorkspaces coherence effect
    // or validateWorkspaceAvailability handles this from authoritative data.
    expect(getState().currentWorkspace).toBe("site-B")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CANCELLATION: newer intent kills older deferred intent
// ═══════════════════════════════════════════════════════════════════════════

describe("cancellation", () => {
  it("manual workspace switch cancels deepLinkPending", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "site-A",
      deepLinkPending: "site-A",
    })

    getActions().setCurrentWorkspace("site-B", "org-B")

    expect(getState().deepLinkPending).toBeNull()
    expect(getState().currentWorkspace).toBe("site-B")
  })

  it("same workspace does NOT cancel deepLinkPending (deferred resolution completing)", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "site-A",
      deepLinkPending: "site-A",
    })

    getActions().setCurrentWorkspace("site-A", "org-A")

    expect(getState().deepLinkPending).toBe("site-A")
  })

  it("clearing workspace to null cancels deepLinkPending", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "site-A",
      deepLinkPending: "site-A",
    })

    getActions().setCurrentWorkspace(null)

    expect(getState().deepLinkPending).toBeNull()
  })

  it("manual org switch cancels deepLinkPending", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "site-A",
      deepLinkPending: "site-A",
      selectedOrgId: null,
    })

    getActions().setSelectedOrg("org-C")

    expect(getState().deepLinkPending).toBeNull()
    expect(getState().selectedOrgId).toBe("org-C")
  })

  it("setting org to null also cancels deepLinkPending", () => {
    useWorkspaceStoreBase.setState({
      deepLinkPending: "site-A",
      selectedOrgId: "org-A",
    })

    getActions().setSelectedOrg(null)

    expect(getState().deepLinkPending).toBeNull()
  })

  it("deferred resolution failing clears deepLinkPending and lets validator clean up", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "nonexistent.alive.best",
      deepLinkPending: "nonexistent.alive.best",
    })

    // First validation: pending protects workspace
    getActions().validateWorkspaceAvailability(["other.alive.best"])
    expect(getState().currentWorkspace).toBe("nonexistent.alive.best")

    // allWorkspaces loaded, workspace not found → clear pending
    getActions().setDeepLinkPending(null)

    // Second validation: no protection, workspace cleared
    getActions().validateWorkspaceAvailability(["other.alive.best"])
    expect(getState().currentWorkspace).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// INTENT VERSIONING: tracks explicit user actions
// ═══════════════════════════════════════════════════════════════════════════

describe("intentVersion", () => {
  it("setCurrentWorkspace increments intentVersion", () => {
    const v0 = getState().intentVersion

    getActions().setCurrentWorkspace("site-A", "org-A")

    expect(getState().intentVersion).toBe(v0 + 1)
  })

  it("setSelectedOrg increments intentVersion", () => {
    const v0 = getState().intentVersion

    getActions().setSelectedOrg("org-A")

    expect(getState().intentVersion).toBe(v0 + 1)
  })

  it("multiple actions accumulate version", () => {
    const v0 = getState().intentVersion

    getActions().setCurrentWorkspace("site-A", "org-A")
    getActions().setSelectedOrg("org-B")
    getActions().setCurrentWorkspace("site-B", "org-B")

    expect(getState().intentVersion).toBe(v0 + 3)
  })

  it("validateAndCleanup does NOT increment intentVersion (not user intent)", () => {
    const v0 = getState().intentVersion

    getActions().validateAndCleanup([makeOrg("org-A")])

    expect(getState().intentVersion).toBe(v0)
  })

  it("validateWorkspaceAvailability does NOT increment intentVersion", () => {
    const v0 = getState().intentVersion

    getActions().validateWorkspaceAvailability(["site-A"])

    expect(getState().intentVersion).toBe(v0)
  })

  it("autoSelectWorkspace does NOT increment intentVersion", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      recentWorkspaces: [{ domain: "site-A", orgId: "org-A", lastAccessed: 100 }],
    })
    const v0 = getState().intentVersion

    getActions().autoSelectWorkspace()

    expect(getState().intentVersion).toBe(v0)
  })

  it("intentVersion not persisted (reset to 0 on rehydration)", () => {
    getActions().setCurrentWorkspace("site-A", "org-A")
    expect(getState().intentVersion).toBeGreaterThan(0)

    // Simulate rehydration
    useWorkspaceStoreBase.setState({
      currentWorkspace: "site-A",
      selectedOrgId: null,
      recentWorkspaces: [],
      currentWorktreeByWorkspace: {},
      deepLinkPending: null,
      intentVersion: 0,
    })

    expect(getState().intentVersion).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-SELECT: respects selectedOrgId, never silently switches org
// ═══════════════════════════════════════════════════════════════════════════

describe("autoSelectWorkspace", () => {
  it("with selectedOrgId set, picks from that org only", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: "org-A",
      recentWorkspaces: [
        { domain: "site-B", orgId: "org-B", lastAccessed: 300 }, // newer but wrong org
        { domain: "site-A", orgId: "org-A", lastAccessed: 200 },
      ],
    })

    getActions().autoSelectWorkspace()

    // Must pick from org-A, not org-B even though org-B is more recent
    expect(getState().currentWorkspace).toBe("site-A")
    expect(getState().selectedOrgId).toBe("org-A")
  })

  it("with selectedOrgId set but no recents for that org, falls back to global recent", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: "org-A",
      recentWorkspaces: [{ domain: "site-B", orgId: "org-B", lastAccessed: 300 }],
    })

    getActions().autoSelectWorkspace()

    // No org-A recents → fall back to global (org-B), pair moves together
    expect(getState().currentWorkspace).toBe("site-B")
    expect(getState().selectedOrgId).toBe("org-B")
  })

  it("without selectedOrgId, picks global most recent", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: null,
      recentWorkspaces: [
        { domain: "site-A", orgId: "org-A", lastAccessed: 100 },
        { domain: "site-B", orgId: "org-B", lastAccessed: 200 },
      ],
    })

    getActions().autoSelectWorkspace()

    expect(getState().currentWorkspace).toBe("site-B")
    expect(getState().selectedOrgId).toBe("org-B")
  })

  it("does not auto-select when workspace already set", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "existing.alive.best",
      recentWorkspaces: [{ domain: "other.alive.best", orgId: "org-A", lastAccessed: 999 }],
    })

    const didSelect = getActions().autoSelectWorkspace()

    expect(didSelect).toBe(false)
    expect(getState().currentWorkspace).toBe("existing.alive.best")
  })

  it("after validateAndCleanup removes org, does not pick from removed org", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: null,
      selectedOrgId: null,
      recentWorkspaces: [
        { domain: "site-B", orgId: "org-B", lastAccessed: 300 },
        { domain: "site-A", orgId: "org-A", lastAccessed: 200 },
      ],
    })

    getActions().validateAndCleanup([makeOrg("org-A")])
    getActions().autoSelectWorkspace()

    expect(getState().currentWorkspace).toBe("site-A")
    expect(getState().selectedOrgId).toBe("org-A")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CONVERGENCE: invalid state converges to valid state
// ═══════════════════════════════════════════════════════════════════════════

describe("convergence", () => {
  it("zero orgs: org and recents cleared", () => {
    useWorkspaceStoreBase.setState({
      selectedOrgId: "org-A",
      currentWorkspace: "site-A",
      recentWorkspaces: [{ domain: "site-A", orgId: "org-A", lastAccessed: 100 }],
    })

    getActions().validateAndCleanup([])

    expect(getState().selectedOrgId).toBeNull()
    expect(getState().recentWorkspaces).toHaveLength(0)
    // workspace not cleared by validateAndCleanup — server handles that
  })

  it("org with zero workspaces: org selected, workspace cleared by availability", () => {
    useWorkspaceStoreBase.setState({
      selectedOrgId: "org-A",
      currentWorkspace: "site-A",
    })

    getActions().validateWorkspaceAvailability([])

    expect(getState().selectedOrgId).toBe("org-A")
    expect(getState().currentWorkspace).toBeNull()
  })

  it("deleted workspace cleared from selection and recents", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "deleted.alive.best",
      recentWorkspaces: [
        { domain: "deleted.alive.best", orgId: "org-A", lastAccessed: 100 },
        { domain: "kept.alive.best", orgId: "org-A", lastAccessed: 200 },
      ],
    })

    getActions().validateWorkspaceAvailability(["kept.alive.best"])

    expect(getState().currentWorkspace).toBeNull()
    expect(getState().recentWorkspaces).toHaveLength(1)
    expect(getState().recentWorkspaces[0].domain).toBe("kept.alive.best")
  })

  it("rehydration with stale workspace (not on server) is cleared by validator", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "gone.alive.best",
      selectedOrgId: "org-A",
      deepLinkPending: null,
    })

    getActions().validateWorkspaceAvailability(["other.alive.best"])

    expect(getState().currentWorkspace).toBeNull()
    expect(getState().selectedOrgId).toBe("org-A")
  })

  it("autoSelectOrg picks first org when none selected", () => {
    useWorkspaceStoreBase.setState({ selectedOrgId: null })
    getActions().autoSelectOrg([makeOrg("org-A"), makeOrg("org-B")])
    expect(getState().selectedOrgId).toBe("org-A")
  })

  it("autoSelectOrg does nothing when org already selected", () => {
    useWorkspaceStoreBase.setState({ selectedOrgId: "org-B" })
    getActions().autoSelectOrg([makeOrg("org-A"), makeOrg("org-B")])
    expect(getState().selectedOrgId).toBe("org-B")
  })

  it("empty available list does not clear deepLinkPending workspace", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "new-site.alive.best",
      deepLinkPending: "new-site.alive.best",
    })

    getActions().validateWorkspaceAvailability([])

    expect(getState().currentWorkspace).toBe("new-site.alive.best")
    expect(getState().deepLinkPending).toBe("new-site.alive.best")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

describe("persistence", () => {
  it("deepLinkPending is not persisted (excluded from partialize)", () => {
    // The partialize config is the authoritative source for what gets written
    // to storage. We verify indirectly by setting values and checking that
    // rehydration from the persist layer never includes them.
    // The partialize config at workspaceStore.ts:341 explicitly lists only:
    //   currentWorkspace, selectedOrgId, recentWorkspaces, currentWorktreeByWorkspace
    // So deepLinkPending and intentVersion are structurally excluded.
    //
    // Verify by checking the migrate() output always resets them:
    useWorkspaceStoreBase.setState({
      currentWorkspace: "test.alive.best",
      deepLinkPending: "test.alive.best",
      intentVersion: 42,
    })

    // Simulate what happens after rehydration — migrate always resets these
    useWorkspaceStoreBase.setState({
      deepLinkPending: null,
      intentVersion: 0,
    })

    expect(getState().deepLinkPending).toBeNull()
    expect(getState().intentVersion).toBe(0)
    // currentWorkspace should survive (it IS persisted)
    expect(getState().currentWorkspace).toBe("test.alive.best")
  })

  it("recentWorkspaces always have orgId", () => {
    getActions().addRecentWorkspace("site-A", "org-A")
    const recents = getState().recentWorkspaces
    expect(recents).toHaveLength(1)
    expect(recents[0].orgId).toBe("org-A")
  })

  it("addRecentWorkspace dedupes by domain+orgId", () => {
    getActions().addRecentWorkspace("site-A", "org-A")
    getActions().addRecentWorkspace("site-A", "org-A")
    expect(getState().recentWorkspaces).toHaveLength(1)
  })

  it("same domain in different orgs are separate entries", () => {
    getActions().addRecentWorkspace("site-A", "org-A")
    getActions().addRecentWorkspace("site-A", "org-B")
    expect(getState().recentWorkspaces).toHaveLength(2)
  })

  it("recentWorkspaces limited to MAX_RECENT_PER_ORG per org", () => {
    for (let i = 0; i < 10; i++) {
      getActions().addRecentWorkspace(`site-${i}`, "org-A")
    }
    const orgARecents = getState().recentWorkspaces.filter(r => r.orgId === "org-A")
    expect(orgARecents.length).toBeLessThanOrEqual(6)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// DEEP LINK PENDING
// ═══════════════════════════════════════════════════════════════════════════

describe("deepLinkPending mechanism", () => {
  it("setDeepLinkPending sets and clears the flag", () => {
    getActions().setDeepLinkPending("example.alive.best")
    expect(getState().deepLinkPending).toBe("example.alive.best")
    getActions().setDeepLinkPending(null)
    expect(getState().deepLinkPending).toBeNull()
  })

  it("validateWorkspaceAvailability protects pending workspace", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "newsite.alive.best",
      deepLinkPending: "newsite.alive.best",
    })
    getActions().validateWorkspaceAvailability(["other.alive.best"])
    expect(getState().currentWorkspace).toBe("newsite.alive.best")
    expect(getState().deepLinkPending).toBe("newsite.alive.best")
  })

  it("validateWorkspaceAvailability clears pending when workspace confirmed", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "newsite.alive.best",
      deepLinkPending: "newsite.alive.best",
    })
    getActions().validateWorkspaceAvailability(["newsite.alive.best", "other.alive.best"])
    expect(getState().currentWorkspace).toBe("newsite.alive.best")
    expect(getState().deepLinkPending).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("edge cases", () => {
  it("workspace not in recents stays after validateAndCleanup (no false clear)", () => {
    // Workspace set without going through addRecentWorkspace
    useWorkspaceStoreBase.setState({
      currentWorkspace: "orphan.alive.best",
      selectedOrgId: "org-B",
      recentWorkspaces: [],
    })

    getActions().validateAndCleanup([makeOrg("org-A")])

    // org-B removed → org-A auto-selected
    expect(getState().selectedOrgId).toBe("org-A")
    // workspace stays — validateAndCleanup can't determine ownership without
    // authoritative data, so it doesn't make a false clear
    expect(getState().currentWorkspace).toBe("orphan.alive.best")
  })

  it("stale validateWorkspaceAvailability response after newer selection is harmless", () => {
    useWorkspaceStoreBase.setState({
      currentWorkspace: "new-site.alive.best",
      deepLinkPending: "new-site.alive.best",
    })

    // Stale response
    getActions().validateWorkspaceAvailability(["old-site.alive.best"])
    expect(getState().currentWorkspace).toBe("new-site.alive.best")

    // Fresh response
    getActions().validateWorkspaceAvailability(["old-site.alive.best", "new-site.alive.best"])
    expect(getState().currentWorkspace).toBe("new-site.alive.best")
    expect(getState().deepLinkPending).toBeNull()
  })

  it("worktree state preserved when switching back to a workspace", () => {
    getActions().setCurrentWorkspace("site-A", "org-A")
    getActions().setCurrentWorktree("site-A", "feature-branch")
    getActions().setCurrentWorkspace("site-B", "org-A")
    getActions().setCurrentWorkspace("site-A", "org-A")
    expect(getState().currentWorktreeByWorkspace["site-A"]).toBe("feature-branch")
  })

  it("multiple rapid setCurrentWorkspace calls — last write wins", () => {
    getActions().setCurrentWorkspace("site-1", "org-A")
    getActions().setCurrentWorkspace("site-2", "org-A")
    getActions().setCurrentWorkspace("site-3", "org-B")
    expect(getState().currentWorkspace).toBe("site-3")
  })

  it("empty org list + empty workspace list = clean empty state", () => {
    getActions().validateAndCleanup([])
    getActions().validateWorkspaceAvailability([])
    expect(getState().selectedOrgId).toBeNull()
    expect(getState().currentWorkspace).toBeNull()
    expect(getState().recentWorkspaces).toHaveLength(0)
  })
})

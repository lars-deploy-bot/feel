/**
 * workspacePreferencesSync unit tests
 *
 * Tests the merge logic for syncing workspace preferences between
 * local storage and server. Uses the exported __testing helpers.
 */
import { describe, expect, test } from "vitest"
import { __testing } from "../workspacePreferencesSync"

const { mergeRecentWorkspaces } = __testing

interface RecentWorkspace {
  domain: string
  orgId: string
  lastAccessed: number
}

describe("mergeRecentWorkspaces", () => {
  test("deduplicates by domain+orgId, keeping the newer entry", () => {
    const local: RecentWorkspace[] = [{ domain: "site.alive.best", orgId: "org-a", lastAccessed: 200 }]

    const server: RecentWorkspace[] = [{ domain: "site.alive.best", orgId: "org-a", lastAccessed: 100 }]

    const result = mergeRecentWorkspaces(local, server)

    const matches = result.filter(r => r.domain === "site.alive.best" && r.orgId === "org-a")
    expect(matches).toHaveLength(1)
    // Local is newer (200 > 100), should win
    expect(matches[0].lastAccessed).toBe(200)
  })

  test("local wins over server when local has newer timestamp", () => {
    const local: RecentWorkspace[] = [{ domain: "my-app.alive.best", orgId: "org-1", lastAccessed: 999 }]

    const server: RecentWorkspace[] = [{ domain: "my-app.alive.best", orgId: "org-1", lastAccessed: 500 }]

    const result = mergeRecentWorkspaces(local, server)

    expect(result).toHaveLength(1)
    expect(result[0].lastAccessed).toBe(999)
  })

  test("server wins when server has newer timestamp", () => {
    const local: RecentWorkspace[] = [{ domain: "my-app.alive.best", orgId: "org-1", lastAccessed: 100 }]

    const server: RecentWorkspace[] = [{ domain: "my-app.alive.best", orgId: "org-1", lastAccessed: 800 }]

    const result = mergeRecentWorkspaces(local, server)

    expect(result).toHaveLength(1)
    expect(result[0].lastAccessed).toBe(800)
  })

  test("server fills gaps when local is empty", () => {
    const local: RecentWorkspace[] = []

    const server: RecentWorkspace[] = [
      { domain: "server-site-1.alive.best", orgId: "org-a", lastAccessed: 300 },
      { domain: "server-site-2.alive.best", orgId: "org-b", lastAccessed: 200 },
    ]

    const result = mergeRecentWorkspaces(local, server)

    expect(result).toHaveLength(2)
    expect(result[0].domain).toBe("server-site-1.alive.best")
    expect(result[1].domain).toBe("server-site-2.alive.best")
  })

  test("caps per-org entries at 6", () => {
    // Create 10 entries for the same org across local and server
    const local: RecentWorkspace[] = []
    const server: RecentWorkspace[] = []

    for (let i = 0; i < 5; i++) {
      local.push({ domain: `local-${i}.alive.best`, orgId: "org-big", lastAccessed: 1000 + i })
    }
    for (let i = 0; i < 5; i++) {
      server.push({ domain: `server-${i}.alive.best`, orgId: "org-big", lastAccessed: 500 + i })
    }

    const result = mergeRecentWorkspaces(local, server)

    const orgBigEntries = result.filter(r => r.orgId === "org-big")
    expect(orgBigEntries.length).toBeLessThanOrEqual(6)
  })

  test("preserves entries from different orgs independently", () => {
    const local: RecentWorkspace[] = [
      { domain: "a1.alive.best", orgId: "org-a", lastAccessed: 300 },
      { domain: "a2.alive.best", orgId: "org-a", lastAccessed: 200 },
      { domain: "a3.alive.best", orgId: "org-a", lastAccessed: 100 },
    ]

    const server: RecentWorkspace[] = [
      { domain: "b1.alive.best", orgId: "org-b", lastAccessed: 350 },
      { domain: "b2.alive.best", orgId: "org-b", lastAccessed: 250 },
      { domain: "b3.alive.best", orgId: "org-b", lastAccessed: 150 },
    ]

    const result = mergeRecentWorkspaces(local, server)

    const orgAEntries = result.filter(r => r.orgId === "org-a")
    const orgBEntries = result.filter(r => r.orgId === "org-b")
    expect(orgAEntries).toHaveLength(3)
    expect(orgBEntries).toHaveLength(3)
  })

  test("returns sorted by lastAccessed descending", () => {
    const local: RecentWorkspace[] = [
      { domain: "old.alive.best", orgId: "org-a", lastAccessed: 100 },
      { domain: "newest.alive.best", orgId: "org-b", lastAccessed: 500 },
    ]

    const server: RecentWorkspace[] = [{ domain: "middle.alive.best", orgId: "org-a", lastAccessed: 300 }]

    const result = mergeRecentWorkspaces(local, server)

    // Verify descending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].lastAccessed).toBeGreaterThanOrEqual(result[i].lastAccessed)
    }
    expect(result[0].domain).toBe("newest.alive.best")
  })

  test("handles both inputs empty", () => {
    const result = mergeRecentWorkspaces([], [])
    expect(result).toEqual([])
  })

  test("handles local empty, server passes through", () => {
    const server: RecentWorkspace[] = [{ domain: "only-server.alive.best", orgId: "org-s", lastAccessed: 42 }]

    const result = mergeRecentWorkspaces([], server)

    expect(result).toHaveLength(1)
    expect(result[0].domain).toBe("only-server.alive.best")
  })

  test("handles server empty, local passes through", () => {
    const local: RecentWorkspace[] = [{ domain: "only-local.alive.best", orgId: "org-l", lastAccessed: 77 }]

    const result = mergeRecentWorkspaces(local, [])

    expect(result).toHaveLength(1)
    expect(result[0].domain).toBe("only-local.alive.best")
  })

  test("same domain in different orgs are treated as separate entries", () => {
    const local: RecentWorkspace[] = [{ domain: "shared.alive.best", orgId: "org-a", lastAccessed: 100 }]

    const server: RecentWorkspace[] = [{ domain: "shared.alive.best", orgId: "org-b", lastAccessed: 200 }]

    const result = mergeRecentWorkspaces(local, server)

    expect(result).toHaveLength(2)
    const orgIds = result.map(r => r.orgId).sort()
    expect(orgIds).toEqual(["org-a", "org-b"])
  })

  test("per-org cap keeps the most recent entries", () => {
    // Create 8 entries for org-a, all in local (most recent should survive)
    const local: RecentWorkspace[] = []
    for (let i = 0; i < 8; i++) {
      local.push({ domain: `site-${i}.alive.best`, orgId: "org-a", lastAccessed: i * 100 })
    }

    const result = mergeRecentWorkspaces(local, [])

    const orgAEntries = result.filter(r => r.orgId === "org-a")
    expect(orgAEntries).toHaveLength(6)

    // The 6 survivors should be the ones with the highest lastAccessed values
    const survivingTimestamps = orgAEntries.map(r => r.lastAccessed).sort((a, b) => b - a)
    expect(survivingTimestamps[0]).toBe(700) // site-7
    expect(survivingTimestamps[5]).toBe(200) // site-2
  })
})

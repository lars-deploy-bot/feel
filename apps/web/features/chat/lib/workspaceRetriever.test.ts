/**
 * Unit tests for workspace resolution logic
 *
 * These tests ensure that domain names are properly converted to directory slugs.
 * We test with existing workspaces to verify the full resolution flow.
 */

import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { PATHS } from "@webalive/shared"
import { afterEach, describe, expect, it, vi } from "vitest"
import { domainToSlug, normalizeDomain } from "@/features/manager/lib/domain-utils"
import * as worktrees from "@/features/worktrees/lib/worktrees"
import type { DomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"

const resolveDomainRuntimeMock = vi.fn<(hostname: string) => Promise<DomainRuntime | null>>(async () => null)

vi.mock("@/lib/domain/resolve-domain-runtime", () => ({
  resolveDomainRuntime: (hostname: string) => resolveDomainRuntimeMock(hostname),
}))

const getE2bScratchUserDirMock = vi.fn((domain: string) => `${PATHS.E2B_SCRATCH_ROOT}/${domain}/user`)

vi.mock("@/lib/sandbox/e2b-workspace", () => ({
  getE2bScratchUserDir: (domain: string) => getE2bScratchUserDirMock(domain),
}))

import { getWorkspace } from "./workspaceRetriever"

// Check if we're in an environment with actual workspace directories
const workspacePath = process.env.TEST_WORKSPACE_PATH ?? "/srv/webalive/sites/demo-sonno-nl/user"
const hasWorkspaces = existsSync(workspacePath)

// In CI, server-config.json doesn't exist so PATHS.SITES_ROOT is empty
const hasServerConfig = !process.env.CI

describe("Workspace Resolution", () => {
  describe("Domain to Slug Conversion (Unit)", () => {
    it("domainToSlug converts dots to hyphens", () => {
      expect(domainToSlug("demo.sonno.nl")).toBe("demo-sonno-nl")
    })

    it("domainToSlug handles multiple dots", () => {
      expect(domainToSlug("sub.example.com")).toBe("sub-example-com")
    })

    it("domainToSlug converts all special characters to hyphens", () => {
      expect(domainToSlug("test_site@123")).toBe("test-site-123")
    })

    it("normalizeDomain removes protocol", () => {
      expect(normalizeDomain("https://example.com")).toBe("example.com")
      expect(normalizeDomain("http://example.com")).toBe("example.com")
    })

    it("normalizeDomain removes www prefix", () => {
      expect(normalizeDomain("www.example.com")).toBe("example.com")
    })

    it("normalizeDomain converts to lowercase", () => {
      expect(normalizeDomain("EXAMPLE.COM")).toBe("example.com")
    })

    it("full normalization pipeline", () => {
      const input = "HTTPS://WWW.Example.COM"
      const normalized = normalizeDomain(input)
      const slug = domainToSlug(normalized)
      expect(slug).toBe("example-com")
    })
  })

  describe("Integration with existing workspace", () => {
    it.skipIf(!hasWorkspaces)("resolves demo-goalive-nl workspace correctly (legacy hyphenated format)", async () => {
      const result = await getWorkspace({
        body: { workspace: "demo.test.local" }, // User sends with dots
        requestId: "test-int-001",
      })

      // Should successfully find the workspace with hyphenated name
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.workspace).toBe("/srv/webalive/sites/demo-goalive-nl/user")
      }
    })

    it.skipIf(!hasWorkspaces)("path always ends with /user", async () => {
      const result = await getWorkspace({
        body: { workspace: "demo.test.local" },
        requestId: "test-int-002",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.workspace).toMatch(/\/user$/)
      }
    })

    it.skipIf(!hasWorkspaces)("path always contains /webalive/sites/", async () => {
      const result = await getWorkspace({
        body: { workspace: "demo.test.local" },
        requestId: "test-int-003",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.workspace).toContain("/webalive/sites/")
      }
    })
  })

  describe("Naming Convention Support (Regression Tests)", () => {
    /**
     * Critical regression test for workspace naming conventions.
     * This test prevents the bug where new sites with dots in directory names
     * (e.g., evermore.test.local) couldn't be found because the code
     * was converting them to hyphens (evermore-test-example).
     *
     * The system should support BOTH:
     * 1. New sites: domain.com → /srv/webalive/sites/domain.com/user
     * 2. Legacy sites: domain.com → /srv/webalive/sites/domain-com/user
     */
    it.skipIf(!hasWorkspaces)("finds workspace with dots in directory name (new convention)", async () => {
      // Test case: New sites like evermore.test.local use dots in filesystem
      const result = await getWorkspace({
        body: { workspace: "evermore.test.local" },
        requestId: "test-naming-001",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // Should find /srv/webalive/sites/evermore.test.local/user (with dots)
        expect(result.workspace).toBe("/srv/webalive/sites/evermore.test.local/user")
      }
    })

    it.skipIf(!hasWorkspaces)("falls back to hyphens when dots directory doesn't exist (legacy)", async () => {
      // Test case: Legacy sites like demo.test.local use hyphens in filesystem
      const result = await getWorkspace({
        body: { workspace: "demo.test.local" },
        requestId: "test-naming-002",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // Should fall back to /srv/webalive/sites/demo-goalive-nl/user (with hyphens)
        expect(result.workspace).toBe("/srv/webalive/sites/demo-goalive-nl/user")
      }
    })

    it.skipIf(!hasServerConfig)("provides helpful error message with both attempted paths", async () => {
      // Test case: Non-existent workspace should show what paths were tried
      // Skipped in CI because PATHS.SITES_ROOT is empty without server-config.json
      const result = await getWorkspace({
        body: { workspace: "nonexistent.site.com" },
        requestId: "test-naming-003",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        const body = await result.response.json()
        // Should show both naming conventions in attempted paths
        // Note: actual paths depend on PATHS.SITES_ROOT from server config
        expect(body.details?.attemptedPaths).toHaveLength(2)
        expect(body.details?.attemptedPaths[0]).toContain("nonexistent.site.com/user")
        expect(body.details?.attemptedPaths[1]).toContain("nonexistent-site-com/user")
      }
    })

    it.skipIf(!hasWorkspaces)("prefers dots over hyphens when both exist", async () => {
      // Edge case: If somehow both naming conventions exist, prefer new (dots)
      // This test documents the preference order
      const result = await getWorkspace({
        body: { workspace: "evermore.test.local" },
        requestId: "test-naming-004",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // Should prefer the dotted version (new convention)
        expect(result.workspace).toContain("evermore.test.local")
        expect(result.workspace).not.toContain("evermore-test-example")
      }
    })
  })

  describe("Error Handling", () => {
    it("returns error when workspace parameter is missing", async () => {
      const result = await getWorkspace({
        body: {},
        requestId: "test-err-001",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.response.status).toBe(400)
      }
    })

    it("returns error when workspace directory doesn't exist", async () => {
      const result = await getWorkspace({
        body: { workspace: "nonexistent.example.com" },
        requestId: "test-err-002",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.response.status).toBe(404)
      }
    })

    it("prevents path traversal attacks", async () => {
      const result = await getWorkspace({
        body: { workspace: "../../../etc/passwd" },
        requestId: "test-err-003",
      })

      // Path traversal is prevented - the input is normalized and doesn't resolve to /etc/passwd
      expect(result.success).toBe(false)
      // Returns 404 because the normalized path doesn't exist (security through normalization)
      if (!result.success) {
        expect(result.response.status).toBe(404)
      }
    })
  })

  describe("Worktree Resolution", () => {
    it("resolves worktree paths in local mode", async () => {
      vi.stubEnv("ALIVE_ENV", "local")

      const resolveSpy = vi
        .spyOn(worktrees, "resolveWorktreePath")
        .mockResolvedValue("/tmp/test-workspace/worktrees/feature")

      const result = await getWorkspace({
        body: { workspace: "test", worktree: "feature" },
        requestId: "test-wt-001",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.workspace).toBe("/tmp/test-workspace/worktrees/feature")
      }

      resolveSpy.mockRestore()
      vi.unstubAllEnvs()
    })

    it("rejects empty worktree slugs", async () => {
      vi.stubEnv("ALIVE_ENV", "local")

      const result = await getWorkspace({
        body: { workspace: "test", worktree: "" },
        requestId: "test-wt-002",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        const body = await result.response.json()
        expect(result.response.status).toBe(400)
        expect(body.error).toBe(ErrorCodes.WORKTREE_INVALID_SLUG)
      }

      vi.unstubAllEnvs()
    })

    it("maps worktree not-found errors", async () => {
      vi.stubEnv("ALIVE_ENV", "local")

      const resolveSpy = vi
        .spyOn(worktrees, "resolveWorktreePath")
        .mockRejectedValue(new worktrees.WorktreeError("WORKTREE_NOT_FOUND", "missing"))

      const result = await getWorkspace({
        body: { workspace: "test", worktree: "missing" },
        requestId: "test-wt-003",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        const body = await result.response.json()
        expect(result.response.status).toBe(404)
        expect(body.error).toBe(ErrorCodes.WORKTREE_NOT_FOUND)
      }

      resolveSpy.mockRestore()
      vi.unstubAllEnvs()
    })
  })

  describe("E2B Sandbox Resolution", () => {
    const scratchRootsToCleanup: string[] = []

    afterEach(async () => {
      resolveDomainRuntimeMock.mockReset()
      resolveDomainRuntimeMock.mockResolvedValue(null)
      getE2bScratchUserDirMock.mockClear()
      await Promise.all(scratchRootsToCleanup.map(root => rm(root, { recursive: true, force: true })))
      scratchRootsToCleanup.length = 0
    })

    it("returns 404 when E2B scratch dir does not exist (confirms E2B path is taken)", async () => {
      const domain = "e2b-exists.test.example"

      resolveDomainRuntimeMock.mockResolvedValue({
        execution_mode: "e2b",
        domain_id: "dom_test123",
        hostname: domain,
        port: 3333,
        is_test_env: true,
        test_run_id: "run-123",
        sandbox_id: null,
        sandbox_status: null,
      })

      // E2B scratch dir won't exist on disk — proves the E2B branch is taken
      const result = await getWorkspace({
        body: { workspace: domain },
        requestId: "test-e2b-001",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        const body = await result.response.json()
        expect(result.response.status).toBe(404)
        expect(body.message).toContain("E2B workspace")
      }
      expect(getE2bScratchUserDirMock).toHaveBeenCalledWith(domain)
    })

    it("resolves E2B scratch workspace when scratch dir exists", async () => {
      const domain = "e2b-happy.test.example"
      const scratchRoot = await mkdtemp(path.join(tmpdir(), "workspace-retriever-"))
      const existingScratchDir = path.join(scratchRoot, "user")
      await mkdir(existingScratchDir, { recursive: true })
      scratchRootsToCleanup.push(scratchRoot)

      resolveDomainRuntimeMock.mockResolvedValue({
        execution_mode: "e2b",
        domain_id: "dom_happy",
        hostname: domain,
        port: 3334,
        is_test_env: true,
        test_run_id: "run-123",
        sandbox_id: "sandbox_happy",
        sandbox_status: "running",
      })

      getE2bScratchUserDirMock.mockReturnValue(existingScratchDir)

      const result = await getWorkspace({
        body: { workspace: domain },
        requestId: "test-e2b-002",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.workspace).toBe(existingScratchDir)
        expect(result.workspace).toMatch(/\/user$/)
      }
      expect(getE2bScratchUserDirMock).toHaveBeenCalledWith(domain)
    })

    it("falls through to filesystem resolution when domain runtime lookup fails", async () => {
      resolveDomainRuntimeMock.mockRejectedValue(new Error("Supabase unavailable"))

      const result = await getWorkspace({
        body: { workspace: "some-site.test.example" },
        requestId: "test-e2b-003",
      })

      // Should not throw — falls through to filesystem candidate resolution
      // Will return 404 since the site doesn't exist on disk, but shouldn't crash
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.response.status).toBe(404)
      }
    })

    it("does not resolve E2B workspace for systemd domains", async () => {
      resolveDomainRuntimeMock.mockResolvedValue({
        execution_mode: "systemd",
        domain_id: "dom_systemd",
        hostname: "systemd-site.test.example",
        port: 3335,
        is_test_env: true,
        test_run_id: "run-123",
        sandbox_id: null,
        sandbox_status: null,
      })

      await getWorkspace({
        body: { workspace: "systemd-site.test.example" },
        requestId: "test-e2b-004",
      })

      // Should fall through to normal filesystem resolution (not E2B path)
      // Will be 404 since the site doesn't exist, but the important thing
      // is that it didn't try the E2B scratch path
      expect(getE2bScratchUserDirMock).not.toHaveBeenCalled()
    })
  })

  describe("Local Development Mode", () => {
    it("allows 'test' workspace in ALIVE_ENV=local", async () => {
      vi.stubEnv("ALIVE_ENV", "local")

      const result = await getWorkspace({
        body: { workspace: "test" },
        requestId: "test-local-001",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.workspace).toBe("/tmp/test-workspace")
      }

      vi.unstubAllEnvs()
    })
  })
})

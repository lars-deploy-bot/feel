/**
 * Selection Lifecycle Contract
 *
 * This module defines the rules for org/workspace/worktree/tab selection state.
 * The workspaceStore enforces these rules; this file documents and tests them.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CORE INVARIANT
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The app must never silently operate with an incoherent (selectedOrgId, currentWorkspace)
 * pair. "Incoherent" means currentWorkspace belongs to org-B but selectedOrgId is org-A.
 *
 * The only legal states are:
 *   1. Both null                                  — no selection (fresh user, zero orgs)
 *   2. orgId set, workspace null                  — org selected, no project yet
 *   3. orgId set, workspace set, workspace ∈ org  — fully resolved
 *   4. orgId null, workspace set, pendingIntent   — transient: deep link consumed before
 *                                                   org list loaded. Must resolve or clear
 *                                                   within one query cycle.
 *
 * State 4 is the ONLY exception and is gated by deepLinkPending !== null.
 * If deepLinkPending is null and both orgId and workspace are set, they must be coherent.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUTHORITATIVE SOURCE OF TRUTH
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Q: What is the authoritative source for workspace-to-org mapping at runtime?
 * A: The server, via useAllWorkspacesQuery() → Record<orgId, WorkspaceInfo[]>.
 *
 * Recents, localStorage, server-synced preferences, and URL params are all CACHES
 * or HINTS. They can seed the initial state for fast rendering, but the allWorkspaces
 * coherence effect in page.tsx corrects any mismatch when server data arrives.
 *
 * The store itself does NOT know org membership. It cannot reject an incoherent
 * pair at the mutation boundary because it lacks the data. Instead:
 * - Callers are responsible for passing correct orgId when they have it.
 * - The allWorkspaces effect corrects mismatches from server-authoritative data.
 * - Server-side auth (verifyWorkspaceAccess) is the final security boundary.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * MUTATION SOURCES (in precedence order, highest first)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. Deploy/import result    — carries orgId end-to-end via ?wk= + ?org=
 * 2. URL deep link           — ?wk= + optional ?org=, consumed once per value
 * 3. Manual picker           — user clicks org or workspace in switcher
 * 4. Local persistence       — Zustand persist from localStorage
 * 5. Server preferences sync — cross-device sync from /api/user/preferences
 * 6. Auto-select             — first org, most recent workspace
 *
 * Higher-precedence sources override lower ones. Each explicit user intent
 * (sources 1-3) increments intentVersion, preventing stale async corrections
 * from sources 5-6 or from slow server queries from overwriting the user's choice.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * INTENT VERSIONING
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * intentVersion is a monotonic counter in the store (not persisted).
 * It is incremented by setCurrentWorkspace and setSelectedOrg — both represent
 * explicit user actions or high-priority system actions (deep link consumption).
 *
 * Async corrections must:
 *   1. Capture intentVersion before starting
 *   2. After receiving data, compare with current intentVersion
 *   3. If it changed, discard the correction (user moved on)
 *
 * This prevents:
 *   - Stale allWorkspaces response rewriting selectedOrgId after manual switch
 *   - Server sync restoring a workspace the user just navigated away from
 *   - deepLink deferred resolution fighting with a newer manual selection
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CANCELLATION RULES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Any pending deferred resolution (deepLinkPending) is cancelled when:
 *   - User manually switches workspace (different from pending)
 *   - User manually switches org (any value, including null)
 *   - User clears workspace to null
 *   - User navigates to a new deep link with different workspace
 *   - The deferred query completes (success or failure)
 *
 * deepLinkPending is NOT cancelled when:
 *   - setCurrentWorkspace is called with the same workspace as pending
 *     (this is the deferred resolution completing)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONVERGENCE RULES (what happens when state becomes invalid)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Membership lost (org removed from user's org list):
 *   → selectedOrgId cleared if it was the removed org
 *   → recentWorkspaces for that org removed
 *   → autoSelectOrg picks first remaining org
 *   → currentWorkspace is NOT cleared by validateAndCleanup (recents are not
 *     authoritative for ownership). Instead, the allWorkspaces coherence effect
 *     and validateWorkspaceAvailability handle workspace clearing from server data.
 *
 * Q: When selectedOrgId is valid and workspace is missing from that org, what happens?
 * A: The allWorkspaces coherence effect runs. If the workspace exists in another
 *    accessible org, selectedOrgId is corrected to match. If the workspace doesn't
 *    exist in any accessible org, validateWorkspaceAvailability clears it.
 *    The app never enters a hidden "wrong org" state — it either corrects or clears.
 *
 * Workspace deleted/unavailable on this server:
 *   → currentWorkspace cleared (unless deepLinkPending protects it)
 *   → recentWorkspaces entry removed
 *   → UI shows "Select project"
 *
 * Zero orgs:
 *   → selectedOrgId = null, currentWorkspace = null
 *   → UI shows onboarding / "create team" flow
 *
 * Org with zero workspaces:
 *   → selectedOrgId set, currentWorkspace = null
 *   → UI shows "Select project" / "Create project"
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUTO-SELECT RULES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * autoSelectWorkspace respects selectedOrgId:
 *   - If an org is selected, picks the most recent workspace FROM THAT ORG only.
 *   - If the selected org has no recents, falls back to global most recent
 *     (which also sets the org — the pair always moves together).
 *   - This prevents auto-select from silently switching the user's org.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PERSISTENCE RULES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Persisted to localStorage (via Zustand persist):
 *   currentWorkspace, selectedOrgId, recentWorkspaces, currentWorktreeByWorkspace
 *
 * NOT persisted (transient, reset on page load):
 *   deepLinkPending, intentVersion
 *
 * Server sync:
 *   - workspace + orgId are always synced AS A PAIR
 *   - Server data only fills in nulls; it never overwrites explicit local state
 *   - Sync is throttled (60s) to prevent ping-pong
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SCOPE DECISIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Org/workspace selection is GLOBAL per browser (via localStorage).
 *
 * Q: If two tabs work in different orgs/projects, is cross-tab mutation acceptable?
 * A: This is an inherited design from localStorage-backed Zustand. It means one tab
 *    switching org/workspace will affect all tabs on next render. This is NOT ideal
 *    but is the current behavior. Conversations are tab-scoped (tabGroupId + tabId in
 *    the session key), so an org switch doesn't lose chat history — it changes which
 *    workspace future messages are sent to.
 *
 *    The safety argument: server-side auth (verifyWorkspaceAccess) validates workspace
 *    access on every API call, so a cross-tab mutation can't cause unauthorized access.
 *    It can cause a 401 UX disruption if tab A switches to org-B while tab B sends a
 *    message for org-A's workspace. This is a known limitation, not a security issue.
 *
 *    A proper fix would require per-tab workspace selection (e.g., via sessionStorage
 *    or URL state), which is a significant product change tracked separately.
 *
 * Worktree is per-workspace (stored in currentWorktreeByWorkspace map).
 * Switching workspace restores that workspace's last-used worktree.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * MULTI-PARAM URL RULES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ?wk= is REQUIRED for any URL-based workspace selection.
 * ?org= is an OPTIONAL HINT. If absent, org is resolved from server data.
 * ?wt= is OPTIONAL. If present, sets worktree for the resolved workspace.
 * ?tab= is OPTIONAL. If present, opens that tab/conversation.
 *
 * If ?wk= and ?org= disagree with server data:
 *   → Server data wins for the workspace-to-org mapping
 *   → ?org= is discarded silently
 *   → The allWorkspaces coherence effect corrects selectedOrgId
 *
 * If ?wk= is invalid (workspace doesn't exist):
 *   → workspace not set, URL cleared, no error shown (silent)
 *
 * If ?org= is provided without ?wk=:
 *   → ?org= is ignored (org selection requires workspace context or picker)
 */

// This file is documentation-only. The rules above are enforced in:
// - workspaceStore.ts (state mutations, cancellation, persistence, intentVersion)
// - workspacePreferencesSync.ts (server sync atomicity)
// - page.tsx (URL consumption, deferred resolution, coherence correction)
// - useSettingsQueries.ts (validation triggers)
// - OrganizationWorkspaceSwitcher.tsx (manual picker)
export {}

# Postmortem: Zustand 5 Upgrade Causes Infinite Render Loop (Production Down)

**Date**: 2026-03-20
**Duration**: ~12 hours (01:38 build deployed – 12:00 fixes applied)
**Severity**: Production completely broken — app crashes immediately after login
**Root cause**: Zustand 5 upgrade changed internal store hook from custom implementation to `useSyncExternalStore`, which has zero tolerance for selectors returning new object/array references
**Author**: Claude (Agent 1: diagnosis + fixes, Agent 2: memoization sweep)

## Symptoms

- Production (`app.alive.best`) loads login page fine, but crashes to error boundary immediately after successful login
- Browser console shows: `Minified React error #185` (production) / `Maximum update depth exceeded` (dev)
- No server-side errors — crash is purely client-side React
- Sentry did not capture the error (client-side DSN not configured, API token expired)
- Error only manifests on the `/chat` page which uses heavy zustand store subscriptions

## Timeline

| Time | Event |
|------|-------|
| ~01:38 | Production build deployed from `cleanup` branch (commit `04c85850`). Zustand had been upgraded from 4.x to 5.0.12 at some earlier point. |
| ~01:48 | Production service starts, serves traffic. Login works, but `/chat` page crashes. |
| 10:37 | User reports "prod is down". Initial investigation via Playwright confirms: login page renders, but navigating to `/chat` after login shows error boundary ("Something unexpected happened"). |
| 10:37 | Browser console shows `Minified React error #185`. Production build is minified — no useful stack trace. |
| 10:40 | Attempted to use Sentry for error details. API token expired (`"detail": "Token expired"`). Client-side Sentry DSN (`NEXT_PUBLIC_SENTRY_DSN`) not configured — errors never reported. |
| 10:42 | Attempted to reproduce on dev server (`dev.alive.best`) for unminified error. Dev server has additional issues (Turbopack module resolution). |
| 10:46 | Created new Sentry API token via Server 2 docker CLI. Queried Sentry — no client-side React errors captured (confirming missing DSN). |
| 10:50 | Identified React error #185 = `Maximum update depth exceeded` by reading React DOM production source (`formatProdErrorMessage(185)` at `getRootForUpdatedFiber` — fires when `nestedUpdateCount > 50`). |
| 10:55 | **Agent 2 launched** to sweep all zustand selectors for unstable references. Agent 2 identifies 8 problematic selectors across priority tiers. |
| 11:00 | **Root cause identified**: Zustand 5 uses `useSyncExternalStore` internally. Selectors returning new objects/arrays cause React to detect "store changed during render" → re-render → new reference → re-render → crash after 50 iterations. |
| 11:00 | Also discovered: `allowedDevOrigins` missing from `next.config.js` — Next.js 16 blocks cross-origin dev resources (fonts, HMR), causing dev server to appear broken with disabled buttons. |
| 11:02 | Attempted zustand 4 downgrade to isolate. Confirmed: zustand 4 doesn't crash, but codebase has `useShallow` imports from `zustand/react/shallow` which need zustand 5. |
| 11:05 | Restored zustand 5. Applied fixes to three files. Dev server blocked by separate Turbopack bug (stale `zustand/traditional` module reference cached from zustand 4 install). |
| 11:10 | Agent 2 completes memoization sweep — fixes `useTabs`, `useClosedTabs`, `useWorkspaceTabs` with `useShallow`, scopes `streamingBuffers` selectors. |
| 12:00 | All fixes applied. Production build pending deployment. |

## Root Cause: Zustand 5 `useSyncExternalStore` Contract

### The breaking change

Zustand 4 used a custom `useStore` hook with `Object.is` equality. Selectors returning new objects/arrays caused unnecessary re-renders but never infinite loops.

Zustand 5 switched to React's built-in `useSyncExternalStore`, which has a **strict contract**: `getServerSnapshot()` must return a cached value. If consecutive calls return different references (`Object.is` fails), React interprets this as "the store changed during render" and triggers another render. After 50 nested updates → error #185.

### Three crash vectors found

**Vector 1: `useDexieMessageActions` — new object per render**
```typescript
// Creates { setSession, addMessage, ... } — new object every call
export const useDexieMessageActions = () =>
  useDexieMessageStore(state => ({
    setSession: state.setSession,
    addMessage: state.addMessage,
    // ... 20+ function references
  }))
```
Even though individual function references are stable, the containing object is new each time. `useSyncExternalStore` detects this as a store change → re-render → new object → crash.

**Vector 2: `useActiveTab` — `?? []` creates new empty array**
```typescript
export const useActiveTab = (workspace) => {
  const tabs = useTabDataStore(s =>
    workspace ? (s.tabsByWorkspace[workspace] ?? []) : []
    //                                         ^^^^^
    // When workspace has no tabs: new [] every call
  )
}
```
`Object.is([], [])` is `false`. On first login with no tabs yet, this fires on every snapshot check.

**Vector 3: `useActiveSession` effect — unstable `workspaceTabs` dependency**
```typescript
const workspaceTabs = useWorkspaceTabs(workspace)  // .filter() = new array

useEffect(() => {
  if (!activeTab) createTabGroupWithTab(workspace)  // mutates store
}, [workspaceTabs, ...])  // unstable dep → effect re-fires every render
```
Cycle: render → new array from `.filter()` → effect fires → store mutation → re-render → new array → effect fires → crash.

## Fixes Applied

### Agent 1 (diagnosis + targeted fixes)

| File | Fix | Why |
|------|-----|-----|
| `apps/web/lib/db/dexieMessageStore.ts` | Wrapped `useDexieMessageActions` selector with `useShallow()` | Shallow-compares object keys instead of reference equality |
| `apps/web/lib/stores/tabStore.ts` | `useActiveTab`: replaced `?? []` with `?? EMPTY_TABS` (module-level constant) | Stable reference for empty state |
| `apps/web/features/chat/hooks/useActiveSession.ts` | Removed `workspaceTabs` from effect deps, read via `useTabDataStore.getState()` inside effect body | Effect only re-fires on actual triggers, not unstable array refs |
| `apps/web/next.config.js` | Added `allowedDevOrigins` for all dev/staging domains | Next.js 16 blocks cross-origin dev resources by default |

### Agent 2 (memoization sweep)

| File | Fix | Priority |
|------|-----|----------|
| `apps/web/lib/stores/tabStore.ts` | `useTabs`, `useClosedTabs`, `useWorkspaceTabs`: wrapped selectors with `useShallow()` | High |
| `apps/web/lib/db/useTabMessages.ts` | Scoped `streamingBuffers` selectors to active tab key instead of selecting entire record | High |
| `apps/web/lib/stores/onboardingStore.ts` | `useOnboardingActions`: identified as same pattern (new object per render) | Low |

## Detection Gaps

1. **No client-side Sentry**: `NEXT_PUBLIC_SENTRY_DSN` was not set in any env file. Client-side errors went completely undetected.
2. **Expired Sentry API token**: Even server-side Sentry queries failed. Token had expired with no monitoring.
3. **No zustand upgrade testing**: The zustand 4→5 upgrade happened without testing selector stability. No E2E test covers the `/chat` page post-login rendering (only stream/message tests).
4. **Minified production errors**: React error #185 required reading React DOM source code to decode. Source maps were not uploaded to Sentry.

## Action Items

- [ ] Configure `NEXT_PUBLIC_SENTRY_DSN` in production and staging env files
- [ ] Update Sentry API token in all env files (new token: `cef4aaf4...`)
- [ ] Add E2E test: login → chat page renders without errors (not just stream tests)
- [ ] Add lint rule or CI check: zustand selectors must not return object/array literals without `useShallow`
- [ ] Document zustand 5 migration guide in `docs/guides/zustand-nextjs-ssr-patterns.md`
- [ ] Upload source maps to Sentry during production build

## Lessons Learned

1. **Major dependency upgrades need selector audits.** Zustand 4→5 changed the equality contract silently. Every selector returning `{}` or `[]` became a crash vector.
2. **`useSyncExternalStore` is unforgiving.** Unlike zustand 4's custom hook, React's built-in store hook treats unstable snapshots as store mutations. There is no grace period.
3. **`?? []` is never safe in a zustand selector.** Always use a module-level constant: `const EMPTY: T[] = []`.
4. **Dev and prod can have different crashes.** The Turbopack dev server had its own `zustand/traditional` module resolution bug that masked the actual production issue. Always test with a production build.
5. **Client-side error monitoring is not optional.** Without Sentry DSN configured, we had zero visibility into the crash. The user had to report it manually.

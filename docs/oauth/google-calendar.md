# Google Calendar OAuth: Observations

## Problem Statement
When attempting to connect **Google Calendar**, the observed behavior reported is: it connects to **Gmail** instead of Google Calendar.

## Files Observed
1. `apps/web/lib/oauth/oauth-flow-handler.ts`
2. `apps/web/app/api/auth/[provider]/route.ts`
3. `apps/web/lib/oauth/providers.ts`
4. `packages/shared/src/mcp-providers.ts`
5. `apps/web/app/api/integrations/[provider]/route.ts`
6. `apps/web/app/api/integrations/available/route.ts`
7. `apps/web/lib/oauth/oauth-instances.ts`
8. `packages/oauth-core/src/providers/google.ts`
9. `apps/web/lib/oauth/__tests__/scope-alignment.test.ts`
10. `apps/web/app/api/auth/[provider]/__tests__/route.test.ts`
11. `packages/shared/src/__tests__/mcp-providers.test.ts`

## Observations

### 1) `apps/web/lib/oauth/oauth-flow-handler.ts`
- `initiateOAuthFlow()` resolves provider mapping via `getOAuthKeyForProvider(provider)` and then calls `getProvider(oauthKey)` ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):227-230).
- In `initiateOAuthFlow()`, if `oauthKey === "google"` and provider instance is `GoogleProvider`, `getAuthUrl()` is called with `{ forceConsent: true }` ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):243-248).
- `getOAuthConfig()` takes scopes from `process.env["${envPrefix}_SCOPES"]` or `config.defaultScopes` from `OAUTH_PROVIDER_CONFIG[providerKey]` ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):105-107).
- In callback flow, `redirectUri` is built from route provider via `buildOAuthRedirectUri(baseUrl, provider as OAuthProvider)` ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):314).
- In callback flow, required scopes source is `callbackConfig?.scopes?.trim()` or `OAUTH_PROVIDER_CONFIG[provider as OAuthProvider].defaultScopes` ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):317-319).
- In callback flow, token exchange/storage is executed using `oauthKey = getOAuthKeyForProvider(provider)` and `getOAuthInstance(oauthKey)`, with `oauthManager.handleCallback(..., oauthKey, ..., requiredScopes)` ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):331-342).

### 2) `apps/web/app/api/auth/[provider]/route.ts`
- Route validates and normalizes provider from URL param (`validateProviderName`) and uses that provider in context (`const context = { provider, user, baseUrl }`) ([route.ts](apps/web/app/api/auth/[provider]/route.ts):48-49,151).
- OAuth initiation path calls `getOAuthConfig(provider, baseUrl)` then `initiateOAuthFlow(context, config)` ([route.ts](apps/web/app/api/auth/[provider]/route.ts):161,179).
- OAuth callback path calls `handleOAuthCallback(context, code, state, req)` ([route.ts](apps/web/app/api/auth/[provider]/route.ts):155).

### 3) `apps/web/lib/oauth/providers.ts`
- `OAUTH_PROVIDER_CONFIG` is composed as `{ ...OAUTH_MCP_PROVIDERS, ...OAUTH_ONLY_PROVIDERS }` ([providers.ts](apps/web/lib/oauth/providers.ts):53-56).
- `isOAuthProviderSupported()` checks `isValidOAuthProviderKey(provider.toLowerCase())` ([providers.ts](apps/web/lib/oauth/providers.ts):66-68).

### 4) `packages/shared/src/mcp-providers.ts`
- MCP provider `gmail` has `oauthKey: "google"`, `envPrefix: "GOOGLE"`, and Gmail scopes in `defaultScopes` ([mcp-providers.ts](packages/shared/src/mcp-providers.ts):218-227).
- MCP provider `google_calendar` has `oauthKey: "google"`, `envPrefix: "GOOGLE"`, and calendar scopes in `defaultScopes` ([mcp-providers.ts](packages/shared/src/mcp-providers.ts):249-258).
- `getOAuthKeyForProvider(providerKey)` returns `config.oauthKey` for keys found in `OAUTH_MCP_PROVIDERS`; otherwise it returns `providerKey` directly ([mcp-providers.ts](packages/shared/src/mcp-providers.ts):399-406).
- OAuth-only provider `google` exists in `OAUTH_ONLY_PROVIDERS` with default scopes that include Gmail + Calendar + profile/email scopes ([mcp-providers.ts](packages/shared/src/mcp-providers.ts):546-556).

### 5) `apps/web/app/api/integrations/[provider]/route.ts`
- GET status path maps route provider to oauth key (`getOAuthKeyForProvider(provider)`) and checks connection with `oauthManager.isConnected(user.id, oauthKey)` ([route.ts](apps/web/app/api/integrations/[provider]/route.ts):106-110).
- DELETE path uses same mapping and calls `isConnected(user.id, oauthKey)` and revocation/disconnect with oauth key ([route.ts](apps/web/app/api/integrations/[provider]/route.ts):156-173).

### 6) `apps/web/app/api/integrations/available/route.ts`
- For each returned integration, code maps `integration.provider_key` to `oauthKey` using `getOAuthKeyForProvider(integration.provider_key)` ([route.ts](apps/web/app/api/integrations/available/route.ts):84-86).
- Connection check uses `oauthManager.isConnected(user.id, oauthKey)` ([route.ts](apps/web/app/api/integrations/available/route.ts):87).
- Token health check uses `oauthManager.getAccessToken(user.id, oauthKey)` ([route.ts](apps/web/app/api/integrations/available/route.ts):93).

### 7) `apps/web/lib/oauth/oauth-instances.ts`
- `getOAuthInstance(provider)` lowercases provider, validates it with `isValidOAuthProviderKey`, and stores singleton instances by provider key in `instances: Map<AllOAuthProviderKey, ...>` ([oauth-instances.ts](apps/web/lib/oauth/oauth-instances.ts):120,134-145).
- Both `OAUTH_MCP_PROVIDERS` and `OAUTH_ONLY_PROVIDERS` are included in `ALL_OAUTH_PROVIDERS` ([oauth-instances.ts](apps/web/lib/oauth/oauth-instances.ts):125).

### 8) `packages/oauth-core/src/providers/google.ts`
- `GoogleProvider.SCOPES` includes Gmail and Calendar scope constants ([google.ts](packages/oauth-core/src/providers/google.ts):45-52).
- `GoogleProvider.GMAIL_MODIFY_SCOPES` includes Gmail + profile + email scopes ([google.ts](packages/oauth-core/src/providers/google.ts):62-66).
- `GoogleProvider.CALENDAR_SCOPES` includes calendar events + calendar list readonly + userinfo email ([google.ts](packages/oauth-core/src/providers/google.ts):80-84).
- `getAuthUrl()` includes `include_granted_scopes=true` unless explicitly disabled (`options?.includeGrantedScopes !== false`) ([google.ts](packages/oauth-core/src/providers/google.ts):302-305).

### 9) `apps/web/lib/oauth/__tests__/scope-alignment.test.ts`
- Test asserts `GoogleProvider.GMAIL_MODIFY_SCOPES` equals `OAUTH_MCP_PROVIDERS.gmail.defaultScopes` ([scope-alignment.test.ts](apps/web/lib/oauth/__tests__/scope-alignment.test.ts):22-24).
- Test asserts `GoogleProvider.CALENDAR_SCOPES` equals `OAUTH_MCP_PROVIDERS.google_calendar.defaultScopes` ([scope-alignment.test.ts](apps/web/lib/oauth/__tests__/scope-alignment.test.ts):26-29).
- Test asserts `OAUTH_ONLY_PROVIDERS.google.defaultScopes` equals the union of Gmail + Calendar scope sets ([scope-alignment.test.ts](apps/web/lib/oauth/__tests__/scope-alignment.test.ts):32-40).

### 10) `apps/web/app/api/auth/[provider]/__tests__/route.test.ts`
- Tests in this file primarily cover route behavior with `linear`, `outlook`, and `microsoft` providers in mocked flows ([route.test.ts](apps/web/app/api/auth/[provider]/__tests__/route.test.ts):78-405).
- No explicit test case names for `gmail` or `google_calendar` are present in this file segment ([route.test.ts](apps/web/app/api/auth/[provider]/__tests__/route.test.ts):78-405).

### 11) `packages/shared/src/__tests__/mcp-providers.test.ts`
- This test file asserts provider metadata and mappings mostly for `outlook`/`microsoft`.
- It contains explicit assertion that `getOAuthKeyForProvider("gmail")` equals `"google"` ([mcp-providers.test.ts](packages/shared/src/__tests__/mcp-providers.test.ts):67-70).

## Plausible Root Causes (Not Confirmed Yet)

### A) Shared OAuth storage key merges Gmail + Calendar state
- Both MCP providers `gmail` and `google_calendar` map to the same `oauthKey: "google"` ([mcp-providers.ts](packages/shared/src/mcp-providers.ts):218-258).
- OAuth tokens are stored/read by provider key name in oauth-core (`saveTokens/getAccessToken/isConnected` use `provider` as the storage name) ([index.ts](packages/oauth-core/src/index.ts):324,461-487,521-522).
- The auth flow resolves route provider to `oauthKey` before callback storage (`oauthManager.handleCallback(..., oauthKey, ...)`) ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):331-342).
- Plausible effect: Gmail and Google Calendar effectively share one token slot (`google`), so connecting one can look like connecting the other.

### B) Per-provider status and disconnect checks are keyed by `oauthKey`, not MCP provider key
- `/api/integrations/[provider]` maps `provider -> oauthKey` and checks connection via `isConnected(user.id, oauthKey)` ([route.ts](apps/web/app/api/integrations/[provider]/route.ts):106-110,156-173).
- `/api/integrations/available` does the same mapping for connection/token health checks ([route.ts](apps/web/app/api/integrations/available/route.ts):84-93).
- Plausible effect: UI can show mirrored connection status between Gmail and Calendar (or disconnect both), which can be perceived as “Calendar connects to Gmail”.

### C) Token fan-out in fetch step duplicates the same Google token to both provider keys
- `fetchOAuthTokens()` loops MCP providers, but fetches token using `config.oauthKey` and then assigns it to `tokens[providerKey]` ([fetch-oauth-tokens.ts](apps/web/lib/oauth/fetch-oauth-tokens.ts):46-53,93-99).
- Because both providers use `oauthKey = "google"`, the same token may be exposed as both `tokens.gmail` and `tokens.google_calendar`.
- Plausible effect: downstream logic can treat both integrations as connected even when scopes only match one use case.

### D) Shared env prefix allows one scope override (`GOOGLE_SCOPES`) to affect both Gmail and Calendar flows
- `getOAuthConfig()` reads scopes from `process.env[${envPrefix}_SCOPES] || config.defaultScopes` ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):105-107).
- Both `gmail` and `google_calendar` use `envPrefix: "GOOGLE"` ([mcp-providers.ts](packages/shared/src/mcp-providers.ts):218-258).
- Plausible effect: if `GOOGLE_SCOPES` is set to Gmail-oriented scopes, initiating `/api/auth/google_calendar` can still request Gmail scopes.

### E) Callback scope validation may validate against the overridden shared scope set
- Callback required scopes come from `callbackConfig?.scopes` (from `getOAuthConfig(provider, ...)`) or provider defaults ([oauth-flow-handler.ts](apps/web/lib/oauth/oauth-flow-handler.ts):317-319).
- If `GOOGLE_SCOPES` is present, both Gmail and Calendar callbacks may validate against the same overridden scope set.
- Plausible effect: Google Calendar callback can succeed while persisting a token missing calendar scopes, reinforcing the “connected but wrong integration” behavior.

### F) Missing direct route tests for `gmail` / `google_calendar` auth paths
- Auth route tests shown in this file segment focus on `linear`, `outlook`, and `microsoft` ([route.test.ts](apps/web/app/api/auth/[provider]/__tests__/route.test.ts):78-405).
- No explicit cases for `gmail` or `google_calendar` in that segment.
- Plausible effect: provider-specific regressions in provider-to-oauthKey mapping and scope handling can slip through.

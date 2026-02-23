# Outlook Email Integration Plan + Acceptance Criteria

## Objective
Ship Outlook Email integration in Alive using the existing OAuth architecture in this repo (not the external `/api/oauth/*` style contract), while keeping calendar out of scope except for explicit TODO markers.

## Confirmed Architecture Fit
- OAuth entrypoint remains `GET /api/auth/[provider]` and uses `apps/web/lib/oauth/oauth-flow-handler.ts`.
- Provider metadata remains sourced from `packages/shared/src/mcp-providers.ts`.
- Token storage and callback handling remain in `@webalive/oauth-core`.
- Integrations visibility remains DB-driven through `integrations.get_available_integrations`.

## Scope
1. Add Microsoft OAuth provider support (`oauthKey: microsoft`) and Outlook MCP provider (`provider_key: outlook`).
2. Add Outlook Email send/draft APIs equivalent to Gmail UX flow.
3. Refactor Gmail send/draft into reusable provider-agnostic email action layer to avoid duplication.
4. Add Outlook email MCP server/tools parity (compose + read/action email tools) with user-click send/draft via web API.
5. Add TODO comments only for Outlook Calendar touchpoints (no calendar implementation).

## Critical Risks To Address
1. **Scope validation drift**:
   - Microsoft auth URL should request `offline_access`.
   - Callback required-scope validation must not fail if `offline_access` is omitted by returned granted scopes.
2. **Gmail-only assumptions in UI/system prompt**:
   - `oauthTokens.gmail` and hardcoded Gmail guidance must become email-provider-aware when Outlook is connected.
3. **Provider-key consistency**:
   - `outlook` in MCP/integrations layer must map to `microsoft` in oauth-core and env config.

## Implementation Checklist
- [ ] Add `MicrosoftProvider` in `packages/oauth-core/src/providers/microsoft.ts`.
- [ ] Register provider in `packages/oauth-core/src/providers/index.ts`.
- [ ] Add provider tests in `packages/oauth-core/src/__tests__/providers.test.ts`.
- [ ] Add `outlook` MCP provider entry in `packages/shared/src/mcp-providers.ts` with `supportsOAuth: true`.
- [ ] Add `microsoft` to `OAUTH_ONLY_PROVIDERS` for OAuth key validity.
- [ ] Add scope alignment tests in `apps/web/lib/oauth/__tests__/scope-alignment.test.ts`.
- [ ] Add provider bootstrap script `scripts/add-outlook-provider.ts` (default visibility `admin_only`).
- [ ] Add reusable email provider abstraction in `apps/web/lib/email/*`.
- [ ] Refactor Gmail routes (`/api/gmail/send`, `/api/gmail/draft`) to use shared layer.
- [ ] Add Outlook routes (`/api/outlook/send`, `/api/outlook/draft`) using shared layer.
- [ ] Add Outlook MCP server package under `apps/mcp-servers/outlook`.
- [ ] Add Outlook tool constants and renderer wiring in `packages/tools` + `apps/web/lib/tools/register-tools.ts`.
- [ ] Make `EmailDraftOutput` provider-aware by tool name to target Gmail vs Outlook endpoints.
- [ ] Make email connection prompt logic in `apps/web/app/api/claude/stream/route.ts` + `apps/web/features/chat/lib/systemPrompt.ts` provider-aware.
- [ ] Add Microsoft env vars to `packages/env/src/schema.ts` and `apps/web/.env.example`.
- [ ] Add explicit `TODO(calendar)` comments where future Outlook calendar integration will attach.

## Acceptance Criteria
### OAuth + Connection
- [ ] `GET /api/auth/outlook` initiates OAuth flow and redirects to Microsoft authorize URL.
- [ ] Callback success stores tokens via oauth-core and redirects to `/oauth/callback?integration=outlook&status=success`.
- [ ] Callback error paths map to typed OAuth callback payload used by existing popup flow.
- [ ] Missing/invalid state rejects correctly with OAuth typed error behavior.

### Integration Visibility + Settings
- [ ] `outlook` appears in `/api/integrations/available` for allowed users only.
- [ ] Default visibility is `admin_only` (scripted provider seed path).
- [ ] Connect/disconnect works from Settings card using existing integration hooks.

### Email Draft UX
- [ ] `mcp__outlook__compose_email` renders the same email draft card UX as Gmail compose.
- [ ] Draft card send action hits `/api/outlook/send`; save draft action hits `/api/outlook/draft`.
- [ ] Errors are surfaced in the same UI pattern as Gmail draft flow.

### API Behavior
- [ ] `POST /api/outlook/send` returns 401 unauthenticated, 400 invalid payload, 403 not connected, 200 success.
- [ ] `POST /api/outlook/draft` returns 401 unauthenticated, 400 invalid payload, 403 not connected, 200 success.

### Reusability / No Duplication
- [ ] Gmail send/draft code path uses the shared email provider service (no duplicated route business logic).
- [ ] Outlook send/draft reuses the same service with provider-specific adapter.

### Non-Regression
- [ ] Existing Gmail OAuth + send + draft behavior remains unchanged.
- [ ] Existing Google Calendar flows remain unchanged.
- [ ] Existing OAuth providers (linear/stripe/github/supabase/google) continue to pass route tests.

### Calendar Scope Guardrail
- [ ] No Outlook calendar behavior shipped.
- [ ] Calendar future points are marked with explicit `TODO(calendar)` comments only.

## Test Gate
- [ ] Add/update unit tests for OAuth provider behavior.
- [ ] Add/update route tests for `/api/auth/[provider]` including `outlook`.
- [ ] Add tests for `/api/outlook/send` and `/api/outlook/draft`.
- [ ] Run targeted tests for touched areas and confirm pass.

## Out of Scope
- Outlook Calendar implementation.
- Background sync/refresh workers beyond existing oauth-core token refresh behavior.
- New UI surfaces beyond existing integrations/settings + chat draft card flow.

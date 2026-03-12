# OAuth Core Agent Guide

Package-specific instructions for `@webalive/oauth-core`. Read the repo root [`/root/alive/AGENTS.md`](/root/alive/AGENTS.md) first, then follow these rules for work in this package.

## What This Package Owns

- Multi-tenant OAuth token and provider-config storage.
- AES-256-GCM encryption and decryption for lockbox secrets.
- Instance-aware isolation through `instance_id`.
- Provider adapters and refresh/revocation flow orchestration.
- User-scoped custom API key storage via `user_env_keys`.

## Canonical Contract

- The source of truth for database shape is `packages/database`, not old comments in this package.
- Current lockbox rows use `user_id` and `instance_id`, not `clerk_id`.
- The canonical token namespace is `oauth_connections`.
- `oauth_tokens` exists only for legacy compatibility. Do not introduce new writes to it.
- `LockboxAdapter` talks to public RPCs (`lockbox_get`, `lockbox_save`, `lockbox_delete`, `lockbox_list`, `lockbox_exists`) with a service-role client. Keep that boundary.
- `createOAuthManager()` with an explicit `instanceId` is the preferred API. The exported `oauth` singleton is legacy compatibility only.

## Files That Matter

- [`src/index.ts`](/root/alive/packages/oauth-core/src/index.ts): public API, OAuth manager, singleton compatibility layer.
- [`src/storage.ts`](/root/alive/packages/oauth-core/src/storage.ts): lockbox RPC adapter. Schema assumptions live here.
- [`src/types.ts`](/root/alive/packages/oauth-core/src/types.ts): namespaces, manager config, token types.
- [`src/refresh-lock.ts`](/root/alive/packages/oauth-core/src/refresh-lock.ts): memory vs Redis refresh locking.
- [`src/providers/base.ts`](/root/alive/packages/oauth-core/src/providers/base.ts): provider interfaces and capability guards.
- [`src/providers/index.ts`](/root/alive/packages/oauth-core/src/providers/index.ts): built-in provider registry and aliases.
- [`src/config.ts`](/root/alive/packages/oauth-core/src/config.ts): env validation. Reuse this, do not invent parallel config loaders.

## Provider Rules

- New providers must implement the `OAuthProviderCore` contract, including `getAuthUrl()`.
- Optional capabilities belong behind the existing guards: `isRefreshable()`, `isRevocable()`, `isUserInfoProvider()`, `isExternalIdentityProvider()`.
- Register aliases in one place: [`src/providers/index.ts`](/root/alive/packages/oauth-core/src/providers/index.ts).
- Before adding new retry, locking, or OAuth-flow machinery, check whether the existing provider base, `fetch-with-retry`, or refresh-lock manager already solves it.

## Database And Schema Changes

- If you change lockbox storage semantics, update `packages/database` migrations/schema/types in the same change.
- Keep package docs and helper scripts aligned with the real schema after schema changes.
- Do not hardcode UUID assumptions for users. `iam.users.user_id` is a text ID in this repo.
- If you touch namespace behavior, update both runtime constants and any setup/cleanup/verify scripts.

## Testing

- Use Bun commands only.
- Fast loop: `bun run test`
- Type-check: `bun run type-check`
- Integration: `bun run test:integration`
- Integration tests require real lockbox env plus a real `TEST_USER_ID` from `iam.users`.
- When fixing storage or refresh behavior, prefer unit tests first, then the smallest integration proof that exercises the real RPC path.

## Editing Checklist

- Preserve the service-role RPC model unless you are intentionally changing the security boundary.
- Keep secrets out of logs and test output.
- Prefer deterministic `instanceId` construction with `buildInstanceId()`.
- If you find references to `clerk_id` or fresh writes to `oauth_tokens`, treat them as stale and update them.

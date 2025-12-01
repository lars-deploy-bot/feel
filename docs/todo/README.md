# CodeRabbit Review Issues - PR #67

Issues identified by CodeRabbit automated review that need to be addressed.

## Critical (0)

None remaining.

## Major (5)

| # | Issue | File |
|---|-------|------|
| 01 | [Rate limiting for check-email](./01-rate-limiting-check-email.md) | `apps/web/app/api/auth/check-email/route.ts` |
| 03 | [Password minimum length (NIST)](./03-password-minimum-length.md) | `apps/web/app/api/auth/signup/route.ts` |
| 04 | [Fix useAuth infinite loop](./04-useauth-infinite-loop.md) | `apps/web/features/deployment/hooks/useAuth.ts` |
| 05 | [Stream buffer race condition](./05-stream-buffer-race-condition.md) | `apps/web/lib/stream/stream-buffer.ts` |

## Minor (3)

| # | Issue | File |
|---|-------|------|
| 02 | [Sanitize error logging](./02-sanitize-error-logging.md) | `apps/web/app/api/auth/check-email/route.ts` |
| 06 | [Stream buffer cursor race](./06-stream-buffer-cursor-race.md) | `apps/web/lib/stream/stream-buffer.ts` |
| 08 | [Doc timeout inconsistency](./08-doc-timeout-inconsistency.md) | `docs/architecture/persistent-worker-pool.md` |

## Already Fixed (in previous commits)

- debug/locks tests
- Tailwind v4 important modifier syntax
- Hardcoded email in SettingsModal
- Path validation in worker-pool manager
- IPC server leak on spawn failure
- Hardcoded credentials in CLAUDE.md
- workspace-validator tests (already exist with 54 tests)

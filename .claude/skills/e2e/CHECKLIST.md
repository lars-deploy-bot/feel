# E2E Zero-Drift Checklist

Use this before opening a PR.

## Preflight

- [ ] Real product path is executable in target env.
- [ ] If not, test-only seed endpoint exists and uses real DB state.
- [ ] If target env lacks required seed endpoint, spec skips with explicit reason.

## Authoring

- [ ] No product API mocks in spec.
- [ ] No product API interception that mutates behavior.
- [ ] Setup uses real APIs first, test-only seed APIs second.
- [ ] Every created resource is cleaned up in `finally`.
- [ ] Cleanup is idempotent.

## Types and Contracts

- [ ] Requests use `validateRequest` + `Req<...>` where applicable.
- [ ] Responses are parsed with shared schema/type (`apiSchemas...res.parse` or shared zod schema).
- [ ] No `as any`, no contract casts, no duplicate API interfaces.

## Assertions

- [ ] Positive user-visible assertion.
- [ ] Transport/mechanism assertion on real network behavior.
- [ ] Negative assertion (no 4xx/5xx, no duplicate behavior, no wrong state).
- [ ] No internal-store assertions unless persistence is explicitly under test.

## Stability

- [ ] No `waitForTimeout` readiness waits.
- [ ] Uses shared timeout constants.
- [ ] Longest readiness wait asserted first to avoid timeout accumulation.
- [ ] Verified in worker-parallel environment.

## Classification

- [ ] Failure mode is clear: setup, test bug, product regression, or external dependency.

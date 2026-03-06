# E2B Sandbox Setup Cascade Failure on alive.best

**Date:** 2026-03-06
**Duration:** ~2 hours
**Severity:** E2B unusable on alive.best (staging)
**Status:** IN PROGRESS

## Summary

Attempting to use E2B sandboxes on alive.best (Server 1) for the first time triggered a cascade of 7 sequential failures, each masked by the previous one.

## Failure Chain

| # | Symptom | Root Cause | Fix |
|---|---------|-----------|-----|
| 1 | `deploy-live` E2E test: "no reusable prewarmed deploy slug" | No `dl*` TLS certs in Caddy cert store on alive.best | Created `dl1.alive.best` Caddy entry with `tls force_automate` to prewarm cert |
| 2 | `deploy-live` E2E test: deployment fails, port not listening | `uv_interface_addresses` error 97 (`EAFNOSUPPORT`) — Vite needs `AF_NETLINK` for `getifaddrs()` | Added `AF_NETLINK` to `RestrictAddressFamilies` in `/etc/systemd/system/site@.service` |
| 3 | larry.alive.best: "sandbox not found" | E2B sandbox `ioskhzvydezrv092fep9j` expired (30-day timeout) | Code correctly marked dead, attempted fresh create |
| 4 | Sandbox creation timeout | E2B orchestrator on sonno had been restarted, orphaning all Firecracker VMs | Orchestrator restarted clean on sonno |
| 5 | `404: template 'self-hosted/alive' not found` | SDK sent `self-hosted/alive` but E2B API resolves `{team_slug}/alive` = `local-dev-team/alive` | Changed `E2B_TEMPLATES.ALIVE` from `"self-hosted/alive"` to `"alive"` in `packages/sandbox/src/constants.ts` |
| 6 | Sandbox creation hangs, then timeout | Let's Encrypt rate limit: 50 certs/week for `sonno.tech` exhausted by on-demand TLS issuing per-sandbox-subdomain certs | Changed `*.e2b.sonno.tech` Caddy config from `on_demand` to `tls internal` on sonno |
| 7 | `unable to get local issuer certificate` | E2B SDK rejects Caddy's self-signed internal certs | Added `NODE_TLS_REJECT_UNAUTHORIZED=0` to worker env allowlist and `.env.staging`/`.env.production` |

## Side Findings

- **All site services broken on alive.best**: The `RestrictAddressFamilies` in `site@.service` was missing `AF_NETLINK`. Existing sites only worked because they hadn't been restarted since the restriction was added. Any `systemctl restart site@*` would break them. Fixed for all sites.
- **Sonno's `site@.service` doesn't have `RestrictAddressFamilies` at all** — configs are out of sync between servers.
- **E2B sandbox DB record for larry was stale**: `sandbox_id=''`, `sandbox_status='creating'` since Nov 2025. The sandbox ID `ioskhzvydezrv092fep9j` came from a previous run that wrote to DB but was never properly tracked.

## TODO

- [ ] Replace `NODE_TLS_REJECT_UNAUTHORIZED=0` with proper wildcard cert for `*.e2b.sonno.tech` (DNS-01 challenge via Caddy DNS plugin)
- [ ] Sync `site@.service` hardening between Server 1 and Server 2
- [ ] Add E2B connectivity health check (can worker reach sandbox?) to staging deploy pipeline
- [ ] Consider shorter E2B sandbox timeout with auto-recreate instead of 30-day expiry
- [ ] Verify larry.alive.best works end-to-end after final deploy

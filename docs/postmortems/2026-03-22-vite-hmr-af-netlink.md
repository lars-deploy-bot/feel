# Postmortem: Vite HMR broken on user sites (AF_NETLINK)

**Date:** 2026-03-22
**Severity:** Medium — user sites couldn't hot-reload, required manual page refresh
**Duration:** ~2 weeks (since systemd hardening was added)

## Summary

Vite dev servers for user sites (`site@*.service`) crashed on restart with `uv_interface_addresses returned Unknown system error 97`. This prevented Vite from starting, which meant no HMR (Hot Module Replacement). Users had to manually refresh to see changes.

Old site processes that were started before the systemd change continued running but with stale file watchers — changes weren't detected.

## Root Cause

The `site@.service` systemd template was hardened with `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX`. This blocks `AF_NETLINK` sockets, which Node.js's `os.networkInterfaces()` requires (it uses `NETLINK_ROUTE` under the hood).

Vite calls `os.networkInterfaces()` during server startup (in `resolveServerUrls`) to print the "Network:" URLs. When this syscall is blocked by systemd, it throws a fatal error and Vite exits.

## Impact

- All user sites that were restarted after the hardening change would fail to start
- Sites that were already running kept working but with increasingly stale processes (no HMR, degraded file watching)
- The `checkup.sonno.tech` site had been running since March 9 — 2 weeks without restart

## Fix

Added `AF_NETLINK` to the allowed address families in `ops/systemd/site@.service`:

```diff
-RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
+RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
```

After `systemctl daemon-reload`, all sites restart cleanly with working Vite HMR.

## Also verified

The full HMR WebSocket chain works end-to-end:
- Vite HMR WebSocket (`Sec-WebSocket-Protocol: vite-hmr`) → shell-server-go preview proxy → Caddy `:8444` → Cloudflare Tunnel → browser
- Session cookie auth (`SameSite=None; Secure; HttpOnly`) passes correctly on WebSocket upgrades
- The preview proxy strips the `Origin` header for Vite HMR WebSocket connections (Vite rejects mismatched origins)

## Lesson

When adding systemd address family restrictions, test that Node.js processes can still call `os.networkInterfaces()`. Many dev tools (Vite, webpack-dev-server, Next.js) use this during startup. `AF_NETLINK` is safe to allow — it only provides read-only access to network interface information.

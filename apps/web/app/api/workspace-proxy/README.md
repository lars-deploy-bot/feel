# Workspace Proxy API

## Purpose

Proxies requests to local Vite dev servers to enable iframe preview in the Sandbox component.

## Why It Exists

The Caddyfile sets `X-Frame-Options: DENY` for all sites, preventing direct iframe embedding. This proxy:
1. Fetches content server-side (bypasses browser iframe restrictions)
2. Returns response without restrictive headers
3. Enables workspace preview in the Sandbox

## How It Works

```
Sandbox iframe → /api/workspace-proxy/protino.alive.best/
                 ↓
           getCookieUserId() → verify auth
                 ↓
     isWorkspaceAuthenticated() → check access
                 ↓
     getWorkspacePort() → parse Caddyfile (cached)
                 ↓
          fetch(localhost:3357)
                 ↓
     Return response without X-Frame-Options
```

## Caching

- Port mappings cached for 1 minute (`CACHE_TTL`)
- Caddyfile read once per minute max
- Cache invalidates automatically

## Security

- ✅ Requires authentication (session cookie)
- ✅ Enforces workspace access control
- ✅ No path traversal (handled by Next.js routing)
- ✅ Only proxies to ports in Caddyfile

## Limitations

1. **Performance**: All assets go through Next.js (slower than direct)
2. **WebSockets**: Not supported through this proxy
3. **Relative URLs**: May break if site expects different origin
4. **HMR**: Hot module reload may not work properly

## Better Alternative (Future)

Instead of proxying, modify Caddyfile to allow iframe from specific origins:

```caddy
(common_headers) {
  header {
    # Change from DENY to SAMEORIGIN or use CSP
    X-Frame-Options SAMEORIGIN
    # Or use Content-Security-Policy
    Content-Security-Policy "frame-ancestors 'self' https://terminal.goalive.nl https://staging.terminal.goalive.nl"
  }
}
```

This would enable direct iframe loading without proxy overhead.

## Usage

From Sandbox component:
```tsx
<iframe
  src={`/api/workspace-proxy/${workspace}/`}
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
/>
```

The proxy handles all HTTP methods (GET, POST, PUT, DELETE, etc.) and forwards headers appropriately.

# Preview & HMR

## Vite Dev Server

- Standard Vite WebSocket HMR with `overlay: false` (so Lovable's UI controls error display, not Vite's default overlay).
- **No custom reconnection wrapper** — Vite's built-in reconnect logic. Standard `@vite/client` module confirmed.
- Config: `server.host: "::"` (all interfaces), `port: 8080`. Uses `@vitejs/plugin-react-swc`.

## Port Proxying

- `/_port_{port}/*` proxies to any detected listening port inside the sandbox.
- Port detection is automatic.

## External Routing

- No service mesh inside the pod (no Envoy, no Istio, no sidecar).
- No Kubernetes service account.
- Edge proxy maps `{project-id}.lovableproject.com` → pod IP.
- `x-envoy-upstream-service-time` header comes from the edge, not a sidecar.

## Error Capture (from sandbox binary)

Structured payload via postMessage to parent frame:
```json
{
  "timestamp": 1772810413452,
  "error_type": "UNHANDLED_PROMISE_REJECTION",
  "filename": "Unknown file",
  "lineno": 0,
  "colno": 0,
  "stack": "TypeError: Cannot read properties of null ...",
  "has_blank_screen": true
}
```

- `has_blank_screen` is the severity signal. Blank = total failure, partial = degraded.
- UI shows "Try to fix" button that feeds error back to the agent.

For the full error capture and control channel implementation, see [lovable-js.md](./lovable-js.md).

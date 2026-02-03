# OAuth Popup Flow

This document describes the popup-based OAuth flow used for integrations (e.g., Linear, GitHub).

## Overview

The flow uses a popup window for OAuth to keep the user in the settings modal. It has two communication mechanisms:
1. **postMessage** (primary) - Direct window-to-window communication
2. **storage event** (fallback) - For when `window.opener` is lost during cross-origin redirects

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant MainWindow as Main Window<br/>(Settings Modal)
    participant Popup as Popup Window
    participant API as /api/auth/[provider]
    participant Provider as OAuth Provider<br/>(e.g., Linear)
    participant Callback as /oauth/callback
    participant DB as Database

    User->>MainWindow: Click "Connect"
    MainWindow->>MainWindow: Clear localStorage(OAUTH_STORAGE_KEY)
    MainWindow->>Popup: window.open("/api/auth/linear")
    MainWindow->>MainWindow: Add event listeners:<br/>- message (postMessage)<br/>- storage (localStorage change)<br/>- poll timer (popup.closed)

    Popup->>API: GET /api/auth/linear
    API->>API: Generate state, store in cookie
    API-->>Popup: 302 Redirect to Provider

    Popup->>Provider: OAuth Authorization Page
    User->>Provider: Authorize App
    Provider-->>Popup: 302 Redirect to callback

    Popup->>API: GET /api/auth/linear/callback?code=xxx&state=yyy
    API->>API: Validate state
    API->>Provider: Exchange code for tokens
    Provider-->>API: Access token + refresh token
    API->>DB: Store encrypted tokens
    API-->>Popup: 302 Redirect to /oauth/callback?status=success

    Popup->>Callback: Load callback page

    alt window.opener exists (postMessage works)
        Callback->>Callback: Write to localStorage (backup)
        Callback->>MainWindow: postMessage({ type: "oauth_callback", status: "success" })
        MainWindow->>MainWindow: handleMessage() receives event
    else window.opener lost (cross-origin redirect issue)
        Callback->>Callback: Write to localStorage
        Note over Callback,MainWindow: storage event fires automatically
        MainWindow->>MainWindow: handleStorageEvent() receives event
    end

    MainWindow->>MainWindow: cleanup() - remove listeners
    MainWindow->>Popup: popup.close()
    MainWindow->>API: GET /api/integrations/available
    API->>DB: Query user integrations
    DB-->>API: Integration list with is_connected=true
    API-->>MainWindow: { integrations: [...] }
    MainWindow->>MainWindow: Update UI to show "Connected"
```

## Communication Mechanisms

### 1. postMessage (Primary)

```typescript
// Callback page posts to opener
window.opener.postMessage({
  type: "oauth_callback",
  integration: "linear",
  status: "success"
}, window.location.origin)

// Main window listens
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return
  if (isOAuthCallbackMessage(event.data)) {
    // Handle success/error
  }
})
```

### 2. storage event (Fallback)

When the popup navigates to a different origin (the OAuth provider) and back, `window.opener` can be nulled out by the browser for security. The storage event provides a fallback:

```typescript
// Callback page writes to localStorage
localStorage.setItem("oauth_callback_result", JSON.stringify({
  type: "oauth_callback",
  integration: "linear",
  status: "success"
}))

// Main window listens for storage changes from other windows
window.addEventListener("storage", (event) => {
  if (event.key === "oauth_callback_result" && event.newValue) {
    const data = JSON.parse(event.newValue)
    // Handle success/error
  }
})
```

### 3. Polling (Popup Closure Detection)

We still poll to detect if the user manually closes the popup:

```typescript
const pollTimer = setInterval(() => {
  if (popup.closed) {
    // Check localStorage one more time, then resolve as cancelled
  }
}, 500)
```

## Files Involved

| File | Purpose |
|------|---------|
| `hooks/use-integrations.ts` | `openOAuthPopup()` - Opens popup, handles all communication |
| `app/oauth/callback/page.tsx` | Receives OAuth result, posts to opener + localStorage |
| `lib/oauth/popup-constants.ts` | Shared constants and type guards |
| `app/api/auth/[provider]/route.ts` | Initiates OAuth, handles callback |
| `lib/oauth/oauth-flow-handler.ts` | Token exchange and storage |

## Error Handling

| Scenario | Result |
|----------|--------|
| Popup blocked | Falls back to full-page redirect |
| User closes popup | "Authorization cancelled" error |
| OAuth denied | Error message from provider shown |
| Token exchange fails | Error message shown |
| `window.opener` lost | storage event fallback kicks in |

## Security Considerations

1. **Origin validation**: postMessage checks `event.origin`
2. **State parameter**: CSRF protection via state cookie
3. **Token encryption**: Tokens stored with AES-256-GCM in database
4. **localStorage cleanup**: Cleared after reading to prevent replay

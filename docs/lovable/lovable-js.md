# lovable.js — The CDN Bridge Script

**115KB minified bundle** injected into every published site via `lol_html` rewriting.
URL: `https://cdn.gpteng.co/lovable.js`

This is NOT just an analytics snippet. It's a **bidirectional control channel** between the published iframe and the Lovable control plane.

## Allowed Origins

```javascript
["https://gptengineer.app", "http://localhost:3000", "http://localhost",
 "https://lovable.dev", "https://beta.lovable.dev"]
// Plus regex: /^https:\/\/[a-z0-9-]+\.beta\.lovable\.dev$/
```

## 1. Error Capture → Agent

Listens for `window.error` and `unhandledrejection`. Every error gets a `blankScreen` boolean:

```javascript
// Blank screen detection
Xt = () => {
  let e = document.querySelector("div#root");
  return e ? e.childElementCount === 0 : false
}
```

Posts to parent:
- `RUNTIME_ERROR` — with `{blankScreen, message, stack, lineno, colno, filename}`
- `UNHANDLED_PROMISE_REJECTION` — same payload, includes `document.getElementById("root")` and `scripts` list
- `CONSOLE_OUTPUT` — captured console.log/warn/error with level, message, timestamp, raw values

This powers the "Try to fix" button.

## 2. Session Recording (rrweb)

Full DOM recording via **rrweb**:
- Serializes every mutation, scroll, click, input change, canvas frame
- Posts `RRWEB_EVENT` to parent in real-time
- Masks passwords (`maskInputOptions: { password: true }`)
- Masks text in inputs/textareas (`maskTextSelector: "input, textarea"`)
- Buffer cleared every 60s
- Handles iframes, shadow DOM, canvas, CSS stylesheets

This is how they show session replays and possibly how the agent "sees" what the user sees.

## 3. Element Inspector (Visual Editing)

Integrates with `lovable-tagger`'s `sourceElementMap` and `__jsxSource__` symbols:

| Message | Direction | Purpose |
|---------|-----------|---------|
| `ELEMENT_CLICKED` | iframe → parent | User clicked element. Payload: element identity (file:line:col) + bounding rect + isMultiSelect |
| `ELEMENT_DOUBLE_CLICKED` | iframe → parent | User double-clicked for text editing |
| `TOGGLE_SELECTOR` | parent → iframe | Enable/disable element selection mode |
| `HOVER_ELEMENT_REQUESTED` | parent → iframe | Highlight element by file:line:col |
| `UNHOVER_ELEMENT_REQUESTED` | parent → iframe | Remove highlight |
| `REQUEST_SELECTED_ELEMENTS` | parent → iframe | Get currently selected elements |
| `UPDATE_SELECTED_ELEMENTS` | parent → iframe | Update selection state |
| `GET_PARENT_ELEMENT` | parent → iframe | Navigate to parent element |
| `SELECTED_ELEMENT_BOUNDS_UPDATED` | iframe → parent | Element bounds changed (resize/scroll) |

Uses React Fiber internals and JSX source annotations to resolve DOM node → source file:line:col.

## 4. Live DOM Manipulation (Parent → Iframe)

The parent can send commands **into** the iframe to preview changes without writing to disk:

| Message | Purpose |
|---------|---------|
| `SET_ELEMENT_CONTENT` | Change innerHTML by file:line ID |
| `SET_ELEMENT_ATTRS` | Modify element attributes |
| `SET_ELEMENT_ICON` | Swap icons |
| `SET_STYLESHEET` | Inject/replace CSS |
| `EDIT_TEXT_REQUESTED` | Inline text editing |
| `VIRTUAL_OVERRIDE` | Override file content in-memory (preview before commit) |
| `CLEAR_VIRTUAL_OVERRIDE` | Clear a single virtual override |
| `CLEAR_ALL_VIRTUAL_OVERRIDES` | Clear all virtual overrides |
| `INJECT_TAILWIND_CDN` | Inject Tailwind CDN script |
| `UPDATE_TAILWIND_CONFIG` | Update Tailwind config at runtime |

The `VIRTUAL_OVERRIDE` mechanism is key — it lets them preview code changes instantly in the iframe before the agent commits them to disk. The `payload` includes `path` and `content`.

## 5. Network Request Monitoring

Monkey-patches `window.fetch`:

| Message | Purpose |
|---------|---------|
| `NETWORK_REQUEST` | Completed request with method, URL, headers, response body, duration, streaming status |
| `NETWORK_REQUEST_CHUNK` | Individual streaming chunk from a response |

Captures every request/response including streaming bodies chunk by chunk. The control plane sees all API calls the user's app makes.

## 6. Navigation + Storage Bridge

| Message | Direction | Purpose |
|---------|-----------|---------|
| `APP_READY` | iframe → parent | DOMContentLoaded / readyState signal |
| `URL_CHANGED` | iframe → parent | URL change notification |
| `NAVIGATE` | parent → iframe | Trigger `history.back()` / `history.forward()` |
| `GET_LOCALSTORAGE` | parent → iframe | Read iframe's localStorage |
| `LOCALSTORAGE_RESPONSE` | iframe → parent | localStorage data |
| `KEYBIND` | iframe → parent | Forward keyboard shortcuts |
| `SCROLL_HAPPENED` | iframe → parent | Scroll event notification |
| `SCROLL_POSITION` | iframe → parent | Current scroll position |
| `SCROLLABLE` | iframe → parent | Whether content is scrollable |

## Key Architectural Insight

The `VIRTUAL_OVERRIDE` mechanism combined with element inspection creates a two-phase editing model:

1. **Visual edit** → parent sends `SET_ELEMENT_CONTENT` / `SET_ELEMENT_ATTRS` for instant preview
2. **Commit** → agent writes the actual file change to disk via the sandbox

This means the user sees changes before they're real. The iframe is not just a viewer — it's a live editing surface.

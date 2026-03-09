# lovable-tagger

Vite plugin that injects JSX source tracking. Feature-flagged via `tagger-vite-override.enabled`.

## How It Works

- Intercepts `react/jsx-dev-runtime` import — resolves to a custom module (`\0jsx-source/jsx-dev-runtime`).
- Replaces `jsxDEV` with a version that attaches source info to DOM elements via `Symbol.for("__jsxSource__")`.
- Maintains a `window.sourceElementMap` using WeakRefs — maps `"file:line:col"` → `Set<WeakRef<Element>>`.
- Handles both host elements (`div`, `span`) and custom components (`<Button />`, `<Icon />`). For custom components, tags their rendered output with the JSX element name.
- Cleans internal sandbox paths: strips `/dev-server/` prefix, handles `sandbox-scheduler/sandbox` paths.

Same pattern as our `@alive-game/alive-tagger`.

## Tailwind Config Feature (bundled in same plugin)

- Resolves `tailwind.config.ts` via esbuild, generates `src/tailwind.config.lov.json` with the full resolved Tailwind config.
- Watches for config changes via Vite's watcher and regenerates.
- Used by the UI to know available theme values (colors, spacing, etc.) for visual editing.

## Integration with lovable.js

The tagger runs at dev time (Vite plugin), while `lovable.js` runs at runtime (CDN script). They connect via:

1. **Tagger** creates `window.sourceElementMap` with WeakRefs mapping source locations to DOM elements
2. **lovable.js** reads `sourceElementMap` to resolve clicked elements back to source file:line:col
3. **lovable.js** also reads `Symbol.for("__jsxSource__")` on elements for React Fiber integration

## Auto-installation

`lovable-exec` ensures tagger is installed:
- `EnsureLovableTaggerInstalled` — auto-installs `lovable-tagger@latest` if missing
- `UsesLovableTagger` — checks if project already has it
- Vite config override template includes `import { componentTagger } from "lovable-tagger"`

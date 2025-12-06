#!/usr/bin/env bun
/**
 * Build script for client-side bundles with React → Preact aliasing
 * This allows react-arborist and other React libraries to work with Preact
 */

import { mkdir } from "node:fs/promises"

const outdir = "dist/client"

// Ensure output directory exists
await mkdir(outdir, { recursive: true })

// Common build options with React aliasing for Preact compatibility
const commonOptions = {
  target: "browser" as const,
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  // Alias React to Preact for compatibility with React libraries like react-arborist
  alias: {
    react: "preact/compat",
    "react-dom": "preact/compat",
    "react/jsx-runtime": "preact/jsx-runtime",
  },
}

// Build upload.js
const uploadResult = await Bun.build({
  ...commonOptions,
  entrypoints: ["src/client/main.tsx"],
  outdir,
  naming: "upload.[ext]",
})

if (!uploadResult.success) {
  console.error("Failed to build upload.js:")
  console.error(uploadResult.logs)
  process.exit(1)
}
console.log("✓ Built upload.js")

// Build editor.js
const editorResult = await Bun.build({
  ...commonOptions,
  entrypoints: ["src/client/editor-main.tsx"],
  outdir,
  naming: "editor.[ext]",
})

if (!editorResult.success) {
  console.error("Failed to build editor.js:")
  console.error(editorResult.logs)
  process.exit(1)
}
console.log("✓ Built editor.js")

// Build shell-term.js
const shellResult = await Bun.build({
  ...commonOptions,
  entrypoints: ["src/client/shell-main.ts"],
  outdir,
  naming: "shell-term.[ext]",
})

if (!shellResult.success) {
  console.error("Failed to build shell-term.js:")
  console.error(shellResult.logs)
  process.exit(1)
}
console.log("✓ Built shell-term.js")

console.log("\n✅ All client bundles built successfully")

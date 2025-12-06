# Plan: Shared Assets MCP Tool

## Overview

Create an MCP tool that copies shared assets (fonts, icons, etc.) from git-tracked package to user workspaces.

## Problem

- Sites need fonts for good typography
- Copying fonts manually is error-prone
- Multi-server setup means symlinks don't work

## Key Insight: Privilege Model

**Tools already run as workspace user** (via `run-agent.mjs` privilege drop):
- Files created by tools are **automatically owned by workspace user**
- **No API route needed** - direct fs operations work
- **No chown needed** - ownership is correct from start
- Follow `install_package` pattern, NOT `delete_file` pattern

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  packages/tools/                                                │
│    ├── src/                                                     │
│    │   ├── assets/                  # INSIDE src/ for tsc copy  │
│    │   │   ├── manifest.json        # Asset whitelist + metadata│
│    │   │   └── fonts/satoshi/                                   │
│    │   │       └── *.woff2                                      │
│    │   ├── lib/assets.ts            # getAssetPath(), manifest  │
│    │   └── tools/workspace/copy-shared-asset.ts                 │
│    │       - Uses @webalive/shared resolveAndValidatePath (DRY!)│
│    │       - Uses Node.js fs to copy (runs as workspace user)   │
│    └── tsconfig.json                # Updated to copy assets    │
└─────────────────────────────────────────────────────────────────┘
```

**Why `src/assets/`?** TypeScript only processes `src/**/*`. Putting assets outside `src/` means they won't be in `dist/` after build.

**DRY Reuse:**
- `resolveAndValidatePath` from `@webalive/shared` (already imported)
- `errorResult`/`successResult` from existing bridge-api-client
- `validateWorkspacePath` from existing workspace-validator

## Implementation

### Step 1: Add assets directory to `packages/tools/src/`

**src/assets/manifest.json:**
```json
{
  "fonts/satoshi": {
    "description": "Satoshi - modern geometric sans-serif",
    "files": ["Satoshi-Variable.woff2", "Satoshi-VariableItalic.woff2"],
    "suggestedDest": "public/fonts",
    "primaryFile": "Satoshi-Variable.woff2"
  }
}
```

**src/assets/fonts/satoshi/** - Copy these files from `/srv/webalive/sites/alive.best/user/public/fonts/`:
- `Satoshi-Variable.woff2`
- `Satoshi-VariableItalic.woff2`

**Note:** Usage instructions are generated dynamically based on destination path (not hardcoded in manifest).

### Step 2: Create asset helpers in `packages/tools/src/lib/assets.ts`

```typescript
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const __dirname = dirname(fileURLToPath(import.meta.url))
// Path: dist/lib/assets.js -> dist/assets/
const ASSETS_ROOT = join(__dirname, "../assets")

// Validate manifest schema at runtime (fail fast on bad config)
const AssetConfigSchema = z.object({
  description: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
  suggestedDest: z.string().min(1),
  primaryFile: z.string().min(1),
})

const ManifestSchema = z.record(z.string(), AssetConfigSchema)

export type AssetConfig = z.infer<typeof AssetConfigSchema>
export type AssetManifest = z.infer<typeof ManifestSchema>

let _manifestCache: AssetManifest | null = null

export function getManifest(): AssetManifest {
  if (!_manifestCache) {
    const manifestPath = join(ASSETS_ROOT, "manifest.json")
    const raw = JSON.parse(readFileSync(manifestPath, "utf-8"))
    _manifestCache = ManifestSchema.parse(raw) // Throws if invalid
  }
  return _manifestCache
}

export function getAssetPath(asset: string): string {
  return join(ASSETS_ROOT, asset)
}

export function listAssets(): string[] {
  return Object.keys(getManifest())
}

/** Generate usage instructions dynamically based on destination */
export function generateUsageInstructions(primaryFile: string, destPath: string): { preload: string; css: string } {
  // Convert "public/fonts" -> "/fonts", "public/assets/fonts" -> "/assets/fonts"
  const webPath = destPath.replace(/^public/, "")
  const fontUrl = `${webPath}/${primaryFile}`

  return {
    preload: `<link rel="preload" href="${fontUrl}" as="font" type="font/woff2" crossorigin>`,
    css: `@font-face {
  font-family: "Satoshi";
  src: url("${fontUrl}") format("woff2-variations");
  font-weight: 300 900;
  font-display: swap;
}`,
  }
}

/** Generate tool description dynamically from manifest */
export function getAssetToolDescription(): string {
  const manifest = getManifest()
  const assetList = Object.entries(manifest)
    .map(([key, val]) => `- ${key}: ${val.description}`)
    .join("\n")

  return `Copy shared assets (fonts, icons) to your workspace with correct file ownership.

Available assets:
${assetList}

The tool copies files and returns usage instructions (preload tag + CSS).

Examples:
- copy_shared_asset({ asset: "fonts/satoshi" })
- copy_shared_asset({ asset: "fonts/satoshi", dest: "public/fonts/custom" })`
}
```

### Step 3: Create MCP tool

**src/tools/workspace/copy-shared-asset.ts:**
```typescript
import { existsSync, statSync } from "node:fs"
import { copyFile, mkdir, realpath } from "node:fs/promises"
import { join } from "node:path"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { resolveAndValidatePath } from "@webalive/shared"
import { errorResult, successResult, type ToolResult } from "../../lib/bridge-api-client.js"
import { validateWorkspacePath } from "../../lib/workspace-validator.js"
import {
  generateUsageInstructions,
  getAssetPath,
  getAssetToolDescription,
  getManifest,
  listAssets,
} from "../../lib/assets.js"

export const copySharedAssetParamsSchema = {
  asset: z.string().min(1).describe("Asset to copy (e.g., 'fonts/satoshi')"),
  dest: z.string().optional().describe("Destination path relative to workspace (default: asset's suggested destination)"),
}

export type CopySharedAssetParams = {
  asset: string
  dest?: string
}

/**
 * Copy shared assets to workspace.
 *
 * SECURITY MODEL (Direct Execution Pattern):
 * - Runs AFTER privilege drop (setuid/setgid to workspace user)
 * - Files are owned by workspace user automatically
 * - Asset whitelist prevents arbitrary file access
 * - Uses resolveAndValidatePath from @webalive/shared (DRY)
 */
export async function copySharedAsset(params: CopySharedAssetParams): Promise<ToolResult> {
  const { asset, dest } = params
  const workspaceRoot = process.cwd()

  try {
    validateWorkspacePath(workspaceRoot)

    const manifest = getManifest()
    const assetConfig = manifest[asset]

    if (!assetConfig) {
      return errorResult(`Unknown asset: ${asset}`, `Available: ${listAssets().join(", ")}`)
    }

    // Use existing path validation from @webalive/shared (DRY!)
    const destDir = dest || assetConfig.suggestedDest
    const validation = resolveAndValidatePath(destDir, workspaceRoot)
    if (!validation.valid) {
      return errorResult("Invalid destination", validation.error || "Path must be within workspace")
    }

    const sourcePath = getAssetPath(asset)
    if (!existsSync(sourcePath)) {
      return errorResult("Asset not found", `Source: ${sourcePath}`)
    }

    // Security: Resolve symlinks to ensure final path is still in workspace
    await mkdir(validation.resolvedPath, { recursive: true })
    const realDestPath = await realpath(validation.resolvedPath)
    if (!realDestPath.startsWith(workspaceRoot)) {
      return errorResult("Invalid destination", "Symlink points outside workspace")
    }

    const copiedFiles: string[] = []
    const skippedFiles: string[] = []

    for (const file of assetConfig.files) {
      const src = join(sourcePath, file)
      const dst = join(realDestPath, file)

      if (!existsSync(src)) {
        skippedFiles.push(file)
        continue
      }

      // Check if destination is a directory (would cause confusing error)
      if (existsSync(dst) && statSync(dst).isDirectory()) {
        return errorResult(`Cannot overwrite directory`, `${dst} is a directory, not a file`)
      }

      await copyFile(src, dst)
      copiedFiles.push(file)
    }

    if (copiedFiles.length === 0) {
      return errorResult("No files copied", `All source files missing: ${skippedFiles.join(", ")}`)
    }

    // Generate usage instructions based on actual destination
    const usage = generateUsageInstructions(assetConfig.primaryFile, destDir)

    const result = [
      `Copied ${copiedFiles.length} file(s) to ${destDir}/`,
      copiedFiles.map(f => `  - ${f}`).join("\n"),
    ]

    if (skippedFiles.length > 0) {
      result.push(`\nSkipped (not found): ${skippedFiles.join(", ")}`)
    }

    result.push(
      "",
      "**Add to index.html <head>:**",
      "```html",
      usage.preload,
      "```",
      "",
      "**Add to CSS:**",
      "```css",
      usage.css,
      "```",
    )

    return successResult(result.join("\n"))
  } catch (error) {
    // Provide helpful messages for common errors
    if (error instanceof Error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === "ENOSPC") {
        return errorResult("Disk full", "Not enough space to copy files")
      }
      if (code === "EACCES" || code === "EPERM") {
        return errorResult("Permission denied", `Cannot write to destination: ${error.message}`)
      }
    }
    return errorResult(`Failed to copy ${asset}`, error instanceof Error ? error.message : String(error))
  }
}

export const copySharedAssetTool = tool(
  "copy_shared_asset",
  getAssetToolDescription(),  // Generated from manifest (DRY!)
  copySharedAssetParamsSchema,
  async (args) => copySharedAsset(args)
)
```

### Step 4: Update tsconfig.json to copy assets

**packages/tools/tsconfig.json** - Add `resolveJsonModule` and copy script:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

**packages/tools/package.json** - Add post-build copy:
```json
{
  "scripts": {
    "build": "tsc && cp -r src/assets dist/"
  }
}
```

**Why:** TypeScript doesn't copy non-TS files. The `cp -r` ensures `dist/assets/` contains fonts and manifest.

### Step 5: Register tool

**packages/tools/src/mcp-server.ts:**
```typescript
import { copySharedAssetTool } from "./tools/workspace/copy-shared-asset.js"

export const workspaceInternalMcp = createSdkMcpServer({
  name: "alive-workspace",
  version: "1.0.0",
  tools: [
    restartServerTool,
    installPackageTool,
    checkCodebaseTool,
    deleteFileTool,
    switchServeModeTool,
    copySharedAssetTool,  // Add here
  ],
})
```

### Step 6: Add to tool registry

**packages/tools/src/tools/meta/tool-registry.ts:**
```typescript
{
  name: "copy_shared_asset",
  category: "workspace",
  description: "Copy shared assets (fonts, icons) to workspace with correct ownership",
  contextCost: "low",
  enabled: true,
  parameters: [
    { name: "asset", type: "string", required: true, description: "Asset to copy (e.g., 'fonts/satoshi')" },
    { name: "dest", type: "string", required: false, description: "Destination path relative to workspace root" },
  ],
}
```

### Step 7: Register in allowedTools

**apps/web/app/api/claude/stream/route.ts** and **apps/web/scripts/run-agent.mjs:**
```typescript
allowedTools: [
  // ... existing tools
  "mcp__alive-workspace__copy_shared_asset",
]
```

## Files Summary

| File | Action |
|------|--------|
| `packages/tools/src/assets/manifest.json` | Create |
| `packages/tools/src/assets/fonts/satoshi/*.woff2` | Copy from alive.best |
| `packages/tools/src/lib/assets.ts` | Create |
| `packages/tools/src/tools/workspace/copy-shared-asset.ts` | Create |
| `packages/tools/src/mcp-server.ts` | Add import + register |
| `packages/tools/src/tools/meta/tool-registry.ts` | Add metadata |
| `packages/tools/package.json` | Update build script |
| `apps/web/app/api/claude/stream/route.ts` | Add to allowedTools |
| `apps/web/scripts/run-agent.mjs` | Add to allowedTools |

## Security

1. **Asset whitelist** - Only assets in manifest.json can be copied
2. **Path traversal protection** - Uses `resolveAndValidatePath()` from `@webalive/shared` (DRY!)
3. **No arbitrary source** - Source fixed to `packages/tools/src/assets/`
4. **Workspace validation** - Uses existing `validateWorkspacePath()`
5. **Auto-ownership** - Files owned by workspace user (no chown needed, no API route needed)
6. **Manifest validation** - Zod schema validates manifest at runtime (fail fast on bad config)

## Limitations

1. **Hardcoded font-family** - `generateUsageInstructions()` outputs `font-family: "Satoshi"`. Future: add `fontFamily` field to manifest.
2. **No overwrite protection** - Silently overwrites existing files. Could add `--force` flag later.
3. **Single server for now** - Assets bundled with tools package. Multi-server: consider git-lfs or S3.

## Edge Cases Handled

| Edge Case | Solution |
|-----------|----------|
| Parent dirs don't exist | `mkdir({ recursive: true })` |
| Unknown asset | Error with available assets list |
| Path traversal (`../`) | `resolveAndValidatePath()` blocks |
| Symlink escape | `realpath()` + re-check workspace boundary |
| Dest file is a directory | Explicit check with clear error |
| Disk full (ENOSPC) | Friendly "Disk full" error |
| Permission denied | Friendly error with details |
| Source file missing | Skipped + reported |
| All sources missing | Error returned |
| Invalid manifest | Zod validation fails fast |

## Testing

**src/tools/workspace/__tests__/copy-shared-asset.test.ts:**
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { copySharedAsset } from "../copy-shared-asset.js"

// Mock workspace validation
vi.mock("../../../lib/workspace-validator.js", () => ({
  validateWorkspacePath: vi.fn(),
}))

describe("copySharedAsset", () => {
  const originalCwd = process.cwd

  beforeEach(() => {
    process.cwd = () => "/srv/webalive/sites/test.com/user"
  })

  afterEach(() => {
    process.cwd = originalCwd
  })

  it("rejects unknown assets", async () => {
    const result = await copySharedAsset({ asset: "fonts/unknown" })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Unknown asset")
  })

  it("rejects path traversal in dest", async () => {
    const result = await copySharedAsset({ asset: "fonts/satoshi", dest: "../../../etc" })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Invalid destination")
  })

  it("copies files to suggested destination", async () => {
    const result = await copySharedAsset({ asset: "fonts/satoshi" })
    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("Copied")
  })

  it("rejects symlink escape attempts", async () => {
    // Setup: create symlink public/fonts -> /tmp
    const result = await copySharedAsset({ asset: "fonts/satoshi", dest: "public/fonts" })
    // If symlink points outside workspace, should fail
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("outside workspace")
  })

  it("rejects when dest file is a directory", async () => {
    // Setup: mkdir public/fonts/Satoshi-Variable.woff2 (dir with same name as file)
    const result = await copySharedAsset({ asset: "fonts/satoshi" })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("directory")
  })
})
```

```bash
# Run tests
cd packages/tools && bun run test copy-shared-asset

# Manual test
# 1. Deploy to staging
# 2. In chat: "copy satoshi fonts to my project"
# 3. Verify files exist with correct ownership:
#    ls -la /srv/webalive/sites/example.com/user/public/fonts/
```

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const __dirname = dirname(fileURLToPath(import.meta.url))
// Path: dist/lib/assets.js -> dist/assets/
const ASSETS_ROOT = join(__dirname, "../assets")

const FontVariantSchema = z.object({
  file: z.string().min(1),
  weight: z.number(),
  style: z.enum(["normal", "italic"]),
})

// Validate manifest schema at runtime (fail fast on bad config)
const AssetConfigSchema = z.object({
  description: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
  suggestedDest: z.string().min(1),
  primaryFile: z.string().min(1),
  fontFamily: z.string().min(1),
  type: z.enum(["variable", "static"]),
  weightRange: z.string().optional(),
  variants: z.array(FontVariantSchema).optional(),
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

/** Generate usage instructions dynamically from asset config */
export function generateUsageInstructions(config: AssetConfig, destPath: string): { preload: string; css: string } {
  // Convert "public/fonts" -> "/fonts", "public/assets/fonts" -> "/assets/fonts"
  const webPath = destPath.replace(/^public/, "")

  const preload = `<link rel="preload" href="${webPath}/${config.primaryFile}" as="font" type="font/woff2" crossorigin>`

  let css: string
  if (config.type === "variable") {
    css = `@font-face {
  font-family: "${config.fontFamily}";
  src: url("${webPath}/${config.primaryFile}") format("woff2-variations");
  font-weight: ${config.weightRange};
  font-display: swap;
}`
  } else {
    css = (config.variants ?? [])
      .map(
        v => `@font-face {
  font-family: "${config.fontFamily}";
  src: url("${webPath}/${v.file}") format("woff2");
  font-weight: ${v.weight};
  font-style: ${v.style};
  font-display: swap;
}`,
      )
      .join("\n\n")
  }

  return { preload, css }
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

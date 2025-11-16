import { TEMPLATE_IDS, type VersionedTemplateId, versionedId } from "./template-ids"

// Re-export for convenience
export { TEMPLATE_IDS, versionedId }
export type { VersionedTemplateId }

export interface Template {
  id: string
  templateId: VersionedTemplateId // MCP template ID (e.g., "carousel-thumbnails-v1.0.0")
  name: string
  category: "sliders" | "maps" | "file-upload" | "backend" | "content-management" | "frontend"
  description: string
  previewImage: string
  tags: string[]
  complexity: 1 | 2 | 3
  fileCount: number
  dependencies: string[]
  estimatedTime: string
  estimatedTokens: number // Hidden in UI - can re-enable with feature flag
}

export const templates: Template[] = [
  // SLIDERS
  {
    id: TEMPLATE_IDS.CAROUSEL_THUMBNAILS,
    templateId: versionedId(TEMPLATE_IDS.CAROUSEL_THUMBNAILS, "v1.0.0"),
    name: "Carousel with Thumbnails",
    category: "sliders",
    description: "Advanced carousel with thumbnail navigation below. Click thumbnails to jump to slides.",
    previewImage: "https://terminal.goalive.nl/_images/t/protino.alive.best/o/d15b2037bf21c90e/v/orig.webp",
    tags: ["react", "carousel", "thumbnails"],
    complexity: 2,
    fileCount: 4,
    dependencies: ["swiper"],
    estimatedTime: "4-5 minutes",
    estimatedTokens: 18,
  },

  // MAPS
  {
    id: TEMPLATE_IDS.MAP_BASIC_MARKERS,
    templateId: versionedId(TEMPLATE_IDS.MAP_BASIC_MARKERS, "v1.0.0"),
    name: "Interactive Map with Markers",
    category: "maps",
    description: "Leaflet map with custom markers and popups. Click markers to see location details.",
    previewImage: "https://terminal.goalive.nl/_images/t/protino.alive.best/o/5db9ecf5ddb7e5e7/v/orig.webp",
    tags: ["leaflet", "maps", "markers"],
    complexity: 2,
    fileCount: 4,
    dependencies: ["leaflet", "react-leaflet"],
    estimatedTime: "4-5 minutes",
    estimatedTokens: 20,
  },

  // FILE UPLOAD
  {
    id: TEMPLATE_IDS.UPLOAD_IMAGE_CROP,
    templateId: versionedId(TEMPLATE_IDS.UPLOAD_IMAGE_CROP, "v1.0.0"),
    name: "Image Upload with Crop",
    category: "file-upload",
    description: "Upload images with built-in cropping tool. Crop to specific aspect ratios before upload.",
    previewImage: "/templates/previews/placeholder.svg",
    tags: ["react", "image", "crop"],
    complexity: 3,
    fileCount: 6,
    dependencies: ["react-dropzone", "react-easy-crop"],
    estimatedTime: "7-8 minutes",
    estimatedTokens: 28,
  },

  // BACKEND
  {
    id: TEMPLATE_IDS.VITE_API_PLUGIN,
    templateId: versionedId(TEMPLATE_IDS.VITE_API_PLUGIN, "v1.0.0"),
    name: "Add a Database & Server",
    category: "backend",
    description:
      "Turn your website into a full app with its own database. Save data, load data, and create your own server routes - all in one place.",
    previewImage: "https://terminal.goalive.nl/_images/t/alive.best/o/1b98911009639b0d/v/orig.webp",
    tags: ["backend", "database", "server", "api"],
    complexity: 2,
    fileCount: 4,
    dependencies: ["better-sqlite3"],
    estimatedTime: "8-12 minutes",
    estimatedTokens: 85,
  },

  // CONTENT MANAGEMENT
  {
    id: TEMPLATE_IDS.RECIPE_SYSTEM_INTERACTIVE,
    templateId: versionedId(TEMPLATE_IDS.RECIPE_SYSTEM_INTERACTIVE, "v1.0.0"),
    name: "Interactive Recipe System",
    category: "content-management",
    description:
      "Professional recipe management with clickable ingredient tooltips, click-to-hide ingredients, localStorage persistence, and chef's workflow document.",
    previewImage: "https://terminal.goalive.nl/_images/t/riggedwheel.alive.best/o/8360a2eb511f1141/v/orig.webp",
    tags: ["recipes", "food", "content", "interactive", "tooltips"],
    complexity: 3,
    fileCount: 7,
    dependencies: ["@radix-ui/react-tooltip", "react-router-dom"],
    estimatedTime: "25-30 minutes",
    estimatedTokens: 120,
  },

  // FRONTEND
  {
    id: TEMPLATE_IDS.ZUSTAND,
    templateId: versionedId(TEMPLATE_IDS.ZUSTAND, "v1.0.0"),
    name: "Zustand State Management",
    category: "frontend",
    description:
      "Best practices for using Zustand in Vite + React applications with vanilla stores, Providers, performance patterns, and persistence.",
    previewImage: "/templates/previews/placeholder.svg",
    tags: ["zustand", "state", "react", "vite", "typescript"],
    complexity: 2,
    fileCount: 4,
    dependencies: ["zustand"],
    estimatedTime: "10-15 minutes",
    estimatedTokens: 60,
  },
]

export function getTemplatesByCategory(category: Template["category"]): Template[] {
  return templates.filter(t => t.category === category)
}

export function getTemplateById(id: string): Template | undefined {
  return templates.find(t => t.id === id)
}

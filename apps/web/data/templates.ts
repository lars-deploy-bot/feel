import { TEMPLATE_IDS, type VersionedTemplateId, versionedId } from "./template-ids"

// Re-export for convenience
export { TEMPLATE_IDS, versionedId }
export type { VersionedTemplateId }

// Single source of truth for categories
export const TEMPLATE_CATEGORIES = {
  components: "Components",
  setup: "Setup",
} as const

export type TemplateCategory = keyof typeof TEMPLATE_CATEGORIES

export interface Template {
  id: string
  templateId: VersionedTemplateId
  name: string
  category: TemplateCategory
  description: string
  previewImage: string
  tags: string[]
  complexity: 1 | 2 | 3
  fileCount: number
  dependencies: string[]
  estimatedTime: string
  estimatedTokens: number
}

export const templates: Template[] = [
  // COMPONENTS - Visual/interactive UI elements
  {
    id: TEMPLATE_IDS.CAROUSEL_THUMBNAILS,
    templateId: versionedId(TEMPLATE_IDS.CAROUSEL_THUMBNAILS, "v1.0.0"),
    name: "Carousel with Thumbnails",
    category: "components",
    description: "Advanced carousel with thumbnail navigation below. Click thumbnails to jump to slides.",
    previewImage: "https://terminal.goalive.nl/_images/t/protino.alive.best/o/d15b2037bf21c90e/v/orig.webp",
    tags: ["react", "carousel", "thumbnails", "slider"],
    complexity: 2,
    fileCount: 4,
    dependencies: ["swiper"],
    estimatedTime: "4-5 minutes",
    estimatedTokens: 18,
  },
  {
    id: TEMPLATE_IDS.MAP_BASIC_MARKERS,
    templateId: versionedId(TEMPLATE_IDS.MAP_BASIC_MARKERS, "v1.0.0"),
    name: "Interactive Map with Markers",
    category: "components",
    description: "Leaflet map with custom markers and popups. Click markers to see location details.",
    previewImage: "https://terminal.goalive.nl/_images/t/protino.alive.best/o/5db9ecf5ddb7e5e7/v/orig.webp",
    tags: ["leaflet", "maps", "markers"],
    complexity: 2,
    fileCount: 4,
    dependencies: ["leaflet", "react-leaflet"],
    estimatedTime: "4-5 minutes",
    estimatedTokens: 20,
  },
  {
    id: TEMPLATE_IDS.UPLOAD_IMAGE_CROP,
    templateId: versionedId(TEMPLATE_IDS.UPLOAD_IMAGE_CROP, "v1.0.0"),
    name: "Image Upload with Crop",
    category: "components",
    description: "Upload images with built-in cropping tool. Crop to specific aspect ratios before upload.",
    previewImage: "/templates/previews/placeholder.svg",
    tags: ["react", "image", "crop", "upload"],
    complexity: 3,
    fileCount: 6,
    dependencies: ["react-dropzone", "react-easy-crop"],
    estimatedTime: "7-8 minutes",
    estimatedTokens: 28,
  },
  {
    id: TEMPLATE_IDS.RECIPE_SYSTEM_INTERACTIVE,
    templateId: versionedId(TEMPLATE_IDS.RECIPE_SYSTEM_INTERACTIVE, "v1.0.0"),
    name: "Interactive Recipe System",
    category: "components",
    description:
      "Professional recipe management with clickable ingredient tooltips, click-to-hide ingredients, localStorage persistence.",
    previewImage: "https://terminal.goalive.nl/_images/t/riggedwheel.alive.best/o/8360a2eb511f1141/v/orig.webp",
    tags: ["recipes", "food", "content", "interactive", "tooltips"],
    complexity: 3,
    fileCount: 7,
    dependencies: ["@radix-ui/react-tooltip", "react-router-dom"],
    estimatedTime: "25-30 minutes",
    estimatedTokens: 120,
  },

  // SETUP - Backend, state, configuration
  {
    id: TEMPLATE_IDS.VITE_API_PLUGIN,
    templateId: versionedId(TEMPLATE_IDS.VITE_API_PLUGIN, "v1.0.0"),
    name: "Add a Database & Server",
    category: "setup",
    description:
      "Turn your website into a full app with its own database. Save data, load data, and create your own server routes.",
    previewImage: "https://terminal.goalive.nl/_images/t/alive.best/o/1b98911009639b0d/v/orig.webp",
    tags: ["backend", "database", "server", "api", "sqlite"],
    complexity: 2,
    fileCount: 4,
    dependencies: ["better-sqlite3"],
    estimatedTime: "8-12 minutes",
    estimatedTokens: 85,
  },
  {
    id: TEMPLATE_IDS.ZUSTAND,
    templateId: versionedId(TEMPLATE_IDS.ZUSTAND, "v1.0.0"),
    name: "Zustand State Management",
    category: "setup",
    description:
      "Best practices for Zustand in Vite + React with vanilla stores, Providers, performance patterns, and persistence.",
    previewImage: "/templates/previews/placeholder.svg",
    tags: ["zustand", "state", "react", "vite", "typescript"],
    complexity: 2,
    fileCount: 4,
    dependencies: ["zustand"],
    estimatedTime: "10-15 minutes",
    estimatedTokens: 60,
  },
  {
    id: TEMPLATE_IDS.CUSTOM_FONTS,
    templateId: versionedId(TEMPLATE_IDS.CUSTOM_FONTS, "v1.0.0"),
    name: "Custom Fonts Library",
    category: "setup",
    description: "Self-hosted font library with Satoshi, Helvetica Now, and Inter Display. No CDN dependencies.",
    previewImage: "/templates/previews/placeholder.svg",
    tags: ["font", "typography", "satoshi", "helvetica", "inter", "tailwind"],
    complexity: 1,
    fileCount: 2,
    dependencies: [],
    estimatedTime: "3-5 minutes",
    estimatedTokens: 40,
  },
]

export function getTemplatesByCategory(category: Template["category"]): Template[] {
  return templates.filter(t => t.category === category)
}

export function getTemplateById(id: string): Template | undefined {
  return templates.find(t => t.id === id)
}

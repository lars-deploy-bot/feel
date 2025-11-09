import { TEMPLATE_IDS, type VersionedTemplateId, versionedId } from "./template-ids"

// Re-export for convenience
export { TEMPLATE_IDS, versionedId }
export type { VersionedTemplateId }

export interface Template {
  id: string
  templateId: VersionedTemplateId // MCP template ID (e.g., "carousel-thumbnails-v1.0.0")
  name: string
  category: "sliders" | "maps" | "file-upload" | "blog"
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

  // BLOG
  {
    id: TEMPLATE_IDS.BLOG_CMS_SYSTEM,
    templateId: versionedId(TEMPLATE_IDS.BLOG_CMS_SYSTEM, "v1.0.0"),
    name: "Complete Blog CMS",
    category: "blog",
    description: "Full blog content management system with posts, categories, tags, and publishing workflow.",
    previewImage: "https://terminal.goalive.nl/_images/t/protino.alive.best/o/7459f48217d69634/v/orig.webp",
    tags: ["cms", "blog", "admin"],
    complexity: 3,
    fileCount: 12,
    dependencies: ["react-markdown", "date-fns", "zustand"],
    estimatedTime: "15-20 minutes",
    estimatedTokens: 55,
  },
]

export function getTemplatesByCategory(category: Template["category"]): Template[] {
  return templates.filter(t => t.category === category)
}

export function getTemplateById(id: string): Template | undefined {
  return templates.find(t => t.id === id)
}

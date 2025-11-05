import { FilesystemStorage } from "@alive-brug/images"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { workspaceToTenantId } from "@/lib/tenant-utils"
import { hasSessionCookie } from "@/features/auth/types/guards"

// Initialize storage
const storage = new FilesystemStorage({
  basePath: process.env.IMAGES_STORAGE_PATH || "/srv/webalive/storage",
  signatureSecret: process.env.IMAGES_SIGNATURE_SECRET,
})

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const jar = await cookies()
    if (!hasSessionCookie(jar)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Resolve workspace (same logic as upload)
    const host = request.headers.get("host") || ""
    const searchParams = request.nextUrl.searchParams
    const workspaceParam = searchParams.get("workspace")
    const requestId = Math.random().toString(36).substring(7)

    const body = workspaceParam ? { workspace: workspaceParam } : {}

    const workspaceResult = resolveWorkspace(host, body, requestId)
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    // 3. Convert workspace to tenant ID
    const tenantId = workspaceToTenantId(workspaceResult.workspace)

    // 4. List images for this tenant
    const listResult = await storage.list(tenantId)
    if (listResult.error) {
      return Response.json({ error: "Failed to list images" }, { status: 500 })
    }

    // 5. Convert keys to structured format
    const images = listResult.data
      .map(key => {
        // Parse key: t/{tenantId}/o/{hash}/v/{variant}.webp
        const match = key.match(/^t\/([^/]+)\/o\/([^/]+)\/v\/([^.]+)\.webp$/)
        if (!match) return null

        const [, , contentHash, variant] = match
        return { contentHash, variant, key }
      })
      .filter(Boolean)

    // 6. Group by content hash and create variant URLs
    const groupedImages: Record<string, any> = {}
    for (const img of images) {
      if (!img) continue

      if (!groupedImages[img.contentHash]) {
        groupedImages[img.contentHash] = {
          key: `${tenantId}/${img.contentHash}`,
          variants: {},
          uploadedAt: new Date().toISOString(), // TODO: get actual timestamp
        }
      }

      groupedImages[img.contentHash].variants[img.variant] = img.key
    }

    const formattedImages = Object.values(groupedImages)

    return Response.json({
      success: true,
      images: formattedImages,
      count: formattedImages.length,
    })
  } catch (error) {
    console.error("List images error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

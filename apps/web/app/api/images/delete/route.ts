import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { imageStorage } from "@/lib/storage"
import { workspaceToTenantId } from "@/lib/tenant-utils"
import { generateRequestId } from "@/lib/utils"

export async function DELETE(request: NextRequest) {
  try {
    // 1. Auth check
    const jar = await cookies()
    if (!hasSessionCookie(jar)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse request body
    const body = await request.json()
    const { key } = body

    if (!key || typeof key !== "string") {
      return Response.json({ error: "Image key required" }, { status: 400 })
    }

    // 3. Resolve workspace (same logic as upload/list)
    const host = request.headers.get("host") || ""
    const requestId = generateRequestId()

    const workspaceResult = resolveWorkspace(host, body, requestId)
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    // 4. Convert workspace to tenant ID
    const tenantId = workspaceToTenantId(workspaceResult.workspace)

    // 5. Validate key belongs to this tenant
    // Key format: {tenantId}/{contentHash}
    if (!key.startsWith(`${tenantId}/`)) {
      return Response.json({ error: "Access denied" }, { status: 403 })
    }

    const contentHash = key.replace(`${tenantId}/`, "")

    // 6. List all variants for this content hash
    const listResult = await imageStorage.list(tenantId, contentHash)
    if (listResult.error) {
      return Response.json({ error: "Failed to find image" }, { status: 404 })
    }

    // 7. Delete all variants
    const deletePromises = listResult.data.map(async variantKey => {
      const deleteResult = await imageStorage.delete(variantKey)
      if (deleteResult.error) {
        console.error(`Failed to delete variant ${variantKey}:`, deleteResult.error)
      }
      return deleteResult
    })

    await Promise.all(deletePromises)

    return Response.json({
      success: true,
      message: `Deleted ${listResult.data.length} variants`,
    })
  } catch (error) {
    console.error("Delete image error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

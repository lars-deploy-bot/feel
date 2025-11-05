import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { imageStorage } from "@/lib/storage"
import { workspaceToTenantId } from "@/lib/tenant-utils"
import { generateRequestId } from "@/lib/utils"

export async function DELETE(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    // 1. Auth check
    const jar = await cookies()
    if (!hasSessionCookie(jar)) {
      return Response.json(
        {
          ok: false,
          error: ErrorCodes.UNAUTHORIZED,
          message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
          requestId,
        },
        { status: 401 },
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const { key } = body

    if (!key || typeof key !== "string") {
      return Response.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: getErrorMessage(ErrorCodes.INVALID_REQUEST, { field: "key" }),
          requestId,
        },
        { status: 400 },
      )
    }

    // 3. Resolve workspace (same logic as upload/list)
    const host = request.headers.get("host") || ""

    const workspaceResult = resolveWorkspace(host, body, requestId)
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    // 4. Convert workspace to tenant ID
    const tenantId = workspaceToTenantId(workspaceResult.workspace)

    // 5. Validate key belongs to this tenant
    // Key format: {tenantId}/{contentHash}
    if (!key.startsWith(`${tenantId}/`)) {
      return Response.json(
        {
          ok: false,
          error: ErrorCodes.UNAUTHORIZED,
          message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
          requestId,
        },
        { status: 403 },
      )
    }

    const contentHash = key.replace(`${tenantId}/`, "")

    // 6. List all variants for this content hash
    const listResult = await imageStorage.list(tenantId, contentHash)
    if (listResult.error) {
      return Response.json(
        {
          ok: false,
          error: ErrorCodes.IMAGE_DELETE_FAILED,
          message: getErrorMessage(ErrorCodes.IMAGE_DELETE_FAILED),
          requestId,
        },
        { status: 404 },
      )
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
    return Response.json(
      {
        ok: false,
        error: ErrorCodes.IMAGE_DELETE_FAILED,
        message: error instanceof Error ? error.message : "Failed to delete image",
        requestId,
      },
      { status: 500 },
    )
  }
}

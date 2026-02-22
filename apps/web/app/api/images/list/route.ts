import * as Sentry from "@sentry/nextjs"
import type { NextRequest } from "next/server"
import { getSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { imageStorage } from "@/lib/storage"
import { workspaceToTenantId } from "@/lib/tenant-utils"
import { generateRequestId } from "@/lib/utils"

interface ParsedImageKey {
  contentHash: string
  variant: string
  key: string
}

interface GroupedImage {
  key: string
  variants: Record<string, string>
  uploadedAt: string
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    // 1. Auth check
    const user = await getSessionUser()
    if (!user) {
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

    // 2. Build workspace body from query params
    const host = request.headers.get("host") || ""
    const searchParams = request.nextUrl.searchParams
    const workspaceParam = searchParams.get("workspace")
    const worktreeParam = searchParams.get("worktree")

    const body =
      workspaceParam && worktreeParam
        ? { workspace: workspaceParam, worktree: worktreeParam }
        : workspaceParam
          ? { workspace: workspaceParam }
          : {}

    // 3. Verify workspace authorization before path resolution
    const authorizedWorkspace = await verifyWorkspaceAccess(user, body, `[Image List ${requestId}]`)
    if (!authorizedWorkspace) {
      return Response.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_NOT_AUTHENTICATED,
          message: getErrorMessage(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED),
          requestId,
        },
        { status: 401 },
      )
    }

    // 4. Resolve workspace (same logic as upload/delete)
    const workspaceResult = await resolveWorkspace(host, body, requestId)
    if (!workspaceResult.success) {
      const errorBody = await workspaceResult.response.json()
      return Response.json({ ...errorBody, requestId }, { status: workspaceResult.response.status })
    }

    // 5. Convert workspace to tenant ID
    const tenantId = workspaceToTenantId(workspaceResult.workspace)

    // 6. List images for this tenant
    const listResult = await imageStorage.list(tenantId)
    if (listResult.error) {
      return Response.json(
        {
          ok: false,
          error: ErrorCodes.IMAGE_LIST_FAILED,
          message: getErrorMessage(ErrorCodes.IMAGE_LIST_FAILED),
          requestId,
        },
        { status: 500 },
      )
    }

    // 7. Convert keys to structured format
    const images: ParsedImageKey[] = listResult.data
      .map(key => {
        // Parse key: t/{tenantId}/o/{hash}/v/{variant}.webp
        const match = key.match(/^t\/([^/]+)\/o\/([^/]+)\/v\/([^.]+)\.webp$/)
        if (!match) return null

        const [, , contentHash, variant] = match
        return { contentHash, variant, key }
      })
      .filter((img): img is ParsedImageKey => img !== null)

    // 8. Group by content hash and create variant URLs
    const groupedImages: Record<string, GroupedImage> = {}
    for (const img of images) {
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

    // 9. Return grouped images
    return Response.json({
      ok: true,
      images: formattedImages,
      count: formattedImages.length,
    })
  } catch (error) {
    console.error("List images error:", error)
    Sentry.captureException(error)
    return Response.json(
      {
        ok: false,
        error: ErrorCodes.IMAGE_LIST_FAILED,
        message: error instanceof Error ? error.message : getErrorMessage(ErrorCodes.IMAGE_LIST_FAILED),
        requestId,
      },
      { status: 500 },
    )
  }
}

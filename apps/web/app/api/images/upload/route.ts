import { uploadImage } from "@alive-brug/images"
import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse, requireSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { ErrorCodes } from "@/lib/error-codes"
import { imageStorage } from "@/lib/storage"
import { workspaceToTenantId } from "@/lib/tenant-utils"
import { generateRequestId } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const requestId = generateRequestId()

    // 1. Get authenticated user
    const user = await requireSessionUser()

    // 2. Parse form data
    const formData = await request.formData()
    const host = request.headers.get("host") || "localhost"

    // 3. Security: Verify workspace authorization BEFORE any operations
    const workspaceParam = formData.get("workspace") as string | null
    const body = workspaceParam ? { workspace: workspaceParam } : {}

    const workspace = await verifyWorkspaceAccess(user, body, `[Upload ${requestId}]`)
    if (!workspace) {
      return createErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, 401, { requestId })
    }

    // 4. Resolve workspace path (after authorization)
    const workspaceResult = resolveWorkspace(host, body, requestId)
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    // 5. Convert workspace to tenant ID
    const tenantId = workspaceToTenantId(workspaceResult.workspace)

    // 6. Parse file from FormData (already parsed above)
    const file = formData.get("file") as File

    if (!file) {
      return createErrorResponse(ErrorCodes.NO_FILE, 400, { requestId })
    }

    // 7. Convert to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 8. Get options
    const compress = formData.get("compress") !== "false"
    const variantsParam = formData.get("variants")
    const variants = variantsParam
      ? (variantsParam as string).split(",").map(v => v.trim())
      : ["orig", "w640", "w1280", "thumb"]

    // 9. Upload via storage adapter
    const result = await uploadImage(imageStorage, tenantId, buffer, {
      visibility: "public",
      variants: variants as any,
      compress,
      maxWidth: 2560,
      targetSize: 500 * 1024,
    })

    if (result.error) {
      return createErrorResponse(ErrorCodes.IMAGE_UPLOAD_FAILED, 500, {
        errorCode: result.error.code,
        exception: result.error.message,
      })
    }

    // 10. Return success with photobook key format (tenantId/contentHash)
    return NextResponse.json({
      success: true,
      data: {
        key: `${tenantId}/${result.data.contentHash}`,
        ...result.data,
      },
    })
  } catch (error) {
    console.error("Upload error:", error)
    return createErrorResponse(ErrorCodes.IMAGE_UPLOAD_FAILED, 500, {
      exception: error instanceof Error ? error.message : "Failed to upload image",
    })
  }
}

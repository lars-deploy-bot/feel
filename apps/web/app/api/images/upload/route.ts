import { uploadImage } from "@alive-brug/images"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { ErrorCodes } from "@/lib/error-codes"
import { imageStorage } from "@/lib/storage"
import { workspaceToTenantId } from "@/lib/tenant-utils"
import { generateRequestId } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const jar = await cookies()
    if (!hasSessionCookie(jar.get("session"))) {
      return NextResponse.json({ error: ErrorCodes.NO_SESSION }, { status: 401 })
    }

    // 2. Parse form data first
    const formData = await request.formData()
    const host = request.headers.get("host") || "localhost"
    const requestId = generateRequestId()

    // 3. Resolve workspace (same logic as chat)
    const workspaceParam = formData.get("workspace") as string | null
    const body = workspaceParam ? { workspace: workspaceParam } : {}

    const workspaceResult = resolveWorkspace(host, body, requestId)
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    // 4. Convert workspace to tenant ID
    const tenantId = workspaceToTenantId(workspaceResult.workspace)

    // 5. Parse file from FormData (already parsed above)
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: ErrorCodes.NO_FILE }, { status: 400 })
    }

    // 4. Convert to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 5. Get options
    const compress = formData.get("compress") !== "false"
    const variantsParam = formData.get("variants")
    const variants = variantsParam
      ? (variantsParam as string).split(",").map(v => v.trim())
      : ["orig", "w640", "w1280", "thumb"]

    // 6. Upload via storage adapter
    const result = await uploadImage(imageStorage, tenantId, buffer, {
      visibility: "public",
      variants: variants as any,
      compress,
      maxWidth: 2560,
      targetSize: 500 * 1024,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error.code, message: result.error.message }, { status: 500 })
    }

    // 7. Return success
    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      {
        error: "server_error",
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    )
  }
}

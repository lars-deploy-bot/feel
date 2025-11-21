import { type NextRequest, NextResponse } from "next/server"
import { backupWebsites, DeploymentError } from "@webalive/site-controller"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
import { createCorsResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { generateRequestId } from "@/lib/utils"

/**
 * POST /api/manager/backup
 *
 * Backup websites to GitHub (eenlars/all_websites)
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  // Check manager authentication
  if (!(await isManagerAuthenticated())) {
    return createCorsResponse(
      origin,
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      401,
    )
  }

  try {
    console.log("[Manager] Starting website backup to GitHub")
    const stats = await backupWebsites()

    console.log("[Manager] Website backup completed successfully")

    return createCorsSuccessResponse(origin, {
      stats,
      message: "Websites backed up to GitHub successfully",
      requestId,
    })
  } catch (error) {
    console.error("[Manager] Website backup failed:", error)
    const message =
      error instanceof DeploymentError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to backup websites"
    return createCorsResponse(
      origin,
      {
        ok: false,
        error: "BACKUP_FAILED",
        message,
        requestId,
      },
      500,
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}

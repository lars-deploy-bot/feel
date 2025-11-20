import { type NextRequest, NextResponse } from "next/server"
import { backupWebsites, DeploymentError } from "@webalive/site-controller"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
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
    const res = NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  try {
    console.log("[Manager] Starting website backup to GitHub")
    const stats = await backupWebsites()

    console.log("[Manager] Website backup completed successfully")

    const res = NextResponse.json({
      ok: true,
      stats,
      message: "Websites backed up to GitHub successfully",
      requestId,
    })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Manager] Website backup failed:", error)
    const message =
      error instanceof DeploymentError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to backup websites"
    const res = NextResponse.json(
      {
        ok: false,
        error: "BACKUP_FAILED",
        message,
        requestId,
      },
      { status: 500 },
    )
    addCorsHeaders(res, origin)
    return res
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}

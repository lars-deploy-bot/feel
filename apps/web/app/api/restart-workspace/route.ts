import { execSync } from "node:child_process"
import { basename, dirname } from "node:path"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/features/auth/lib/auth"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"

const RestartSchema = z.object({
  workspaceRoot: z.string(),
})

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()
  try {
    const origin = req.headers.get("host")
    const isLocalhost = origin?.includes("localhost")

    if (!isLocalhost) {
      await requireSessionUser()
    }

    const body = await req.json()
    const parseResult = RestartSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: getErrorMessage(ErrorCodes.INVALID_REQUEST, { field: "workspaceRoot" }),
          requestId,
        },
        { status: 400 },
      )
    }

    const { workspaceRoot } = parseResult.data

    const sitePath = dirname(workspaceRoot)
    const domain = basename(sitePath)
    const serviceSlug = domain.replace(/\./g, "-")
    const serviceName = `site@${serviceSlug}.service`

    try {
      execSync(`systemctl restart ${serviceName}`, {
        encoding: "utf-8",
        timeout: 10000,
      })

      return NextResponse.json({
        ok: true,
        service: serviceName,
        message: `Dev server restarted: ${serviceName}`,
        requestId,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_RESTART_FAILED,
          message: getErrorMessage(ErrorCodes.WORKSPACE_RESTART_FAILED),
          details: {
            service: serviceName,
            error: errorMessage,
          },
          requestId,
        },
        { status: 500 },
      )
    }
  } catch (_error) {
    return NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.UNAUTHORIZED,
        message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
        requestId,
      },
      { status: 401 },
    )
  }
}

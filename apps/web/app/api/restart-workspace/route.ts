import { execSync } from "node:child_process"
import { basename, dirname } from "node:path"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/features/auth/lib/auth"

const RestartSchema = z.object({
  workspaceRoot: z.string(),
})

export async function POST(req: Request) {
  try {
    const origin = req.headers.get("host")
    const isLocalhost = origin?.includes("localhost")

    if (!isLocalhost) {
      await requireSessionUser()
    }

    const body = await req.json()
    const parseResult = RestartSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 })
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
        success: true,
        service: serviceName,
        message: `Dev server restarted: ${serviceName}`,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      return NextResponse.json(
        {
          success: false,
          service: serviceName,
          message: `Failed to restart ${serviceName}: ${errorMessage}`,
        },
        { status: 500 },
      )
    }
  } catch (_error) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }
}

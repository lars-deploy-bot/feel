import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { getWorkspace } from "@/features/chat/lib/workspaceRetriever"
import { isPathWithinWorkspace } from "@/features/workspace/types/workspace"
import { COOKIE_NAMES } from "@/lib/auth/cookies"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { generateRequestId } from "@/lib/utils"

interface FileInfo {
  name: string
  type: "file" | "directory"
  size: number
  modified: string
  path: string
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    const jar = await cookies()
    if (!hasSessionCookie(jar.get(COOKIE_NAMES.SESSION))) {
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.NO_SESSION,
          message: getErrorMessage(ErrorCodes.NO_SESSION),
          requestId,
        },
        { status: 401 },
      )
    }

    const body = await request.json()
    const host = request.headers.get("host") || "localhost"

    const workspaceResult = getWorkspace({ host, body, requestId })
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    const targetPath = body.path || ""
    const fullPath = path.join(workspaceResult.workspace, targetPath)

    // Security check: ensure path is within workspace
    const resolvedPath = path.resolve(fullPath)
    const resolvedWorkspace = path.resolve(workspaceResult.workspace)
    if (!isPathWithinWorkspace(resolvedPath, resolvedWorkspace, path.sep)) {
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.PATH_OUTSIDE_WORKSPACE,
          message: getErrorMessage(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
            attemptedPath: resolvedPath,
            workspacePath: resolvedWorkspace,
          }),
          details: {
            attemptedPath: resolvedPath,
            workspacePath: resolvedWorkspace,
          },
          requestId,
        },
        { status: 403 },
      )
    }

    try {
      const entries = await readdir(fullPath, { withFileTypes: true })
      const files: FileInfo[] = []

      for (const entry of entries) {
        const entryPath = path.join(fullPath, entry.name)
        const stats = await stat(entryPath)

        files.push({
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
          size: stats.size,
          modified: stats.mtime.toISOString(),
          path: path.join(targetPath, entry.name),
        })
      }

      // Sort: directories first, then files, alphabetically
      files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      return NextResponse.json({
        ok: true,
        path: targetPath,
        workspace: workspaceResult.workspace,
        files,
      })
    } catch (fsError) {
      console.error(`[Files ${requestId}] Error reading directory:`, fsError)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.FILE_READ_ERROR,
          message: getErrorMessage(ErrorCodes.FILE_READ_ERROR, {
            filePath: targetPath,
          }),
          details: {
            path: targetPath,
            error: fsError instanceof Error ? fsError.message : "Unknown error",
          },
          requestId,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Files API error:", error)
    return NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.REQUEST_PROCESSING_FAILED,
        message: getErrorMessage(ErrorCodes.REQUEST_PROCESSING_FAILED),
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        requestId,
      },
      { status: 500 },
    )
  }
}

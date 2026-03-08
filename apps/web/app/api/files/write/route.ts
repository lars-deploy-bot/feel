import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import * as Sentry from "@sentry/nextjs"
import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { getWorkspace } from "@/features/chat/lib/workspaceRetriever"
import { ensureDirectoryAsWorkspaceOwner, writeAsWorkspaceOwner } from "@/features/workspace/lib/workspace-secure"
import { isPathWithinWorkspace } from "@/features/workspace/types/workspace"
import { structuredErrorResponse } from "@/lib/api/responses"
import { type ResolvedDomain, resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"
import { getRequestId } from "@/lib/request-id"
import { connectSandbox, SANDBOX_WORKSPACE_ROOT, SandboxNotReadyError } from "@/lib/sandbox/connect-sandbox"

const MAX_CONTENT_SIZE = 1024 * 1024

interface WriteRequestBody {
  [key: string]: unknown
  content?: string
  path?: string
  workspace?: string
  worktree?: string
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

function isInvalidRelativeWritePath(filePath: string): boolean {
  const normalized = path.normalize(filePath)
  return normalized === "." || normalized === "" || normalized.startsWith("..") || path.isAbsolute(normalized)
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401, details: { requestId } })
    }

    let body: WriteRequestBody
    try {
      body = await request.json()
    } catch (_e) {
      return structuredErrorResponse(ErrorCodes.INVALID_JSON, { status: 400, details: { requestId } })
    }

    const authorizedWorkspace = await verifyWorkspaceAccess(user, body, `[Files/Write ${requestId}]`)
    if (!authorizedWorkspace) {
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, { status: 403, details: { requestId } })
    }

    const targetPath = body.path
    if (!targetPath || typeof targetPath !== "string") {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { requestId, message: "Missing required field: path" },
      })
    }

    const content = body.content
    if (typeof content !== "string") {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { requestId, message: "Missing required field: content" },
      })
    }

    if (content.length > MAX_CONTENT_SIZE) {
      return structuredErrorResponse(ErrorCodes.FILE_TOO_LARGE_TO_READ, {
        status: 400,
        details: { requestId, filePath: targetPath, size: content.length, maxSize: MAX_CONTENT_SIZE },
      })
    }

    if (body.workspace) {
      const domain = await resolveDomainRuntime(body.workspace)
      if (domain?.execution_mode === "e2b") {
        return handleE2bWrite(domain, targetPath, content, requestId)
      }
    }

    const host = request.headers.get("host") || "localhost"
    const workspaceResult = await getWorkspace({ host, body, requestId })
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    let resolvedWorkspace: string
    try {
      resolvedWorkspace = await realpath(workspaceResult.workspace)
    } catch (_e) {
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_FOUND, { status: 404, details: { requestId } })
    }

    const resolvedPath = path.resolve(path.join(resolvedWorkspace, targetPath))
    if (resolvedPath === resolvedWorkspace || !isPathWithinWorkspace(resolvedPath, resolvedWorkspace, path.sep)) {
      console.warn(`[Files/Write ${requestId}] Path traversal blocked: ${targetPath} -> ${resolvedPath}`)
      return structuredErrorResponse(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
        status: 403,
        details: { requestId, attemptedPath: targetPath, workspacePath: resolvedWorkspace },
      })
    }

    try {
      const existingTarget = await stat(resolvedPath)
      if (existingTarget.isDirectory()) {
        return structuredErrorResponse(ErrorCodes.PATH_IS_DIRECTORY, {
          status: 400,
          details: { requestId, filePath: targetPath },
        })
      }
    } catch (error) {
      if (!isErrnoException(error) || error.code !== "ENOENT") {
        throw error
      }
    }

    try {
      const workspaceStats = await stat(resolvedWorkspace)
      const owner = { uid: workspaceStats.uid, gid: workspaceStats.gid }

      await ensureDirectoryAsWorkspaceOwner(path.dirname(resolvedPath), resolvedWorkspace, owner)
      writeAsWorkspaceOwner(resolvedPath, content, owner)

      return NextResponse.json({ ok: true, path: targetPath })
    } catch (error) {
      if (isErrnoException(error) && error.code === "EISDIR") {
        return structuredErrorResponse(ErrorCodes.PATH_IS_DIRECTORY, {
          status: 400,
          details: { requestId, filePath: targetPath },
        })
      }

      console.error(`[Files/Write ${requestId}] Error writing file:`, error)
      Sentry.captureException(error)
      return structuredErrorResponse(ErrorCodes.FILE_WRITE_ERROR, {
        status: 500,
        details: { requestId, filePath: targetPath, error: error instanceof Error ? error.message : "Unknown error" },
      })
    }
  } catch (error) {
    console.error(`[Files/Write ${requestId}] Unexpected error:`, error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.FILE_WRITE_ERROR, {
      status: 500,
      details: { requestId, error: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}

async function handleE2bWrite(
  domain: ResolvedDomain,
  targetPath: string,
  content: string,
  requestId: string,
): Promise<NextResponse> {
  if (isInvalidRelativeWritePath(targetPath)) {
    return structuredErrorResponse(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
      status: 403,
      details: { requestId },
    })
  }

  try {
    const sandbox = await connectSandbox(domain)
    const sandboxPath = path.join(SANDBOX_WORKSPACE_ROOT, targetPath)
    await sandbox.files.write(sandboxPath, content)
    return NextResponse.json({ ok: true, path: targetPath })
  } catch (error) {
    if (error instanceof SandboxNotReadyError) {
      return structuredErrorResponse(ErrorCodes.SANDBOX_NOT_READY, { status: 503, details: { requestId } })
    }

    console.error(`[Files/Write ${requestId}] E2B write error:`, error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.FILE_WRITE_ERROR, {
      status: 500,
      details: { requestId, filePath: targetPath, error: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}

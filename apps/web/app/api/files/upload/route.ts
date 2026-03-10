import { chown, mkdir, realpath, stat } from "node:fs/promises"
import path from "node:path"
import * as Sentry from "@sentry/nextjs"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { getWorkspace } from "@/features/chat/lib/workspaceRetriever"
import { writeAsWorkspaceOwner } from "@/features/workspace/lib/workspace-secure"
import { structuredErrorResponse } from "@/lib/api/responses"
import { type ResolvedDomain, resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"
import { getRequestId } from "@/lib/request-id"
import { connectSandbox, SANDBOX_WORKSPACE_ROOT, SandboxNotReadyError } from "@/lib/sandbox/connect-sandbox"

/**
 * Maximum file size for uploads (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Allowed MIME types for uploads
 * Images: Claude's Read tool returns visual content
 * Documents: Claude's Read tool extracts text
 */
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  // Documents
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
])

/**
 * Uploads directory name within workspace
 */
const UPLOADS_DIR = ".uploads"

/**
 * Sanitize filename to prevent directory traversal and special characters.
 * Preserves the file extension.
 */
function sanitizeFilename(filename: string): string {
  // Get extension
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)

  // Remove any path separators and dangerous characters
  const sanitizedBase = base
    .replace(/[/\\]/g, "") // Remove path separators
    .replace(/\.\./g, "") // Remove parent directory references
    .replace(/[^a-zA-Z0-9_\-. ]/g, "_") // Replace special chars with underscore
    .replace(/\s+/g, "_") // Replace spaces with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .slice(0, 100) // Limit length

  // If filename is empty after sanitization, use a default
  const finalBase = sanitizedBase || "file"

  // Add timestamp to prevent collisions
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).slice(2, 6)

  return `${finalBase}-${timestamp}-${randomSuffix}${ext.toLowerCase()}`
}

/**
 * POST /api/files/upload
 *
 * Uploads a file to the workspace's .uploads/ directory for Claude to read.
 *
 * Security:
 * - Requires session authentication AND workspace authorization
 * - File is saved within workspace boundary only
 * - Filename is sanitized to prevent path traversal
 * - File type and size are validated
 * - Uses writeAsWorkspaceOwner for correct file ownership (systemd)
 * - E2B: writes directly to sandbox filesystem
 *
 * Request: multipart/form-data
 * - file: File (required)
 * - workspace: string (required) - workspace identifier
 * - worktree: string (optional) - worktree slug
 *
 * Response:
 * - ok: true
 * - path: string - relative path within workspace (for Claude's Read tool)
 * - originalName: string - original filename
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    // 1. Authentication check
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401, details: { requestId } })
    }

    // 2. Parse multipart form data
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (_err) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { requestId, message: "Failed to parse form data" },
      })
    }

    const file = formData.get("file")
    const workspaceParam = formData.get("workspace")
    const worktreeParam = formData.get("worktree")

    // 3. Validate file
    if (!file || !(file instanceof File)) {
      return structuredErrorResponse(ErrorCodes.NO_FILE, { status: 400, details: { requestId } })
    }

    if (file.size > MAX_FILE_SIZE) {
      return structuredErrorResponse(ErrorCodes.FILE_TOO_LARGE, {
        status: 400,
        details: { requestId, maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB` },
      })
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return structuredErrorResponse(ErrorCodes.INVALID_FILE_TYPE, {
        status: 400,
        details: { requestId, fileType: file.type, allowed: Array.from(ALLOWED_MIME_TYPES) },
      })
    }

    // 4. Verify workspace access
    const body = workspaceParam
      ? { workspace: String(workspaceParam), worktree: worktreeParam ? String(worktreeParam) : undefined }
      : {}
    const authorizedWorkspace = await verifyWorkspaceAccess(user, body, `[Upload ${requestId}]`)

    if (!authorizedWorkspace) {
      console.warn(`[Upload ${requestId}] User ${user.id} denied access to workspace: ${workspaceParam}`)
      return structuredErrorResponse(ErrorCodes.FORBIDDEN, {
        status: 403,
        details: { requestId, workspace: workspaceParam },
      })
    }

    // 5. Sanitize filename (shared between systemd and E2B)
    const sanitizedName = sanitizeFilename(file.name)

    // 6. E2B branch: check execution mode before host filesystem ops
    if (workspaceParam) {
      const domain = await resolveDomainRuntime(String(workspaceParam))
      if (domain?.execution_mode === "e2b") {
        return handleE2bUpload(domain, file, sanitizedName, requestId)
      }
    }

    // 7. Systemd path: resolve workspace on host filesystem
    const workspaceResult = await getWorkspace({ body, requestId })

    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    // 8. Resolve to real path (prevents symlink attacks)
    let resolvedWorkspace: string
    try {
      resolvedWorkspace = await realpath(workspaceResult.workspace)
    } catch (_err) {
      console.error(`[Upload ${requestId}] Failed to resolve workspace: ${workspaceResult.workspace}`)
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_FOUND, { status: 404, details: { requestId } })
    }

    // 9. Get workspace ownership info
    const workspaceStats = await stat(resolvedWorkspace)
    const { uid, gid } = workspaceStats

    // 10. Prepare uploads directory
    const uploadsDir = path.join(resolvedWorkspace, UPLOADS_DIR)

    try {
      await mkdir(uploadsDir, { recursive: true })
      await chown(uploadsDir, uid, gid)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        console.error(`[Upload ${requestId}] Failed to create uploads directory:`, err)
        Sentry.captureException(err)
        return structuredErrorResponse(ErrorCodes.FILE_WRITE_ERROR, {
          status: 500,
          details: { requestId, reason: "Failed to create uploads directory" },
        })
      }
    }

    // 11. Create full path and verify security
    const savePath = path.join(uploadsDir, sanitizedName)
    const resolvedSavePath = path.resolve(savePath)

    if (!isPathWithinWorkspace(resolvedSavePath, resolvedWorkspace)) {
      console.warn(`[Upload ${requestId}] Path traversal blocked: ${sanitizedName} -> ${resolvedSavePath}`)
      return structuredErrorResponse(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
        status: 403,
        details: { requestId, attemptedPath: sanitizedName },
      })
    }

    // 12. Convert file to buffer and write
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    try {
      writeAsWorkspaceOwner(resolvedSavePath, buffer, { uid, gid })
    } catch (err) {
      console.error(`[Upload ${requestId}] Failed to write file:`, err)
      Sentry.captureException(err)
      return structuredErrorResponse(ErrorCodes.FILE_WRITE_ERROR, {
        status: 500,
        details: { requestId, reason: "Failed to write uploaded file" },
      })
    }

    const relativePath = `${UPLOADS_DIR}/${sanitizedName}`
    console.log(`[Upload ${requestId}] Successfully uploaded: ${file.name} -> ${relativePath} (${file.size} bytes)`)

    return NextResponse.json({
      ok: true,
      path: relativePath,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
    })
  } catch (error) {
    console.error(`[Upload ${requestId}] Unexpected error:`, error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.FILE_WRITE_ERROR, {
      status: 500,
      details: { requestId, error: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}

async function handleE2bUpload(
  domain: ResolvedDomain,
  file: File,
  sanitizedName: string,
  requestId: string,
): Promise<NextResponse> {
  try {
    const sandbox = await connectSandbox(domain)

    const uploadsDir = path.join(SANDBOX_WORKSPACE_ROOT, UPLOADS_DIR)
    // Ensure .uploads dir exists (ignore if already exists)
    await sandbox.files.makeDir(uploadsDir).catch((err: Error) => {
      if (!err.message?.includes("exists")) throw err
    })

    const savePath = path.join(uploadsDir, sanitizedName)
    const arrayBuffer = await file.arrayBuffer()
    await sandbox.files.write(savePath, arrayBuffer)

    const relativePath = `${UPLOADS_DIR}/${sanitizedName}`
    console.log(`[Upload ${requestId}] E2B uploaded: ${file.name} -> ${relativePath} (${file.size} bytes)`)

    return NextResponse.json({
      ok: true,
      path: relativePath,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
    })
  } catch (err) {
    if (err instanceof SandboxNotReadyError) {
      return structuredErrorResponse(ErrorCodes.SANDBOX_NOT_READY, { status: 503, details: { requestId } })
    }
    console.error(`[Upload ${requestId}] E2B upload error:`, err)
    Sentry.captureException(err)
    return structuredErrorResponse(ErrorCodes.FILE_WRITE_ERROR, {
      status: 500,
      details: { requestId, error: err instanceof Error ? err.message : "Unknown error" },
    })
  }
}

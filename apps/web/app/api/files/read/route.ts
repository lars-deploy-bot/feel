import { readFile } from "node:fs/promises"
import path from "node:path"
import * as Sentry from "@sentry/nextjs"
import { RuntimePathValidationError } from "@webalive/sandbox"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { getWorkspace } from "@/features/chat/lib/workspaceRetriever"
import { structuredErrorResponse } from "@/lib/api/responses"
import { type ResolvedDomain, resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"
import { getRequestId } from "@/lib/request-id"
import { getSessionRegistry } from "@/lib/sandbox/session-registry"

// Max file size to read (1MB)
const MAX_FILE_SIZE = 1024 * 1024

// Binary file extensions that we won't read
const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "svg",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "otf",
  "pdf",
  "zip",
  "tar",
  "gz",
  "rar",
  "mp3",
  "mp4",
  "wav",
  "ogg",
  "webm",
  "exe",
  "dll",
  "so",
  "dylib",
  "db",
  "sqlite",
  "sqlite3",
])

function getLanguageFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || ""
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    markdown: "markdown",
    mdown: "markdown",
    csv: "csv",
    tsv: "tsv",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    vue: "vue",
    svelte: "svelte",
    tex: "latex",
    latex: "latex",
    bib: "latex",
    sty: "latex",
    cls: "latex",
  }
  return languageMap[ext] || "plaintext"
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    // Auth hardening: full user + workspace verification (not just cookie check)
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401, details: { requestId } })
    }

    const body = await request.json()

    const authorized = await verifyWorkspaceAccess(user, body, `[Files/Read ${requestId}]`)
    if (!authorized) {
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, { status: 403, details: { requestId } })
    }

    const workspaceName = body.workspace as string | undefined

    const filePath = body.path
    if (!filePath || typeof filePath !== "string") {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { requestId, message: "Missing required field: path" },
      })
    }

    // Check for binary files (applies to both systemd and E2B)
    const ext = filePath.toLowerCase().split(".").pop() || ""
    if (BINARY_EXTENSIONS.has(ext)) {
      return structuredErrorResponse(ErrorCodes.BINARY_FILE_NOT_SUPPORTED, {
        status: 400,
        details: { requestId, filePath, extension: ext },
      })
    }

    // E2B branch: resolve domain runtime before filesystem checks
    if (workspaceName) {
      const domain = await resolveDomainRuntime(workspaceName)
      if (domain?.execution_mode === "e2b") {
        return handleE2bRead(domain, filePath, requestId)
      }
    }

    // Systemd path: existing getWorkspace() + node:fs logic
    const workspaceResult = await getWorkspace({ body, requestId })
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    const fullPath = path.join(workspaceResult.workspace, filePath)

    // Security check: ensure path is within workspace
    const resolvedPath = path.resolve(fullPath)
    const resolvedWorkspace = path.resolve(workspaceResult.workspace)
    if (!isPathWithinWorkspace(resolvedPath, resolvedWorkspace)) {
      return structuredErrorResponse(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
        status: 403,
        details: { requestId, attemptedPath: resolvedPath, workspacePath: resolvedWorkspace },
      })
    }

    try {
      const content = await readFile(fullPath, "utf-8")

      if (content.length > MAX_FILE_SIZE) {
        return structuredErrorResponse(ErrorCodes.FILE_TOO_LARGE_TO_READ, {
          status: 400,
          details: { requestId, filePath, size: content.length, maxSize: MAX_FILE_SIZE },
        })
      }

      const filename = path.basename(filePath)
      const language = getLanguageFromFilename(filename)

      return NextResponse.json({
        ok: true,
        path: filePath,
        filename,
        content,
        language,
        size: content.length,
      })
    } catch (fsError) {
      const err = fsError as NodeJS.ErrnoException
      if (err.code === "ENOENT") {
        return structuredErrorResponse(ErrorCodes.FILE_NOT_FOUND, {
          status: 404,
          details: { requestId, filePath },
        })
      }
      if (err.code === "EISDIR") {
        return structuredErrorResponse(ErrorCodes.PATH_IS_DIRECTORY, {
          status: 400,
          details: { requestId, filePath },
        })
      }
      console.error(`[Files/Read ${requestId}] Error reading file:`, fsError)
      Sentry.captureException(fsError)
      return structuredErrorResponse(ErrorCodes.FILE_READ_ERROR, {
        status: 500,
        details: { requestId, filePath, error: err.message },
      })
    }
  } catch (error) {
    console.error("Files/Read API error:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.REQUEST_PROCESSING_FAILED, {
      status: 500,
      details: { requestId, error: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}

async function handleE2bRead(domain: ResolvedDomain, filePath: string, requestId: string): Promise<NextResponse> {
  try {
    const session = await getSessionRegistry().acquire(domain)
    const content = await session.files.read(filePath)

    if (content.length > MAX_FILE_SIZE) {
      return structuredErrorResponse(ErrorCodes.FILE_TOO_LARGE_TO_READ, {
        status: 400,
        details: { requestId, filePath, size: content.length, maxSize: MAX_FILE_SIZE },
      })
    }

    const filename = path.basename(filePath)
    const language = getLanguageFromFilename(filename)

    return NextResponse.json({
      ok: true,
      path: filePath,
      filename,
      content,
      language,
      size: content.length,
    })
  } catch (err) {
    if (err instanceof RuntimePathValidationError) {
      console.warn(`[Files/Read ${requestId}] E2B path traversal blocked: ${filePath}`)
      return structuredErrorResponse(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
        status: 403,
        details: { requestId },
      })
    }
    console.error(`[Files/Read ${requestId}] E2B read error:`, err)
    Sentry.captureException(err)
    return structuredErrorResponse(ErrorCodes.FILE_READ_ERROR, {
      status: 500,
      details: { requestId, filePath, error: err instanceof Error ? err.message : "Unknown error" },
    })
  }
}

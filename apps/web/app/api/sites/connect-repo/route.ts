import { readFile, stat } from "node:fs/promises"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import { z } from "zod"
import { writeAsWorkspaceOwner } from "@/features/workspace/lib/workspace-secure"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"
import { parseGithubRepoWithUrls } from "@/lib/git/github-repo-url"
import { resolveMetadataPath } from "@/lib/git/resolve-metadata-path"
import { handleWorkspaceApi } from "@/lib/workspace-api-handler"
import { runAsWorkspaceUser } from "@/lib/workspace-execution/command-runner"

const ConnectRepoSchema = z.object({
  workspaceRoot: z.string().trim().min(1),
  repoUrl: z.string().trim().min(1),
})

/**
 * PATCH /api/sites/connect-repo
 *
 * Connect a workspace to a GitHub repository.
 * Sets sourceRepo in .site-metadata.json and configures the git remote.
 */
export async function PATCH(req: Request) {
  return handleWorkspaceApi(req, {
    schema: ConnectRepoSchema,
    handler: async ({ data, requestId }) => {
      const { workspaceRoot, repoUrl } = data

      // Validate GitHub URL
      let parsedRepo: ReturnType<typeof parseGithubRepoWithUrls>
      try {
        parsedRepo = parseGithubRepoWithUrls(repoUrl)
      } catch (error) {
        return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, {
          status: 400,
          details: { message: error instanceof Error ? error.message : "Invalid repository URL" },
        })
      }
      const remoteUrl = parsedRepo.remoteUrl

      // Read existing metadata first; we only persist on successful git remote update.
      const metadataPath = resolveMetadataPath(workspaceRoot)
      if (!metadataPath) {
        return NextResponse.json(
          { ok: false, error: ErrorCodes.SITE_NOT_FOUND, message: "No site metadata found", requestId },
          { status: 404 },
        )
      }
      let metadata: Record<string, unknown>
      try {
        const raw = await readFile(metadataPath, "utf-8")
        const parsed: Record<string, unknown> = JSON.parse(raw)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Site metadata must be a JSON object")
        }
        metadata = parsed
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
          return NextResponse.json(
            { ok: false, error: ErrorCodes.SITE_NOT_FOUND, message: "No site metadata found", requestId },
            { status: 404 },
          )
        }
        console.error(`[connect-repo ${requestId}] Failed to read metadata:`, error)
        Sentry.captureException(error)
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
          status: 500,
          details: { message: "Failed to read site metadata" },
        })
      }

      // Set git remote (add or update). Only "No such remote" should fall through to add.
      const checkRemote = await runAsWorkspaceUser({
        command: "git",
        args: ["remote", "get-url", "origin"],
        workspaceRoot,
        timeout: 5000,
      })

      const isMissingRemote = checkRemote.stderr.includes("No such remote")
      if (!checkRemote.success && !isMissingRemote) {
        console.error(`[connect-repo ${requestId}] Failed to inspect remote:`, checkRemote.stderr)
        Sentry.captureMessage("connect-repo: failed to inspect remote", {
          level: "error",
          extra: { stderr: checkRemote.stderr, workspaceRoot },
        })
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
          status: 500,
          details: { message: "Failed to inspect git remote" },
        })
      }

      const setRemoteResult = await runAsWorkspaceUser({
        command: "git",
        args: checkRemote.success ? ["remote", "set-url", "origin", remoteUrl] : ["remote", "add", "origin", remoteUrl],
        workspaceRoot,
        timeout: 5000,
      })
      if (!setRemoteResult.success) {
        console.error(`[connect-repo ${requestId}] Failed to configure remote:`, setRemoteResult.stderr)
        Sentry.captureMessage("connect-repo: failed to configure remote", {
          level: "error",
          extra: { stderr: setRemoteResult.stderr, workspaceRoot },
        })
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
          status: 500,
          details: { message: "Failed to set git remote" },
        })
      }

      metadata.sourceRepo = parsedRepo.canonicalUrl
      delete metadata.sourceBranch
      try {
        const workspaceStats = await stat(workspaceRoot)
        writeAsWorkspaceOwner(metadataPath, JSON.stringify(metadata, null, 2), {
          uid: workspaceStats.uid,
          gid: workspaceStats.gid,
        })
      } catch (error) {
        console.error(`[connect-repo ${requestId}] Failed to write metadata:`, error)
        Sentry.captureException(error)
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
          status: 500,
          details: { message: "Failed to update site metadata" },
        })
      }

      if (checkRemote.success) {
        console.log(`[connect-repo ${requestId}] Updated remote origin -> ${remoteUrl}`)
      } else {
        console.log(`[connect-repo ${requestId}] Added remote origin -> ${remoteUrl}`)
      }

      return NextResponse.json({
        ok: true,
        remoteUrl,
        owner: parsedRepo.owner,
        repo: parsedRepo.repo,
        requestId,
      })
    },
  })
}

import { readFileSync } from "node:fs"
import * as Sentry from "@sentry/nextjs"
import { getOAuthKeyForProvider, SITE_METADATA_FILENAME } from "@webalive/shared"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"
import { buildGitAuthEnv } from "@/lib/git/auth-env"
import { resolveMetadataPath } from "@/lib/git/resolve-metadata-path"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"
import { handleWorkspaceApi } from "@/lib/workspace-api-handler"
import { runAsWorkspaceUser } from "@/lib/workspace-execution/command-runner"
import { redactTokens } from "./redact-tokens"

const GitPushSchema = z.object({
  workspaceRoot: z.string(),
  branch: z.string().optional(),
  remote: z.string().optional(),
})

function readSourceRepo(workspaceRoot: string): string | null {
  try {
    const metadataPath = resolveMetadataPath(workspaceRoot)
    if (!metadataPath) return null
    const raw = JSON.parse(readFileSync(metadataPath, "utf-8"))
    return typeof raw.sourceRepo === "string" ? raw.sourceRepo : null
  } catch (_err) {
    // Metadata file missing or unparseable — expected for pre-metadata sites
    return null
  }
}

/**
 * Convert a GitHub HTTPS URL to the format git expects for push.
 * e.g. "https://github.com/user/repo" -> "https://github.com/user/repo.git"
 */
function normalizeGitUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "")
  return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`
}

export async function POST(req: Request) {
  return handleWorkspaceApi(req, {
    schema: GitPushSchema,
    handler: async ({ data, requestId }) => {
      const { workspaceRoot, branch, remote = "origin" } = data

      // 1. Get the authenticated user (handleWorkspaceApi already verified auth,
      //    but we need the user ID for OAuth token retrieval)
      const sessionUser = await getSessionUser()
      if (!sessionUser) {
        return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
      }

      // 2. Get GitHub OAuth token for this user
      let githubToken: string
      try {
        const githubOAuthKey = getOAuthKeyForProvider("github")
        const githubOAuth = getOAuthInstance(githubOAuthKey)
        githubToken = await githubOAuth.getAccessToken(sessionUser.id, githubOAuthKey)
      } catch (error) {
        console.error(`[git-push ${requestId}] Failed to get GitHub token for user ${sessionUser.id}:`, error)
        Sentry.captureException(error)
        return structuredErrorResponse(ErrorCodes.GITHUB_NOT_CONNECTED, {
          status: 403,
          details: { message: "Connect GitHub in Settings to enable git push." },
        })
      }

      // 3. Check if remote exists; if not, set it up from sourceRepo metadata
      const remoteCheckResult = await runAsWorkspaceUser({
        command: "git",
        args: ["remote", "get-url", remote],
        workspaceRoot,
        timeout: 5000,
      })

      if (!remoteCheckResult.success) {
        // Remote doesn't exist — try to set up from .site-metadata.json
        const sourceRepo = readSourceRepo(workspaceRoot)
        if (!sourceRepo) {
          return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, {
            status: 400,
            details: {
              message: `No git remote "${remote}" configured and no sourceRepo found in ${SITE_METADATA_FILENAME}. Set up a remote first with: git remote add origin <url>`,
            },
          })
        }

        const remoteUrl = normalizeGitUrl(sourceRepo)
        console.log(`[git-push ${requestId}] Setting up remote "${remote}" -> ${remoteUrl}`)

        const addRemoteResult = await runAsWorkspaceUser({
          command: "git",
          args: ["remote", "add", remote, remoteUrl],
          workspaceRoot,
          timeout: 5000,
        })

        if (!addRemoteResult.success) {
          return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
            status: 500,
            details: { message: `Failed to add remote "${remote}": ${redactTokens(addRemoteResult.stderr)}` },
          })
        }
      }

      // 4. Build git push args
      const pushArgs = ["push", remote]
      if (branch) {
        pushArgs.push(branch)
      }

      // 5. Run git push with inline credential helper (no scripts on disk)
      console.log(`[git-push ${requestId}] Pushing: git ${pushArgs.join(" ")}`)

      const pushResult = await runAsWorkspaceUser({
        command: "git",
        args: pushArgs,
        workspaceRoot,
        timeout: 120000, // 2 minutes for large repos
        env: buildGitAuthEnv(githubToken),
      })

      if (!pushResult.success) {
        const safeStderr = redactTokens(pushResult.stderr)
        console.error(`[git-push ${requestId}] Push failed:`, safeStderr)
        Sentry.captureMessage(`git push failed for ${requestId}`, {
          level: "warning",
          extra: { stderr: safeStderr, exitCode: pushResult.exitCode },
        })

        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
          status: 500,
          details: { message: `Git push failed:\n${safeStderr}` },
        })
      }

      // git push writes progress to stderr, success output to both
      const output = [pushResult.stdout, pushResult.stderr].filter(Boolean).join("\n").trim()
      const safeOutput = redactTokens(output)

      console.log(`[git-push ${requestId}] Push succeeded`)

      return NextResponse.json({
        ok: true,
        message: `Git push succeeded.\n${safeOutput}`,
        requestId,
      })
    },
  })
}

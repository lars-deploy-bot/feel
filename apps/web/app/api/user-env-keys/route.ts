/**
 * User Environment Keys API
 *
 * Manages user-defined environment keys stored in the lockbox.
 * These keys can be used by MCP servers for custom API integrations.
 * Keys can be scoped to a specific workspace and/or environment.
 *
 * POST - Create/update an env key
 * GET - List env key names (without values for security)
 * DELETE - Remove an env key
 */

import * as Sentry from "@sentry/nextjs"
import type { NextRequest } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"
import { getUserEnvKeysManager } from "@/lib/oauth/oauth-instances"

/** Convert empty-string scope fields to opts for OAuthManager methods */
function toScopeOpts(workspace: string, environment: string) {
  if (!workspace && !environment) return undefined
  return {
    ...(workspace ? { workspace } : {}),
    ...(environment ? { environment } : {}),
  }
}

function scopeLabel(workspace: string, environment: string): string {
  const parts: string[] = []
  if (workspace) parts.push(`workspace: ${workspace}`)
  if (environment) parts.push(`env: ${environment}`)
  return parts.length > 0 ? ` (${parts.join(", ")})` : " (global)"
}

/**
 * POST - Create or update an environment key
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const parsed = await handleBody("user-env-keys/create", req)
    if (isHandleBodyError(parsed)) return parsed

    const { keyName, keyValue, workspace, environment } = parsed

    await getUserEnvKeysManager().setUserEnvKey(user.id, keyName, keyValue, toScopeOpts(workspace, environment))

    console.log(`[User Env Keys] User ${user.id} set key: ${keyName}${scopeLabel(workspace, environment)}`)

    return alrighty("user-env-keys/create", {
      message: `Environment key '${keyName}' saved successfully`,
      keyName,
    })
  } catch (error) {
    console.error("[User Env Keys] Failed to save key:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
      status: 500,
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    })
  }
}

/**
 * GET - List environment key names (values are not returned for security)
 */
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const keys = await getUserEnvKeysManager().listUserEnvKeys(user.id)

    return alrighty("user-env-keys", {
      keys: keys.map(k => ({
        name: k.name,
        hasValue: true as const,
        workspace: k.workspace ?? "",
        environment: k.environment ?? "",
      })),
    })
  } catch (error) {
    console.error("[User Env Keys] Failed to list keys:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
      status: 500,
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    })
  }
}

/**
 * DELETE - Remove an environment key
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const parsed = await handleBody("user-env-keys/delete", req)
    if (isHandleBodyError(parsed)) return parsed

    const { keyName, workspace, environment } = parsed

    await getUserEnvKeysManager().deleteUserEnvKey(user.id, keyName, toScopeOpts(workspace, environment))

    console.log(`[User Env Keys] User ${user.id} deleted key: ${keyName}${scopeLabel(workspace, environment)}`)

    return alrighty("user-env-keys/delete", {
      message: `Environment key '${keyName}' deleted successfully`,
      keyName,
    })
  } catch (error) {
    console.error("[User Env Keys] Failed to delete key:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
      status: 500,
      details: {
        reason: error instanceof Error ? error.message : "Unknown error",
      },
    })
  }
}

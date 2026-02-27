/**
 * User Environment Keys API
 *
 * Manages user-defined environment keys stored in the lockbox.
 * These keys can be used by MCP servers for custom API integrations.
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

    const { keyName, keyValue } = parsed

    await getUserEnvKeysManager().setUserEnvKey(user.id, keyName, keyValue)

    console.log(`[User Env Keys] User ${user.id} set key: ${keyName}`)

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

    const keyNames = await getUserEnvKeysManager().listUserEnvKeyNames(user.id)

    return alrighty("user-env-keys", {
      keys: keyNames.map(name => ({
        name,
        hasValue: true as const,
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

    const { keyName } = parsed

    await getUserEnvKeysManager().deleteUserEnvKey(user.id, keyName)

    console.log(`[User Env Keys] User ${user.id} deleted key: ${keyName}`)

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

/**
 * User Environment Keys API
 *
 * Manages user-defined environment keys stored in the lockbox.
 * Keys can be scoped to a workspace and/or multiple environments.
 * One DB row per environment; the API groups them by (name, workspace).
 *
 * POST   - Create an env key (across multiple environments)
 * GET    - List env keys (grouped by name + workspace)
 * PUT    - Update which environments a key is available in
 * DELETE - Remove all rows for a key + workspace
 */

import * as Sentry from "@sentry/nextjs"
import type { NextRequest } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"
import { getUserEnvKeysManager } from "@/lib/oauth/oauth-instances"

/**
 * POST - Create or update an environment key across multiple environments
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const parsed = await handleBody("user-env-keys/create", req)
    if (isHandleBodyError(parsed)) return parsed

    const { keyName, keyValue, workspace, environments } = parsed

    await getUserEnvKeysManager().setUserEnvKeyMultiEnv(user.id, keyName, keyValue, {
      workspace: workspace || undefined,
      environments,
    })

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
 * GET - List environment keys grouped by (name, workspace)
 */
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const rows = await getUserEnvKeysManager().listUserEnvKeys(user.id)

    // Group rows by (name, workspace) → collect environments
    const grouped = new Map<string, { name: string; workspace: string; environments: string[] }>()
    for (const row of rows) {
      const key = `${row.name}::${row.workspace}`
      const existing = grouped.get(key)
      if (existing) {
        if (row.environment) existing.environments.push(row.environment)
      } else {
        grouped.set(key, {
          name: row.name,
          workspace: row.workspace,
          environments: row.environment ? [row.environment] : [],
        })
      }
    }

    return alrighty("user-env-keys", {
      keys: Array.from(grouped.values()).map(k => ({
        name: k.name,
        hasValue: true as const,
        workspace: k.workspace,
        environments: k.environments,
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
 * PUT - Update which environments a key is available in
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const parsed = await handleBody("user-env-keys/update", req)
    if (isHandleBodyError(parsed)) return parsed

    const { keyName, workspace, environments } = parsed

    await getUserEnvKeysManager().syncUserEnvKeyEnvironments(user.id, keyName, {
      workspace: workspace || undefined,
      environments,
    })

    return alrighty("user-env-keys/update", {
      message: `Environment key '${keyName}' updated successfully`,
      keyName,
    })
  } catch (error) {
    console.error("[User Env Keys] Failed to update key:", error)
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
 * DELETE - Remove all environment rows for a key + workspace
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const parsed = await handleBody("user-env-keys/delete", req)
    if (isHandleBodyError(parsed)) return parsed

    const { keyName, workspace } = parsed

    await getUserEnvKeysManager().deleteAllUserEnvKeyScopes(user.id, keyName, workspace || undefined)

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

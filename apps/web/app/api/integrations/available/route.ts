/**
 * Available Integrations API
 *
 * Returns the list of integrations available to the current user based on:
 * - Global active status
 * - Visibility level (public, admin_only, etc.)
 * - Explicit access policies
 * - Grandfathering (existing connections)
 *
 * Connection status is checked against lockbox.user_secrets (oauth-core storage)
 */

import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse, getSessionUser } from "@/features/auth/lib/auth"
import { ErrorCodes } from "@/lib/error-codes"
import { createIntegrationsClient } from "@/lib/supabase/integrations"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"

export interface AvailableIntegration {
  provider_key: string
  display_name: string
  logo_path: string | null
  is_connected: boolean
  visibility_status: string
}

/**
 * GET - Get available integrations for the current user
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    console.log("[Integrations API] Incoming request headers:", {
      hasCookie: !!req.headers.get("cookie"),
      host: req.headers.get("host"),
    })

    const user = await getSessionUser()
    console.log(
      "[Integrations API] getSessionUser result:",
      user ? `User ID: ${user.id}, Email: ${user.email}` : "null",
    )

    if (!user) {
      console.error("[Integrations API] No user found - returning UNAUTHORIZED")
      return createErrorResponse(ErrorCodes.UNAUTHORIZED, 401)
    }

    // 2. Get Supabase client for integrations schema (service key for server-side access)
    const supabase = await createIntegrationsClient("service")

    // 3. Call the RPC function to get available integrations
    const { data: integrations, error } = await supabase.rpc("get_available_integrations", {
      p_user_id: user.id,
    })

    if (error) {
      console.error("[Integrations] Failed to fetch available integrations:", error)
      return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500, {
        reason: error.message,
      })
    }

    // 4. Transform and check actual connection status from lockbox
    const availableIntegrations: AvailableIntegration[] = await Promise.all(
      (integrations || []).map(async (integration: any) => {
        // Check actual connection status from oauth-core (lockbox.user_secrets)
        let isConnected = false
        try {
          const oauthManager = getOAuthInstance(integration.provider_key)
          isConnected = await oauthManager.isConnected(user.id, integration.provider_key)
        } catch {
          // Provider not supported in oauth-core, use RPC result
          isConnected = integration.is_connected
        }

        return {
          provider_key: integration.provider_key,
          display_name: integration.display_name,
          logo_path: integration.logo_path,
          is_connected: isConnected,
          visibility_status: integration.visibility_status,
        }
      }),
    )

    console.log(
      "[Integrations API] Returning integrations:",
      availableIntegrations.map(i => ({ key: i.provider_key, connected: i.is_connected })),
    )

    return NextResponse.json(
      {
        integrations: availableIntegrations,
        user_id: user.id,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    )
  } catch (error) {
    console.error("[Integrations] Unexpected error:", error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500, {
      reason: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

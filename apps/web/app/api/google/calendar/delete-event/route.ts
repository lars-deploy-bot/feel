/**
 * Google Calendar Delete Event API
 *
 * Deletes an event from Google Calendar when user confirms deletion.
 * Uses stored OAuth token from user's Google Calendar connection.
 */

import { calendar_v3, auth as gauth } from "@googleapis/calendar"
import * as Sentry from "@sentry/nextjs"
import type { NextRequest } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"

export async function DELETE(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    // 2. Parse and validate request body
    const parsed = await handleBody("google/calendar/delete-event", req)
    if (isHandleBodyError(parsed)) return parsed

    // 3. Get Google Calendar OAuth token
    const oauthManager = getOAuthInstance("google_calendar")
    let accessToken: string
    try {
      accessToken = await oauthManager.getAccessToken(user.id, "google_calendar")
    } catch (error) {
      console.error("[Calendar Delete] Failed to get OAuth token:", error)
      Sentry.captureException(error)
      return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, {
        status: 403,
        details: { reason: "Google Calendar not connected. Please connect in Settings." },
      })
    }

    // 4. Create Calendar client
    const oauth2Client = new gauth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const calendar = new calendar_v3.Calendar({ auth: oauth2Client })

    // 5. Delete event
    await calendar.events.delete({
      calendarId: parsed.calendarId,
      eventId: parsed.eventId,
    })

    console.log(`[Calendar Delete] Event deleted by user ${user.id}, eventId: ${parsed.eventId}`)

    return alrighty("google/calendar/delete-event", {
      eventId: parsed.eventId,
      calendarId: parsed.calendarId,
    })
  } catch (error) {
    console.error("[Calendar Delete] Error:", error)
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "Failed to delete event"
    return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, { status: 500, details: { reason: message } })
  }
}

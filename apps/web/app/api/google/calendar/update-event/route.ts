/**
 * Google Calendar Update Event API
 *
 * Updates an existing event in Google Calendar when user clicks Update button.
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

export async function PATCH(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    // 2. Parse and validate request body
    const parsed = await handleBody("google/calendar/update-event", req)
    if (isHandleBodyError(parsed)) return parsed

    // 3. Validate start < end if both provided
    if (parsed.start?.dateTime && parsed.end?.dateTime) {
      const startTime = new Date(parsed.start.dateTime).getTime()
      const endTime = new Date(parsed.end.dateTime).getTime()
      if (startTime >= endTime) {
        return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
          status: 400,
          details: { reason: "Event start time must be before end time" },
        })
      }
    }

    // 4. Get Google Calendar OAuth token
    const oauthManager = getOAuthInstance("google_calendar")
    let accessToken: string
    try {
      accessToken = await oauthManager.getAccessToken(user.id, "google_calendar")
    } catch (error) {
      console.error("[Calendar Update] Failed to get OAuth token:", error)
      Sentry.captureException(error)
      return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, {
        status: 403,
        details: { reason: "Google Calendar not connected. Please connect in Settings." },
      })
    }

    // 5. Create Calendar client
    const oauth2Client = new gauth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const calendar = new calendar_v3.Calendar({ auth: oauth2Client })

    // 6. Fetch current event (to preserve fields not being updated)
    const currentEvent = await calendar.events.get({
      calendarId: parsed.calendarId,
      eventId: parsed.eventId,
    })

    // 7. Build update object (only include fields provided in request)
    const updateData: calendar_v3.Schema$Event = {
      summary: parsed.summary ?? currentEvent.data.summary,
      description: parsed.description ?? currentEvent.data.description,
      start: parsed.start || currentEvent.data.start,
      end: parsed.end || currentEvent.data.end,
      location: parsed.location ?? currentEvent.data.location,
      attendees:
        parsed.attendees?.map(att => ({
          email: att.email,
          optional: att.optional || false,
        })) ?? currentEvent.data.attendees,
      transparency: parsed.transparency ?? currentEvent.data.transparency,
    }

    // 8. Update event
    const response = await calendar.events.update({
      calendarId: parsed.calendarId,
      eventId: parsed.eventId,
      requestBody: updateData,
    })

    if (!response.data.id) {
      return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, {
        status: 500,
        details: { reason: "Google Calendar API did not return event ID" },
      })
    }

    console.log(`[Calendar Update] Event updated by user ${user.id}, ID: ${response.data.id}`)

    return alrighty("google/calendar/update-event", {
      eventId: response.data.id,
      calendarId: parsed.calendarId,
      htmlLink: response.data.htmlLink || "",
    })
  } catch (error) {
    console.error("[Calendar Update] Error:", error)
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "Failed to update event"
    return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, { status: 500, details: { reason: message } })
  }
}

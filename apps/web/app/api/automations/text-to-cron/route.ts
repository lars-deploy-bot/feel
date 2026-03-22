/**
 * POST /api/automations/text-to-cron
 *
 * Convert natural language schedule text to a cron expression.
 * Used by the UI for live preview before saving.
 */

import * as Sentry from "@sentry/nextjs"
import { z } from "zod"
import { protectedRoute } from "@/features/auth/lib/protectedRoute"
import { structuredErrorResponse } from "@/lib/api/responses"
import { SCHEDULE_TEXT_MAX_LENGTH } from "@/lib/automation/form-options"
import { textToCron } from "@/lib/automation/text-to-cron"
import { ErrorCodes } from "@/lib/error-codes"

const bodySchema = z.object({
  text: z.string().trim().min(1).max(SCHEDULE_TEXT_MAX_LENGTH),
})

export const POST = protectedRoute(async ({ req }) => {
  const raw = await req.json()
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

  try {
    const result = await textToCron(parsed.data.text)
    return Response.json({ ok: true, cron: result.cron, description: result.description, timezone: result.timezone })
  } catch (err) {
    Sentry.captureException(err)
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, {
      status: 422,
      details: { reason: err instanceof Error ? err.message : "Failed to parse schedule" },
    })
  }
})

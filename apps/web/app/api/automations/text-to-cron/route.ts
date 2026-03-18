/**
 * POST /api/automations/text-to-cron
 *
 * Convert natural language schedule text to a cron expression.
 * Used by the UI for live preview before saving.
 */

import { z } from "zod"
import { protectedRoute } from "@/features/auth/lib/protectedRoute"
import { textToCron } from "@/lib/automation/text-to-cron"

const bodySchema = z.object({
  text: z.string().trim().min(1).max(200),
})

export const POST = protectedRoute(async ({ req }) => {
  const raw = await req.json()
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid input" }, { status: 400 })
  }

  try {
    const result = await textToCron(parsed.data.text)
    return Response.json({ ok: true, cron: result.cron, timezone: result.timezone })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse schedule"
    return Response.json({ ok: false, error: message }, { status: 422 })
  }
})

import { Hono } from "hono"
import type { AppBindings } from "../../types/hono"
import { TranscribeError, transcribe } from "./voice.service"

export const voiceRoutes = new Hono<AppBindings>()

/**
 * POST /api/voice/transcribe
 *
 * Accepts multipart/form-data with:
 *   - file: audio file (required, 1KB–25MB, audio/* MIME)
 *   - language: ISO 639-1 language code (optional)
 *
 * Returns { text, duration, language } on success.
 * Returns { error, code } on failure with appropriate HTTP status.
 */
voiceRoutes.post("/transcribe", async c => {
  const contentType = c.req.header("content-type") ?? ""
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "Expected multipart/form-data", code: "INVALID_FORMAT" }, 400)
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: "Failed to parse form data", code: "INVALID_FORMAT" }, 400)
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return c.json({ error: "Missing audio file in 'file' field", code: "INVALID_FORMAT" }, 400)
  }

  const language = formData.get("language")
  const languageStr = typeof language === "string" && language.trim().length >= 2 ? language.trim() : undefined

  try {
    const result = await transcribe({ file, language: languageStr })
    return c.json(result)
  } catch (err) {
    if (err instanceof TranscribeError) {
      return c.json({ error: err.message, code: err.code }, err.status as 400)
    }
    throw err
  }
})

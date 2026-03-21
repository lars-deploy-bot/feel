import type { VoiceLanguage } from "@webalive/shared"
import type { TranscribeError, TranscribeResult } from "./types"

/**
 * Send recorded audio to /api/voice/transcribe.
 * @param blob - Audio blob to transcribe
 * @param language - ISO 639-1 language code for transcription hints
 * @param signal - AbortSignal to cancel the request
 */
export async function transcribeAudio(
  blob: Blob,
  language?: VoiceLanguage,
  signal?: AbortSignal,
): Promise<TranscribeResult> {
  const ext = blob.type.includes("mp4") ? "m4a" : "webm"
  const file = new File([blob], `voice.${ext}`, { type: blob.type })

  const form = new FormData()
  form.append("file", file)
  if (language) form.append("language", language)

  const res = await fetch("/api/voice/transcribe", { method: "POST", body: form, signal })
  const data: TranscribeResult | TranscribeError = await res.json()

  if (!res.ok || "error" in data) {
    const raw = "error" in data ? data.error : undefined
    const message =
      res.status === 504
        ? "Transcription timed out — try a shorter recording"
        : res.status >= 500
          ? "Transcription service is temporarily unavailable"
          : (raw ?? `Transcription failed (${res.status})`)
    throw new TranscribeApiError(message, res.status)
  }

  return data
}

export class TranscribeApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "TranscribeApiError"
    this.status = status
  }
}

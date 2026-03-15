import type { TranscribeResponse, TranscribeResult } from "./types"

/**
 * Send recorded audio to /api/voice/transcribe.
 * Returns the transcription result or throws on error.
 */
export async function transcribeAudio(blob: Blob): Promise<TranscribeResult> {
  const ext = blob.type.includes("mp4") ? "m4a" : "webm"
  const file = new File([blob], `voice.${ext}`, { type: blob.type })

  const form = new FormData()
  form.append("file", file)

  const res = await fetch("/api/voice/transcribe", { method: "POST", body: form })
  const data: TranscribeResponse = await res.json()

  if (!res.ok || "error" in data) {
    const message = "error" in data ? data.error : `Transcription failed (${res.status})`
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

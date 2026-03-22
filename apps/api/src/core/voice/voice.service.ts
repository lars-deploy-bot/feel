/**
 * Voice transcription service — calls Groq Whisper directly with retry + validation.
 *
 * No mini-tools indirection. Direct Groq API call with:
 * - File size validation (reject silence, cap at 25MB)
 * - Retry on transient errors (429, 5xx)
 * - Exponential backoff with jitter
 * - Timeout per attempt
 * - Structured error classification
 */

import { retryAsync, type TranscribeResult } from "@webalive/shared"
import { env } from "../../config/env"
import { logger } from "../../infra/logger"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
const GROQ_MODEL = "whisper-large-v3-turbo"
const REQUEST_TIMEOUT_MS = 30_000
const MIN_FILE_BYTES = 1_000
const MAX_FILE_BYTES = 25 * 1024 * 1024

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscribeRequest {
  file: File
  language?: string
}

export type { TranscribeResult }

export type TranscribeErrorCode = "TOO_SHORT" | "TOO_LARGE" | "INVALID_FORMAT" | "GROQ_ERROR" | "TIMEOUT" | "NO_SPEECH"

export class TranscribeError extends Error {
  readonly code: TranscribeErrorCode
  readonly status: number

  constructor(message: string, code: TranscribeErrorCode, status: number) {
    super(message)
    this.name = "TranscribeError"
    this.code = code
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "video/webm", // Bun infers video/webm from .webm extension even for audio-only recordings
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
  "audio/flac",
])

function isAllowedAudioType(type: string): boolean {
  // Handle "audio/webm;codecs=opus" → "audio/webm"
  const base = type.split(";")[0].trim().toLowerCase()
  return ALLOWED_AUDIO_TYPES.has(base)
}

function validateFile(file: File): void {
  if (file.size < MIN_FILE_BYTES) {
    throw new TranscribeError("Audio too short — recording must contain audible speech", "TOO_SHORT", 400)
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new TranscribeError("Audio file exceeds 25MB limit", "TOO_LARGE", 400)
  }
  if (file.type && !isAllowedAudioType(file.type)) {
    throw new TranscribeError(`Unsupported audio format: ${file.type}`, "INVALID_FORMAT", 400)
  }
}

// ---------------------------------------------------------------------------
// Groq API call
// ---------------------------------------------------------------------------

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function extractGroqErrorDetail(body: unknown): string {
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") {
    return body.error.message
  }
  return JSON.stringify(body)
}

function parseGroqResponse(data: unknown): TranscribeResult {
  if (!isRecord(data) || typeof data.text !== "string" || !data.text.trim()) {
    throw new TranscribeError("No speech detected in audio", "NO_SPEECH", 422)
  }
  return {
    text: data.text.trim(),
    duration: typeof data.duration === "number" ? data.duration : null,
    language: typeof data.language === "string" ? data.language : null,
  }
}

async function callGroqTranscribe(file: File, language?: string): Promise<TranscribeResult> {
  const form = new FormData()
  form.append("file", file, file.name)
  form.append("model", GROQ_MODEL)
  form.append("response_format", "verbose_json")
  if (language) form.append("language", language)

  const res = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GROQ_API_SECRET}` },
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) {
    let detail = ""
    try {
      const body: unknown = await res.json()
      detail = extractGroqErrorDetail(body)
    } catch {
      detail = res.statusText
    }

    if (isRetryableStatus(res.status)) {
      throw new TranscribeError(`Groq API ${res.status}: ${detail}`, "GROQ_ERROR", res.status)
    }

    // Non-retryable Groq error
    throw new TranscribeError(`Transcription failed: ${detail}`, "GROQ_ERROR", res.status)
  }

  const data: unknown = await res.json()
  return parseGroqResponse(data)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
  validateFile(req.file)

  try {
    return await retryAsync(() => callGroqTranscribe(req.file, req.language), {
      attempts: 3,
      minDelayMs: 500,
      maxDelayMs: 5_000,
      jitter: 0.2,
      label: "groq-transcribe",
      shouldRetry: err => {
        if (err instanceof TranscribeError) return isRetryableStatus(err.status)
        // Timeout errors are retryable
        if (err instanceof DOMException && err.name === "TimeoutError") return true
        return false
      },
      onRetry: info => {
        logger.warn(`groq-transcribe retry ${info.attempt}/${info.maxAttempts} in ${info.delayMs}ms`, {
          error: String(info.err),
        })
      },
    })
  } catch (err) {
    // Wrap timeout in a friendly error
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new TranscribeError("Transcription timed out — try a shorter recording", "TIMEOUT", 504)
    }
    throw err
  }
}

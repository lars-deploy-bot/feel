import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { errorHandler } from "../../middleware/error-handler"
import type { AppBindings } from "../../types/hono"

// ---------------------------------------------------------------------------
// Mock the service — routes test only cares about HTTP behavior
// ---------------------------------------------------------------------------

vi.mock("./voice.service", () => ({
  transcribe: vi.fn(),
  TranscribeError: class TranscribeError extends Error {
    readonly code: string
    readonly status: number
    constructor(message: string, code: string, status: number) {
      super(message)
      this.name = "TranscribeError"
      this.code = code
      this.status = status
    }
  },
}))

import { voiceRoutes } from "./voice.routes"
import { TranscribeError, transcribe } from "./voice.service"

// ---------------------------------------------------------------------------
// Response types for typed test assertions
// ---------------------------------------------------------------------------

interface VoiceResponse {
  text?: string
  duration?: number | null
  language?: string | null
  error?: string
  code?: string
  ok?: boolean
}

interface ErrorResponse {
  ok: false
  error: { code: string; message: string }
}

async function jsonBody<T>(response: Response): Promise<T> {
  // @ts-expect-error — test-only narrowing; shape is verified via assertions below
  const data: T = await response.json()
  return data
}

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

function buildTestApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>()
  app.onError(errorHandler)
  app.route("/api/voice", voiceRoutes)
  return app
}

function makeAudioFile(name = "voice.webm", size = 5000, type = "audio/webm;codecs=opus"): File {
  const buffer = new Uint8Array(size)
  for (let i = 0; i < buffer.length; i++) buffer[i] = (i % 200) + 28
  return new File([buffer], name, { type })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("voice routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // Content-Type validation
  // =========================================================================

  describe("content-type validation", () => {
    it("rejects requests without multipart/form-data content-type", async () => {
      const app = buildTestApp()
      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "not audio" }),
      })

      expect(response.status).toBe(400)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.code).toBe("INVALID_FORMAT")
      expect(body.error).toContain("multipart/form-data")
      expect(transcribe).not.toHaveBeenCalled()
    })

    it("rejects requests with no content-type header", async () => {
      const app = buildTestApp()
      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: "raw bytes",
      })

      expect(response.status).toBe(400)
      expect(transcribe).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // File field validation
  // =========================================================================

  describe("file field validation", () => {
    it("rejects when file field is missing", async () => {
      const app = buildTestApp()
      const form = new FormData()
      form.append("language", "en")

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(400)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.code).toBe("INVALID_FORMAT")
      expect(body.error).toContain("Missing audio file")
      expect(transcribe).not.toHaveBeenCalled()
    })

    it("rejects when file field is a string instead of File", async () => {
      const app = buildTestApp()
      const form = new FormData()
      form.append("file", "not a file")

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(400)
      expect(transcribe).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Successful transcription
  // =========================================================================

  describe("successful transcription", () => {
    it("returns transcription result on success", async () => {
      vi.mocked(transcribe).mockResolvedValueOnce({
        text: "Hello, world!",
        duration: 2.5,
        language: "en",
      })

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(200)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body).toEqual({
        text: "Hello, world!",
        duration: 2.5,
        language: "en",
      })
    })

    it("passes file to transcribe service", async () => {
      vi.mocked(transcribe).mockResolvedValueOnce({
        text: "test",
        duration: null,
        language: null,
      })

      const app = buildTestApp()
      const file = makeAudioFile("recording.webm")
      const form = new FormData()
      form.append("file", file, file.name)

      await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(transcribe).toHaveBeenCalledOnce()
      const arg = vi.mocked(transcribe).mock.calls[0][0]
      expect(arg.file).toBeInstanceOf(File)
      expect(arg.language).toBeUndefined()
    })
  })

  // =========================================================================
  // Language parameter
  // =========================================================================

  describe("language parameter", () => {
    it("passes valid language code to service", async () => {
      vi.mocked(transcribe).mockResolvedValueOnce({
        text: "hola",
        duration: 1.0,
        language: "es",
      })

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)
      form.append("language", "es")

      await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      const arg = vi.mocked(transcribe).mock.calls[0][0]
      expect(arg.language).toBe("es")
    })

    it("ignores empty language string", async () => {
      vi.mocked(transcribe).mockResolvedValueOnce({
        text: "hello",
        duration: null,
        language: null,
      })

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)
      form.append("language", "")

      await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      const arg = vi.mocked(transcribe).mock.calls[0][0]
      expect(arg.language).toBeUndefined()
    })

    it("ignores single-character language (needs >= 2 chars)", async () => {
      vi.mocked(transcribe).mockResolvedValueOnce({
        text: "hello",
        duration: null,
        language: null,
      })

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)
      form.append("language", "e")

      await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      const arg = vi.mocked(transcribe).mock.calls[0][0]
      expect(arg.language).toBeUndefined()
    })

    it("trims whitespace from language code", async () => {
      vi.mocked(transcribe).mockResolvedValueOnce({
        text: "hello",
        duration: null,
        language: null,
      })

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)
      form.append("language", "  nl  ")

      await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      const arg = vi.mocked(transcribe).mock.calls[0][0]
      expect(arg.language).toBe("nl")
    })

    it("passes undefined language when field is absent", async () => {
      vi.mocked(transcribe).mockResolvedValueOnce({
        text: "hello",
        duration: null,
        language: null,
      })

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      const arg = vi.mocked(transcribe).mock.calls[0][0]
      expect(arg.language).toBeUndefined()
    })
  })

  // =========================================================================
  // TranscribeError handling
  // =========================================================================

  describe("TranscribeError mapping", () => {
    it("maps TOO_SHORT to 400 with correct code", async () => {
      vi.mocked(transcribe).mockRejectedValueOnce(new TranscribeError("Audio too short", "TOO_SHORT", 400))

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(400)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.code).toBe("TOO_SHORT")
      expect(body.error).toBe("Audio too short")
    })

    it("maps TOO_LARGE to 400", async () => {
      vi.mocked(transcribe).mockRejectedValueOnce(new TranscribeError("File too large", "TOO_LARGE", 400))

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(400)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.code).toBe("TOO_LARGE")
    })

    it("maps NO_SPEECH to 422", async () => {
      vi.mocked(transcribe).mockRejectedValueOnce(new TranscribeError("No speech detected", "NO_SPEECH", 422))

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(422)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.code).toBe("NO_SPEECH")
    })

    it("maps TIMEOUT to 504", async () => {
      vi.mocked(transcribe).mockRejectedValueOnce(new TranscribeError("Timed out", "TIMEOUT", 504))

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(504)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.code).toBe("TIMEOUT")
    })

    it("maps GROQ_ERROR to the original status", async () => {
      vi.mocked(transcribe).mockRejectedValueOnce(new TranscribeError("Rate limited", "GROQ_ERROR", 429))

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(429)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.code).toBe("GROQ_ERROR")
    })

    it("maps INVALID_FORMAT to 400", async () => {
      vi.mocked(transcribe).mockRejectedValueOnce(new TranscribeError("Unsupported format", "INVALID_FORMAT", 400))

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(400)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.code).toBe("INVALID_FORMAT")
    })
  })

  // =========================================================================
  // Unexpected errors
  // =========================================================================

  describe("unexpected errors", () => {
    it("falls through to error handler on non-TranscribeError", async () => {
      vi.mocked(transcribe).mockRejectedValueOnce(new Error("Something unexpected"))

      const app = buildTestApp()
      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      // errorHandler returns 500 for unknown errors
      expect(response.status).toBe(500)
      const body = await jsonBody<ErrorResponse>(response)
      expect(body.ok).toBe(false)
      expect(body.error.code).toBe("INTERNAL_ERROR")
    })
  })

  // =========================================================================
  // Auth integration (full app with authMiddleware)
  // =========================================================================

  describe("auth integration", () => {
    it("requires authentication on the fully wired app", async () => {
      // Set up env for createApp
      process.env.SUPABASE_URL = "https://example.supabase.co"
      process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key"
      process.env.ALIVE_PASSCODE = "test-passcode"
      process.env.NODE_ENV = "development"
      process.env.E2B_API_KEY = "e2b_test_key"
      process.env.GROQ_API_SECRET = "groq-secret"
      process.env.POSTHOG_API_KEY = "posthog-key"
      process.env.POSTHOG_HOST = "https://posthog.example.com"
      process.env.POSTHOG_PROJECT_ID = "2"
      vi.resetModules()

      const { createApp } = await import("../../server/app")
      const app = createApp()

      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        body: form,
      })

      expect(response.status).toBe(401)
      const body = await jsonBody<ErrorResponse>(response)
      expect(body.error.code).toBe("UNAUTHORIZED")
      expect(transcribe).not.toHaveBeenCalled()
    })

    it("allows requests with valid Bearer token", async () => {
      process.env.SUPABASE_URL = "https://example.supabase.co"
      process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key"
      process.env.ALIVE_PASSCODE = "test-passcode"
      process.env.NODE_ENV = "development"
      process.env.E2B_API_KEY = "e2b_test_key"
      process.env.GROQ_API_SECRET = "groq-secret"
      process.env.POSTHOG_API_KEY = "posthog-key"
      process.env.POSTHOG_HOST = "https://posthog.example.com"
      process.env.POSTHOG_PROJECT_ID = "2"
      vi.resetModules()

      // Re-import to get fresh module with mocked transcribe
      const { transcribe: freshTranscribe } = await import("./voice.service")
      vi.mocked(freshTranscribe).mockResolvedValueOnce({
        text: "authenticated",
        duration: 1.0,
        language: "en",
      })

      const { createApp } = await import("../../server/app")
      const app = createApp()

      const file = makeAudioFile()
      const form = new FormData()
      form.append("file", file, file.name)

      const response = await app.request("http://localhost/api/voice/transcribe", {
        method: "POST",
        headers: { Authorization: "Bearer test-passcode" },
        body: form,
      })

      expect(response.status).toBe(200)
      const body = await jsonBody<VoiceResponse>(response)
      expect(body.text).toBe("authenticated")
    })
  })

  // =========================================================================
  // HTTP method
  // =========================================================================

  describe("HTTP method", () => {
    it("rejects GET requests (only POST allowed)", async () => {
      const app = buildTestApp()
      const response = await app.request("http://localhost/api/voice/transcribe")

      // Hono returns 404 for unmatched methods on specific paths
      expect(response.status).toBe(404)
      expect(transcribe).not.toHaveBeenCalled()
    })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TranscribeError, transcribe } from "./voice.service"

// ---------------------------------------------------------------------------
// Mock fetch globally — all Groq API calls go through this
// ---------------------------------------------------------------------------

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal("fetch", fetchMock)

// Mock env so tests don't need real secrets
vi.mock("../../config/env", () => ({
  env: { GROQ_API_SECRET: "test-groq-key" },
}))

// Suppress retry logs in tests
vi.mock("../../infra/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAudioFile(sizeBytes: number, type = "audio/webm;codecs=opus", name = "voice.webm"): File {
  const buffer = new Uint8Array(sizeBytes)
  // Fill with non-zero data to simulate real audio
  for (let i = 0; i < buffer.length; i++) buffer[i] = (i % 200) + 28
  return new File([buffer], name, { type })
}

function groqOk(text: string, duration = 2.5, language = "en"): Response {
  return Response.json({ text, duration, language })
}

function groqError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), { status, statusText: "Error" })
}

function groqEmptyText(): Response {
  return Response.json({ text: "", duration: 0, language: "en" })
}

function groqNullText(): Response {
  return Response.json({ duration: 1.0, language: "en" })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("voice.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // File validation
  // =========================================================================

  describe("file validation", () => {
    it("rejects files smaller than 1KB", async () => {
      const file = makeAudioFile(500)
      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("TOO_SHORT")
      expect(err.status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("rejects zero-byte files", async () => {
      const file = makeAudioFile(0)
      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("TOO_SHORT")
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("rejects files exactly at the minimum boundary (999 bytes)", async () => {
      const file = makeAudioFile(999)
      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("TOO_SHORT")
    })

    it("accepts files at exactly 1000 bytes", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("hello"))
      const file = makeAudioFile(1000)

      const result = await transcribe({ file })
      expect(result.text).toBe("hello")
    })

    it("rejects files larger than 25MB", async () => {
      const file = makeAudioFile(25 * 1024 * 1024 + 1)
      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("TOO_LARGE")
      expect(err.status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("accepts files at exactly 25MB", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("large file"))
      const file = makeAudioFile(25 * 1024 * 1024)

      const result = await transcribe({ file })
      expect(result.text).toBe("large file")
    })

    it("rejects unsupported MIME types", async () => {
      const file = makeAudioFile(5000, "video/mp4", "video.mp4")
      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("INVALID_FORMAT")
      expect(err.status).toBe(400)
      expect(err.message).toContain("video/mp4")
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("rejects application/json MIME type", async () => {
      const file = makeAudioFile(5000, "application/json", "data.json")
      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("INVALID_FORMAT")
    })

    it("accepts audio/webm;codecs=opus (strips codec suffix)", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("webm opus"))
      const file = makeAudioFile(5000, "audio/webm;codecs=opus")

      const result = await transcribe({ file })
      expect(result.text).toBe("webm opus")
    })

    it("accepts audio/mp4", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("mp4 audio"))
      const file = makeAudioFile(5000, "audio/mp4")
      await expect(transcribe({ file })).resolves.toBeDefined()
    })

    it("accepts audio/mpeg", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("mp3 audio"))
      const file = makeAudioFile(5000, "audio/mpeg")
      await expect(transcribe({ file })).resolves.toBeDefined()
    })

    it("accepts audio/ogg", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("ogg audio"))
      const file = makeAudioFile(5000, "audio/ogg")
      await expect(transcribe({ file })).resolves.toBeDefined()
    })

    it("accepts audio/wav", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("wav audio"))
      const file = makeAudioFile(5000, "audio/wav")
      await expect(transcribe({ file })).resolves.toBeDefined()
    })

    it("accepts audio/flac", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("flac audio"))
      const file = makeAudioFile(5000, "audio/flac")
      await expect(transcribe({ file })).resolves.toBeDefined()
    })

    it("accepts files with empty MIME type (browser may not set it)", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("no mime"))
      const file = makeAudioFile(5000, "")
      await expect(transcribe({ file })).resolves.toBeDefined()
    })
  })

  // =========================================================================
  // Successful transcription
  // =========================================================================

  describe("successful transcription", () => {
    it("returns text, duration, and language from Groq", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("Hello, world!", 3.2, "en"))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })

      expect(result).toEqual({
        text: "Hello, world!",
        duration: 3.2,
        language: "en",
      })
    })

    it("trims whitespace from transcribed text", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("  hello  "))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })
      expect(result.text).toBe("hello")
    })

    it("sends correct model and response_format to Groq", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("test"))
      const file = makeAudioFile(5000, "audio/webm;codecs=opus", "voice.webm")

      await transcribe({ file })

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions")
      expect(init?.method).toBe("POST")
      expect(init?.headers).toEqual({ Authorization: "Bearer test-groq-key" })

      // Verify FormData contents
      const body = init?.body as FormData
      expect(body.get("model")).toBe("whisper-large-v3-turbo")
      expect(body.get("response_format")).toBe("verbose_json")
    })

    it("sends language hint when provided", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("hola", 1.0, "es"))
      const file = makeAudioFile(5000)

      await transcribe({ file, language: "es" })

      const body = fetchMock.mock.calls[0][1]?.body as FormData
      expect(body.get("language")).toBe("es")
    })

    it("omits language field when not provided", async () => {
      fetchMock.mockResolvedValueOnce(groqOk("hello"))
      const file = makeAudioFile(5000)

      await transcribe({ file })

      const body = fetchMock.mock.calls[0][1]?.body as FormData
      expect(body.get("language")).toBeNull()
    })

    it("returns null duration when Groq omits it", async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ text: "hello", language: "en" }))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })
      expect(result.duration).toBeNull()
    })

    it("returns null language when Groq omits it", async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ text: "hello", duration: 1.0 }))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })
      expect(result.language).toBeNull()
    })

    it("returns null for non-number duration", async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ text: "hello", duration: "not a number", language: "en" }))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })
      expect(result.duration).toBeNull()
    })
  })

  // =========================================================================
  // No speech detected
  // =========================================================================

  describe("no speech detected", () => {
    it("throws NO_SPEECH when Groq returns empty text", async () => {
      fetchMock.mockResolvedValueOnce(groqEmptyText())
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("NO_SPEECH")
      expect(err.status).toBe(422)
    })

    it("throws NO_SPEECH when Groq returns null/undefined text", async () => {
      fetchMock.mockResolvedValueOnce(groqNullText())
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("NO_SPEECH")
    })

    it("throws NO_SPEECH when text is only whitespace", async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ text: "   \n  ", duration: 1.0 }))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("NO_SPEECH")
    })
  })

  // =========================================================================
  // Groq API errors (non-retryable)
  // =========================================================================

  describe("non-retryable Groq errors", () => {
    it("throws GROQ_ERROR on 400 without retrying", async () => {
      fetchMock.mockResolvedValueOnce(groqError(400, "Invalid audio format"))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("GROQ_ERROR")
      expect(err.status).toBe(400)
      expect(err.message).toContain("Invalid audio format")
      expect(fetchMock).toHaveBeenCalledTimes(1) // No retry
    })

    it("throws GROQ_ERROR on 401 without retrying", async () => {
      fetchMock.mockResolvedValueOnce(groqError(401, "Invalid API key"))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.status).toBe(401)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("throws GROQ_ERROR on 413 without retrying", async () => {
      fetchMock.mockResolvedValueOnce(groqError(413, "Payload too large"))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.status).toBe(413)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("handles Groq returning non-JSON error body", async () => {
      fetchMock.mockResolvedValueOnce(new Response("Internal Server Error", { status: 400, statusText: "Bad Request" }))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.message).toContain("Bad Request")
    })
  })

  // =========================================================================
  // Retry behavior
  // =========================================================================

  describe("retry on transient errors", () => {
    it("retries on 429 and succeeds on second attempt", async () => {
      fetchMock
        .mockResolvedValueOnce(groqError(429, "Rate limited"))
        .mockResolvedValueOnce(groqOk("success after retry"))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })

      expect(result.text).toBe("success after retry")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("retries on 502 and succeeds on second attempt", async () => {
      fetchMock.mockResolvedValueOnce(groqError(502, "Bad Gateway")).mockResolvedValueOnce(groqOk("recovered"))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })

      expect(result.text).toBe("recovered")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("retries on 503 and succeeds on second attempt", async () => {
      fetchMock.mockResolvedValueOnce(groqError(503, "Service Unavailable")).mockResolvedValueOnce(groqOk("back up"))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })

      expect(result.text).toBe("back up")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("retries on 504 and succeeds on second attempt", async () => {
      fetchMock.mockResolvedValueOnce(groqError(504, "Gateway Timeout")).mockResolvedValueOnce(groqOk("finally"))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })

      expect(result.text).toBe("finally")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("exhausts all 3 attempts on persistent 503", async () => {
      fetchMock.mockResolvedValue(groqError(503, "Down for maintenance"))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("GROQ_ERROR")
      expect(err.status).toBe(503)
      expect(fetchMock).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it("exhausts all 3 attempts on persistent 429", async () => {
      fetchMock.mockResolvedValue(groqError(429, "Rate limited"))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("does not retry on 400 — only transient status codes are retried", async () => {
      fetchMock.mockResolvedValueOnce(groqError(400, "Bad request"))
      const file = makeAudioFile(5000)

      await transcribe({ file }).catch(() => {})

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does not retry on 401", async () => {
      fetchMock.mockResolvedValueOnce(groqError(401, "Unauthorized"))
      const file = makeAudioFile(5000)

      await transcribe({ file }).catch(() => {})

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("retries on 500 and succeeds on second attempt", async () => {
      fetchMock.mockResolvedValueOnce(groqError(500, "Internal error")).mockResolvedValueOnce(groqOk("recovered"))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })

      expect(result.text).toBe("recovered")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("recovers on third attempt after two failures", async () => {
      fetchMock
        .mockResolvedValueOnce(groqError(503, "down"))
        .mockResolvedValueOnce(groqError(503, "still down"))
        .mockResolvedValueOnce(groqOk("finally up"))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })

      expect(result.text).toBe("finally up")
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })

  // =========================================================================
  // Timeout handling
  // =========================================================================

  describe("timeout handling", () => {
    it("wraps fetch timeout into TranscribeError with TIMEOUT code", async () => {
      fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError"))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("TIMEOUT")
      expect(err.status).toBe(504)
      expect(err.message).toContain("timed out")
    })

    it("retries on timeout and succeeds on second attempt", async () => {
      fetchMock
        .mockRejectedValueOnce(new DOMException("Aborted", "TimeoutError"))
        .mockResolvedValueOnce(groqOk("recovered from timeout"))
      const file = makeAudioFile(5000)

      const result = await transcribe({ file })

      expect(result.text).toBe("recovered from timeout")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("exhausts retries on persistent timeout", async () => {
      fetchMock.mockRejectedValue(new DOMException("Aborted", "TimeoutError"))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TranscribeError)
      expect(err.code).toBe("TIMEOUT")
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })

  // =========================================================================
  // Network errors
  // =========================================================================

  describe("network errors", () => {
    it("propagates non-timeout fetch errors without retry", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
      const file = makeAudioFile(5000)

      const err = await transcribe({ file }).catch(e => e)

      expect(err).toBeInstanceOf(TypeError)
      expect(err.message).toBe("Failed to fetch")
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // TranscribeError structure
  // =========================================================================

  describe("TranscribeError", () => {
    it("has correct name, code, status, and message", () => {
      const err = new TranscribeError("test message", "TOO_SHORT", 400)

      expect(err.name).toBe("TranscribeError")
      expect(err.code).toBe("TOO_SHORT")
      expect(err.status).toBe(400)
      expect(err.message).toBe("test message")
      expect(err).toBeInstanceOf(Error)
    })

    it("is instanceof Error", () => {
      const err = new TranscribeError("msg", "GROQ_ERROR", 500)
      expect(err instanceof Error).toBe(true)
    })
  })
})

"use client"

import { useMutation } from "@tanstack/react-query"
import type { VoiceLanguage } from "@webalive/shared"
import { useCallback, useEffect, useRef, useState } from "react"
import type { TranscribeResult } from "@/lib/api/types"
import { TranscribeApiError, transcribeAudio } from "@/lib/api/voice"
import type { VoiceState } from "../types/voice"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** RMS below this = silence. Calibrated from ambient noise floor. */
const DEFAULT_SILENCE_THRESHOLD = 12
/** How long silence must persist before auto-stop (ms) */
const SILENCE_DURATION_MS = 1500
/** Audio level polling interval (ms) */
const LEVEL_CHECK_INTERVAL_MS = 60
/** Don't auto-stop within this window — avoids cutting off start */
const MIN_RECORDING_MS = 600
/** Hard ceiling — stop no matter what after this */
const MAX_RECORDING_MS = 60_000
/** Blobs shorter than this are likely silence/noise — don't send */
const MIN_BLOB_BYTES = 2_000
/** How many ms of ambient noise to sample for threshold calibration */
const CALIBRATION_MS = 250
/** Multiplier above noise floor for adaptive threshold */
const NOISE_FLOOR_MULTIPLIER = 2.5
/** Retry config for transient transcription failures */
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 500
/** Error display duration before auto-clearing (ms) */
const ERROR_DISPLAY_MS = 4_000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void
  onError: (message: string) => void
  /** ISO 639-1 language code for transcription */
  language?: VoiceLanguage
}

export interface VoiceInputResult {
  state: VoiceState
  /** Normalized audio level 0–1 for visualization, updated ~16x/sec */
  audioLevel: number
  /** How long the current recording has been running (ms) */
  elapsed: number
  /** Last error message, if state === "error" */
  errorMessage: string | null
  toggle: () => Promise<void>
  startRecording: () => Promise<void>
  stopRecording: () => void
  /** Dismiss error state and return to idle */
  clearError: () => void
  /** Cancel in-flight transcription */
  cancelTranscription: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return ""
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus"
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4"
  return ""
}

function computeRms(data: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const v = data[i] - 128
    sum += v * v
  }
  return Math.sqrt(sum / data.length)
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Robust voice input: record → auto-stop on silence → transcribe → callback.
 *
 * - Real-time audio level for UI visualization
 * - Adaptive silence threshold (calibrates from ambient noise)
 * - Auto-stop after silence, max duration, and manual stop
 * - Minimum blob size check (won't send silence to Groq)
 * - Retry on transient server errors
 * - AbortController for cancelling in-flight transcription
 * - Elapsed time tracking
 * - Error state with auto-clear
 */
export function useVoiceInput({ onTranscript, onError, language }: UseVoiceInputOptions): VoiceInputResult {
  // -- Render state --
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [audioLevel, setAudioLevel] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // -- Refs (source of truth, no stale closures) --
  const recordingRef = useRef(false)
  const lockRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const silenceThresholdRef = useRef(DEFAULT_SILENCE_THRESHOLD)
  const hadSpeechRef = useRef(false)
  const silentSinceRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cbRef = useRef({ onTranscript, onError, language })
  cbRef.current = { onTranscript, onError, language }

  // -- Transition helpers --
  const goIdle = useCallback(() => {
    setVoiceState("idle")
    setAudioLevel(0)
    setElapsed(0)
    setErrorMessage(null)
  }, [])

  const goError = useCallback(
    (msg: string) => {
      setVoiceState("error")
      setErrorMessage(msg)
      setAudioLevel(0)
      cbRef.current.onError(msg)

      // Auto-clear error after delay
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      errorTimerRef.current = setTimeout(() => {
        errorTimerRef.current = null
        goIdle()
      }, ERROR_DISPLAY_MS)
    },
    [goIdle],
  )

  const clearError = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
    goIdle()
  }, [goIdle])

  // -- Cleanup --
  const stopTimers = useCallback(() => {
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current)
      levelTimerRef.current = null
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  const releaseAudio = useCallback(() => {
    stopTimers()
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    analyserRef.current = null
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
  }, [stopTimers])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseAudio()
      if (abortRef.current) abortRef.current.abort()
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [releaseAudio])

  // -- Transcription with retry --
  const transcribeWithRetry = useCallback(async (blob: Blob, signal: AbortSignal) => {
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError")
      try {
        return await transcribeAudio(blob, cbRef.current.language, signal)
      } catch (err) {
        if (signal.aborted) throw err
        lastError = err instanceof Error ? err : new Error(String(err))
        const isRetryable = err instanceof TranscribeApiError && isRetryableStatus(err.status)
        if (!isRetryable || attempt === MAX_RETRIES) break
        await sleep(RETRY_DELAY_MS * 2 ** attempt)
      }
    }
    throw lastError
  }, [])

  // -- Transcription mutation --
  const mutation = useMutation<TranscribeResult, Error, Blob>({
    mutationFn: (blob: Blob) => {
      abortRef.current = new AbortController()
      return transcribeWithRetry(blob, abortRef.current.signal)
    },
    onSuccess: data => {
      abortRef.current = null
      const text = data.text.trim()
      if (text) {
        cbRef.current.onTranscript(text)
        goIdle()
      } else {
        goError("No speech detected — try speaking louder")
      }
    },
    onError: err => {
      abortRef.current = null
      if (err instanceof DOMException && err.name === "AbortError") {
        goIdle()
        return
      }
      const msg =
        err instanceof TranscribeApiError
          ? err.status === 504
            ? "Transcription timed out — try a shorter message"
            : err.status >= 500
              ? "Transcription service unavailable — try again"
              : err.message
          : "Couldn't transcribe audio — try again"
      goError(msg)
    },
  })

  const cancelTranscription = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // -- Stop recording --
  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setVoiceState("stopping")
    stopTimers()
    setAudioLevel(0)

    try {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop() // triggers onstop → sends blob
      } else {
        releaseAudio()
        goIdle()
      }
    } catch {
      releaseAudio()
      goIdle()
    }
    lockRef.current = false
  }, [stopTimers, releaseAudio, goIdle])

  // -- Start recording --
  const startRecording = useCallback(async () => {
    if (recordingRef.current || lockRef.current || mutation.isPending) return
    lockRef.current = true

    // Clear any existing error
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }

    // Acquire microphone
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      lockRef.current = false
      goError("Microphone access denied")
      return
    }

    streamRef.current = stream
    recordingRef.current = true
    hadSpeechRef.current = false
    silentSinceRef.current = null
    silenceThresholdRef.current = DEFAULT_SILENCE_THRESHOLD
    startTimeRef.current = Date.now()

    // Set up MediaRecorder
    const mime = pickMimeType()
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onerror = () => {
      releaseAudio()
      recordingRef.current = false
      lockRef.current = false
      goError("Recording failed — microphone may be in use")
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      releaseAudio()

      if (blob.size < MIN_BLOB_BYTES) {
        goError("Recording too short — hold longer or speak louder")
        return
      }

      setVoiceState("transcribing")
      mutation.mutate(blob)
    }

    recorder.start(250) // timeslice: get data every 250ms for smoother onstop

    setVoiceState("recording")
    setElapsed(0)
    lockRef.current = false

    // Elapsed timer
    elapsedTimerRef.current = setInterval(() => {
      const ms = Date.now() - startTimeRef.current
      setElapsed(ms)

      // Hard max duration
      if (ms >= MAX_RECORDING_MS) {
        stopRecording()
      }
    }, 200)

    // Set up Web Audio API for level monitoring + silence detection
    try {
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.3
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.fftSize)
      let calibrationSamples: number[] = []
      let calibrated = false

      levelTimerRef.current = setInterval(() => {
        if (!recordingRef.current || !analyserRef.current) return

        analyserRef.current.getByteTimeDomainData(dataArray)
        const rms = computeRms(dataArray)

        // Normalize to 0–1 (RMS range in practice is ~0–50 for speech)
        const normalizedLevel = Math.min(1, rms / 40)
        setAudioLevel(normalizedLevel)

        const now = Date.now()
        const elapsedMs = now - startTimeRef.current

        // Phase 1: Calibrate noise floor from first N ms
        if (!calibrated && elapsedMs < CALIBRATION_MS) {
          calibrationSamples.push(rms)
          return
        }

        if (!calibrated) {
          calibrated = true
          if (calibrationSamples.length > 0) {
            const avg = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length
            // Threshold = noise floor * multiplier, but at least DEFAULT
            silenceThresholdRef.current = Math.max(DEFAULT_SILENCE_THRESHOLD, avg * NOISE_FLOOR_MULTIPLIER)
          }
          calibrationSamples = [] // free memory
        }

        // Phase 2: Detect speech / silence
        const threshold = silenceThresholdRef.current

        if (rms > threshold) {
          hadSpeechRef.current = true
          silentSinceRef.current = null
        } else {
          if (silentSinceRef.current === null) silentSinceRef.current = now

          // Auto-stop: past minimum recording, had speech, silence long enough
          if (
            elapsedMs > MIN_RECORDING_MS &&
            hadSpeechRef.current &&
            now - silentSinceRef.current >= SILENCE_DURATION_MS
          ) {
            stopRecording()
          }
        }
      }, LEVEL_CHECK_INTERVAL_MS)
    } catch {
      // AudioContext not available — recording works, just no auto-stop / level
    }
  }, [mutation, releaseAudio, goError, stopRecording])

  // -- Toggle --
  const toggle = useCallback(async () => {
    if (voiceState === "error") {
      clearError()
      return
    }
    if (voiceState === "transcribing") {
      cancelTranscription()
      return
    }
    if (recordingRef.current) {
      stopRecording()
    } else {
      await startRecording()
    }
  }, [voiceState, startRecording, stopRecording, clearError, cancelTranscription])

  return {
    state: voiceState,
    audioLevel,
    elapsed,
    errorMessage,
    toggle,
    startRecording,
    stopRecording,
    clearError,
    cancelTranscription,
  }
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { TranscribeResponse, VoiceState } from "../types/voice"

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void
  onError: (message: string) => void
}

/**
 * Self-contained voice input hook.
 *
 * Records audio from the microphone, sends it to /api/voice/transcribe,
 * and calls onTranscript with the result. No streaming — records full
 * utterance, then transcribes.
 *
 * Outputs webm/opus (Chrome/Firefox) or mp4 (Safari).
 */
export function useVoiceInput({ onTranscript, onError }: UseVoiceInputOptions) {
  const [state, setState] = useState<VoiceState>("idle")

  // Synchronous lock — prevents race conditions from double-clicks
  // and async gaps during getUserMedia. Updated immediately, not
  // subject to React batching.
  const phaseRef = useRef<VoiceState>("idle")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)

  // Stable refs for callbacks — avoids useCallback cascade
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const setPhase = useCallback((next: VoiceState) => {
    phaseRef.current = next
    setState(next)
  }, [])

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  // Cleanup on unmount — stop mic, prevent setState on unmounted
  useEffect(() => {
    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  const transcribe = useCallback(
    async (blob: Blob) => {
      setPhase("transcribing")
      try {
        const ext = blob.type.includes("mp4") ? "m4a" : "webm"
        const file = new File([blob], `voice.${ext}`, { type: blob.type })

        const form = new FormData()
        form.append("file", file)

        const res = await fetch("/api/voice/transcribe", { method: "POST", body: form })
        const data: TranscribeResponse = await res.json()

        if (!mountedRef.current) return

        if (!res.ok || "error" in data) {
          onErrorRef.current("error" in data ? data.error : `Transcription failed (${res.status})`)
          return
        }

        const text = data.text.trim()
        if (text) onTranscriptRef.current(text)
      } catch {
        if (!mountedRef.current) return
        onErrorRef.current("Could not reach transcription service")
      } finally {
        if (mountedRef.current) setPhase("idle")
      }
    },
    [setPhase],
  )

  const startRecording = useCallback(async () => {
    // Synchronous guard — blocks before any async work
    if (phaseRef.current !== "idle") return
    phaseRef.current = "recording" // lock immediately

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })

      // Check if unmounted or stopped during getUserMedia prompt
      if (!mountedRef.current || phaseRef.current !== "recording") {
        for (const track of stream.getTracks()) track.stop()
        return
      }

      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : ""

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        cleanup()
        if (blob.size > 0 && mountedRef.current) transcribe(blob)
        else if (mountedRef.current) setPhase("idle")
      }

      recorder.start()
      setState("recording") // sync React state with lock
    } catch {
      cleanup()
      phaseRef.current = "idle"
      if (mountedRef.current) {
        setState("idle")
        onErrorRef.current("Microphone access denied")
      }
    }
  }, [cleanup, transcribe, setPhase])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const toggle = useCallback(() => {
    if (phaseRef.current === "idle") startRecording()
    else if (phaseRef.current === "recording") stopRecording()
  }, [startRecording, stopRecording])

  return { state, toggle } as const
}

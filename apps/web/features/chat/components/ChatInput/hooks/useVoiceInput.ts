"use client"

import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import type { TranscribeResult } from "@/lib/api/types"
import { transcribeAudio } from "@/lib/api/voice"
import type { VoiceState } from "../types/voice"

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void
  onError: (message: string) => void
}

function pickMimeType(): string {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus"
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4"
  return ""
}

/**
 * Voice input: record → transcribe → callback.
 * Uses TanStack mutation for the transcription fetch.
 */
export function useVoiceInput({ onTranscript, onError }: UseVoiceInputOptions) {
  const [recording, setRecording] = useState(false)
  const lockRef = useRef(false) // sync guard for async getUserMedia gap
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Stable callback refs
  const cbRef = useRef({ onTranscript, onError })
  cbRef.current = { onTranscript, onError }

  const mutation = useMutation<TranscribeResult, Error, Blob>({
    mutationFn: transcribeAudio,
    onSuccess: (data) => {
      const text = data.text.trim()
      if (text) cbRef.current.onTranscript(text)
    },
    onError: (err) => cbRef.current.onError(err.message),
  })

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  // Release mic on unmount
  useEffect(() => releaseStream, [releaseStream])

  const toggle = useCallback(async () => {
    // --- stop ---
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      lockRef.current = false
      return
    }

    // --- start ---
    if (lockRef.current || mutation.isPending) return
    lockRef.current = true

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      lockRef.current = false
      cbRef.current.onError("Microphone access denied")
      return
    }

    streamRef.current = stream
    const mime = pickMimeType()
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      releaseStream()
      if (blob.size > 0) mutation.mutate(blob)
    }

    recorder.start()
    setRecording(true)
  }, [recording, mutation, releaseStream])

  const state: VoiceState = mutation.isPending ? "transcribing" : recording ? "recording" : "idle"

  return { state, toggle } as const
}

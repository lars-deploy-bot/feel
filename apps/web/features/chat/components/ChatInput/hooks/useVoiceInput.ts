"use client"

import { useMutation } from "@tanstack/react-query"
import type { VoiceLanguage } from "@webalive/shared"
import { useCallback, useEffect, useRef, useState } from "react"
import type { TranscribeResult } from "@/lib/api/types"
import { transcribeAudio } from "@/lib/api/voice"
import type { VoiceState } from "../types/voice"

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void
  onError: (message: string) => void
  /** ISO 639-1 language code for transcription */
  language?: VoiceLanguage
}

function pickMimeType(): string {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus"
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4"
  return ""
}

/**
 * Voice input: record → transcribe → callback.
 *
 * Exposes `startRecording` / `stopRecording` for hold-to-speak
 * and `toggle` for click-to-toggle.
 *
 * Recording state uses a ref as source of truth to avoid stale closures
 * in callbacks. The useState is only for triggering re-renders.
 */
export function useVoiceInput({ onTranscript, onError, language }: UseVoiceInputOptions) {
  const [recording, setRecording] = useState(false)
  // Ref is the source of truth — avoids stale closure in stopRecording/toggle
  const recordingRef = useRef(false)
  const lockRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const cbRef = useRef({ onTranscript, onError, language })
  cbRef.current = { onTranscript, onError, language }

  const mutation = useMutation<TranscribeResult, Error, Blob>({
    mutationFn: (blob: Blob) => transcribeAudio(blob, cbRef.current.language),
    onSuccess: data => {
      const text = data.text.trim()
      if (text) cbRef.current.onTranscript(text)
    },
    onError: err => cbRef.current.onError(err.message),
  })

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => releaseStream, [releaseStream])

  const setRecordingState = useCallback((value: boolean) => {
    recordingRef.current = value
    setRecording(value)
  }, [])

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return
    try {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop()
      } else {
        // Recorder already stopped/inactive — just clean up
        releaseStream()
      }
    } catch {
      releaseStream()
    }
    setRecordingState(false)
    lockRef.current = false
  }, [setRecordingState, releaseStream])

  const startRecording = useCallback(async () => {
    if (recordingRef.current || lockRef.current || mutation.isPending) return
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

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onerror = () => {
      releaseStream()
      setRecordingState(false)
      lockRef.current = false
      cbRef.current.onError("Recording failed")
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      releaseStream()
      if (blob.size > 0) mutation.mutate(blob)
    }

    recorder.start()
    setRecordingState(true)
  }, [mutation, releaseStream, setRecordingState])

  const toggle = useCallback(async () => {
    if (recordingRef.current) {
      stopRecording()
    } else {
      await startRecording()
    }
  }, [startRecording, stopRecording])

  const state: VoiceState = mutation.isPending ? "transcribing" : recording ? "recording" : "idle"

  return { state, toggle, startRecording, stopRecording } as const
}

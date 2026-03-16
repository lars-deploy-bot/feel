"use client"

import { useCallback, useState } from "react"

// ── Mock publish ────────────────────────────────────────────────────────────
// TODO: replace with real API call

export type PublishState = "idle" | "building" | "done" | "error"

const MOCK_OUTCOMES: Array<{ state: PublishState; delay: number; message: string }> = [
  { state: "done", delay: 2400, message: "Live" },
  { state: "done", delay: 3800, message: "Live" },
  { state: "error", delay: 3200, message: "Build failed" },
  { state: "error", delay: 1800, message: "Timed out" },
]

export function usePublish() {
  const [state, setState] = useState<PublishState>("idle")
  const [message, setMessage] = useState("")

  const publish = useCallback(() => {
    if (state === "building") return
    setState("building")
    setMessage("")

    const outcome = MOCK_OUTCOMES[Math.floor(Math.random() * MOCK_OUTCOMES.length)]
    setTimeout(() => {
      setState(outcome.state)
      setMessage(outcome.message)
      setTimeout(() => {
        setState("idle")
        setMessage("")
      }, 3000)
    }, outcome.delay)
  }, [state])

  return { state, message, publish }
}

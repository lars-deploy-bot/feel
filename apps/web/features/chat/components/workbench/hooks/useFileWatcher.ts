"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { invalidateFileCache } from "../FileTree"
import { notifyFileChange } from "../lib/file-events"
import { invalidateFileContentCache } from "./useFileContent"

type WatcherState = "connecting" | "connected" | "disconnected" | "error"

interface FSEvent {
  op: "modify" | "create" | "remove" | "rename"
  path: string
  isDir: boolean
}

interface WatchMessage {
  type: "connected" | "fs_event" | "error"
  events?: FSEvent[]
  watchRoot?: string
  message?: string
}

interface UseFileWatcherOptions {
  workspace: string
  worktree?: string | null
}

const MAX_BACKOFF = 30_000
const INITIAL_BACKOFF = 1_000

function parentDir(filePath: string): string {
  const idx = filePath.lastIndexOf("/")
  return idx > 0 ? filePath.slice(0, idx) : ""
}

export function useFileWatcher({ workspace, worktree }: UseFileWatcherOptions): { state: WatcherState } {
  const [state, setState] = useState<WatcherState>("connecting")
  const wsRef = useRef<WebSocket | null>(null)
  const mountGenRef = useRef(0)
  const backoffRef = useRef(INITIAL_BACKOFF)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(
    async (generation: number) => {
      setState("connecting")

      try {
        const res = await fetch("/api/watch/lease", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace, worktree: worktree || undefined }),
        })

        if (generation !== mountGenRef.current) return

        if (!res.ok) {
          setState("error")
          scheduleReconnect(generation)
          return
        }

        const data = await res.json()
        const wsUrl = data.wsUrl
        if (typeof wsUrl !== "string") {
          setState("error")
          scheduleReconnect(generation)
          return
        }

        if (generation !== mountGenRef.current) return

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (generation !== mountGenRef.current) {
            ws.close()
            return
          }
        }

        ws.onmessage = event => {
          if (generation !== mountGenRef.current) return

          if (typeof event.data !== "string") return

          let msg: WatchMessage
          try {
            msg = JSON.parse(event.data)
          } catch {
            return
          }

          switch (msg.type) {
            case "connected":
              setState("connected")
              backoffRef.current = INITIAL_BACKOFF
              break

            case "fs_event":
              if (msg.events) {
                handleEvents(msg.events, workspace, worktree)
              }
              break

            case "error":
              console.warn("[FileWatcher] Server error:", msg.message)
              break
          }
        }

        ws.onerror = () => {
          if (generation !== mountGenRef.current) return
          setState("error")
        }

        ws.onclose = () => {
          if (generation !== mountGenRef.current) return
          wsRef.current = null
          setState("disconnected")
          scheduleReconnect(generation)
        }
      } catch {
        if (generation !== mountGenRef.current) return
        setState("error")
        scheduleReconnect(generation)
      }

      function scheduleReconnect(gen: number) {
        const delay = backoffRef.current
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF)
        reconnectTimerRef.current = setTimeout(() => {
          if (gen === mountGenRef.current) {
            connect(gen)
          }
        }, delay)
      }
    },
    [workspace, worktree],
  )

  useEffect(() => {
    const generation = ++mountGenRef.current
    connect(generation)

    return () => {
      mountGenRef.current++
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return { state }
}

function handleEvents(events: FSEvent[], workspace: string, worktree: string | null | undefined): void {
  let hasChanges = false

  for (const ev of events) {
    switch (ev.op) {
      case "modify":
        if (!ev.isDir) {
          invalidateFileContentCache(workspace, worktree, ev.path)
          hasChanges = true
        }
        break

      case "create":
      case "remove":
      case "rename":
        // Invalidate both the parent directory listing and the file content
        invalidateFileCache(workspace, worktree, parentDir(ev.path))
        invalidateFileContentCache(workspace, worktree, ev.path)
        hasChanges = true
        break
    }
  }

  if (hasChanges) {
    notifyFileChange()
  }
}

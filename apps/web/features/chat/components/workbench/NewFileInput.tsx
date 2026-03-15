"use client"

import { File } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { saveFile } from "./lib/file-ops"

interface NewFileInputProps {
  workspace: string
  worktree?: string | null
  onCreated: (filePath: string) => void
  onCancel: () => void
}

export function NewFileInput({ workspace, worktree, onCreated, onCancel }: NewFileInputProps) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const validatePath = useCallback((rawPath: string): string | null => {
    if (rawPath.startsWith("/")) {
      return "Path must stay inside the workspace"
    }

    const segments = rawPath.split("/")
    if (segments.some(segment => segment === "" || segment === "." || segment === "..")) {
      return "Enter a valid file path"
    }

    return null
  }, [])

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current) {
      return
    }

    const trimmed = value.trim()
    if (!trimmed) {
      onCancel()
      return
    }

    const validationError = validatePath(trimmed)
    if (validationError) {
      setError(validationError)
      return
    }

    isSubmittingRef.current = true
    setSaving(true)
    setError(null)

    try {
      await saveFile(workspace, trimmed, "", worktree)
      onCreated(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create file")
      setSaving(false)
      isSubmittingRef.current = false
    }
  }, [onCancel, onCreated, validatePath, value, workspace, worktree])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onCancel()
      }
    },
    [handleSubmit, onCancel],
  )

  return (
    <div className="px-2 py-1">
      <div className="flex items-center gap-1 h-7">
        <File size={14} strokeWidth={1.5} className="shrink-0 text-zinc-400 dark:text-zinc-600" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSubmit}
          disabled={saving}
          placeholder="path/to/file.ts"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none border-b border-sky-500/50 pb-px"
        />
      </div>
      {error && <div className="text-[11px] text-red-500 mt-0.5 pl-[18px]">{error}</div>}
    </div>
  )
}

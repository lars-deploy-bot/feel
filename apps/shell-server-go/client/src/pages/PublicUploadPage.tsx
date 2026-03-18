import { useCallback, useRef, useState } from "react"

type UploadState = "idle" | "uploading" | "done" | "error"

interface UploadResult {
  success: boolean
  uploadId: string
  path: string
  fileCount: number
  totalBytes: number
  elapsed: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const secs = ms / 1000
  if (secs < 60) return `${secs.toFixed(1)}s`
  const mins = Math.floor(secs / 60)
  const remainSecs = Math.floor(secs % 60)
  return `${mins}m ${remainSecs}s`
}

const MAX_SIZE = 10 * 1024 * 1024 * 1024 // 10 GB

export function PublicUploadPage() {
  const [state, setState] = useState<UploadState>("idle")
  const [password, setPassword] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<XMLHttpRequest | null>(null)

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_SIZE) {
      setError(`File too large: ${formatBytes(f.size)}. Maximum is 10 GB.`)
      return
    }
    setFile(f)
    setError("")
    setResult(null)
    setState("idle")
    setProgress(0)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  const upload = useCallback(() => {
    if (!file) return

    setState("uploading")
    setProgress(0)
    setSpeed(0)
    setError("")
    setResult(null)

    const formData = new FormData()
    formData.append("password", password)
    formData.append("file", file)

    const xhr = new XMLHttpRequest()
    abortRef.current = xhr

    let lastLoaded = 0
    let lastTime = Date.now()

    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable) {
        const pct = (e.loaded / e.total) * 100
        setProgress(pct)

        const now = Date.now()
        const dt = (now - lastTime) / 1000
        if (dt > 0.5) {
          const bytesPerSec = (e.loaded - lastLoaded) / dt
          setSpeed(bytesPerSec)
          lastLoaded = e.loaded
          lastTime = now
        }
      }
    })

    xhr.addEventListener("load", () => {
      abortRef.current = null
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadResult
          setResult(data)
          setState("done")
        } catch {
          setError("Unexpected server response")
          setState("error")
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText)
          setError(data.error || `Upload failed (${xhr.status})`)
        } catch {
          setError(`Upload failed (${xhr.status})`)
        }
        setState("error")
      }
    })

    xhr.addEventListener("error", () => {
      abortRef.current = null
      setError("Network error — connection lost")
      setState("error")
    })

    xhr.addEventListener("abort", () => {
      abortRef.current = null
      setState("idle")
    })

    xhr.open("POST", "/api/public/upload")
    xhr.send(formData)
  }, [file, password])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState("idle")
    setProgress(0)
  }, [])

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
    setError("")
    setState("idle")
    setProgress(0)
    setSpeed(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const isUploading = state === "uploading"

  return (
    <div className="m-0 p-0 font-sans bg-shell-bg min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-shell-border px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-shell-accent flex items-center justify-center text-white font-bold text-sm font-mono">
          $
        </div>
        <h1 className="text-white text-lg font-semibold tracking-tight">Public Upload</h1>
        <span className="text-shell-text-muted text-sm ml-auto">up to 10 GB per file</span>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {/* Password */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={isUploading}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            className="w-full mb-4 p-3 border border-shell-border bg-shell-surface text-white rounded-lg text-sm focus:outline-none focus:border-shell-accent placeholder:text-shell-text-muted"
          />

          {/* Drop zone */}
          <div
            onDragOver={e => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
              ${dragOver ? "border-shell-accent bg-shell-accent/10" : "border-shell-border hover:border-shell-text-muted"}
              ${isUploading ? "pointer-events-none opacity-60" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleInputChange}
              disabled={isUploading}
            />

            {!file ? (
              <>
                <div className="text-4xl mb-4 opacity-40">
                  <svg
                    className="mx-auto"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-shell-text text-base mb-1">Drop a file here or click to browse</p>
                <p className="text-shell-text-muted text-sm">ZIP files are auto-extracted</p>
              </>
            ) : (
              <div>
                <p className="text-white font-medium text-base truncate">{file.name}</p>
                <p className="text-shell-text-muted text-sm mt-1">{formatBytes(file.size)}</p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div className="mt-4">
              <div className="h-2 bg-shell-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-shell-accent transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-shell-text-muted">
                <span>{progress.toFixed(1)}%</span>
                <span>{speed > 0 ? formatSpeed(speed) : "starting..."}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-shell-danger/10 border border-shell-danger/30 rounded-lg px-4 py-3 text-shell-danger text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {result && (
            <div className="mt-4 bg-shell-accent/10 border border-shell-accent/30 rounded-lg px-4 py-3">
              <p className="text-shell-accent font-medium text-sm">Upload complete</p>
              <div className="mt-2 text-shell-text text-sm space-y-1">
                <p>
                  <span className="text-shell-text-muted">Files:</span> {result.fileCount}
                </p>
                <p>
                  <span className="text-shell-text-muted">Size:</span> {formatBytes(result.totalBytes)}
                </p>
                <p>
                  <span className="text-shell-text-muted">Time:</span> {result.elapsed}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            {state === "idle" && file && (
              <button
                onClick={upload}
                className="flex-1 py-3 bg-shell-accent hover:bg-shell-accent-hover text-white rounded-lg font-semibold text-sm transition-colors"
              >
                Upload
              </button>
            )}

            {isUploading && (
              <button
                onClick={cancel}
                className="flex-1 py-3 bg-shell-danger hover:bg-shell-danger-hover text-white rounded-lg font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
            )}

            {(state === "done" || state === "error") && (
              <button
                onClick={reset}
                className="flex-1 py-3 bg-shell-surface hover:bg-shell-border text-white rounded-lg font-semibold text-sm transition-colors border border-shell-border"
              >
                Upload another
              </button>
            )}
          </div>

          {/* Info */}
          <div className="mt-8 text-shell-text-muted text-xs text-center">
            <p>Password required. Files are stored on the server.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

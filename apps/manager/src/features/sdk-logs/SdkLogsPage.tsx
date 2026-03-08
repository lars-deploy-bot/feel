import { useCallback, useEffect, useRef, useState } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { type LogFile, sdkLogsApi } from "./sdk-logs.api"

export function SdkLogsPage() {
  const [files, setFiles] = useState<LogFile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [lines, setLines] = useState<unknown[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingFile, setLoadingFile] = useState(false)
  const activeFileRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await sdkLogsApi.list()
      setFiles(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openFile = async (name: string) => {
    setSelected(name)
    setLoadingFile(true)
    setFileError(null)
    activeFileRef.current = name
    try {
      const result = await sdkLogsApi.read(name)
      if (activeFileRef.current === name) {
        setLines(result)
      }
    } catch (e: unknown) {
      if (activeFileRef.current === name) {
        setFileError(e instanceof Error ? e.message : String(e))
        setLines(null)
      }
    } finally {
      if (activeFileRef.current === name) {
        setLoadingFile(false)
      }
    }
  }

  return (
    <>
      <PageHeader title="SDK Call Logs" description="Raw Anthropic API request/response bodies" />

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm font-mono">
          {error}
          <div className="mt-2 text-xs text-red-400/70">
            Start proxy: <code>bun run scripts/sdk-log-proxy.ts</code>
          </div>
        </div>
      )}

      <div className="flex gap-4" style={{ height: "calc(100vh - 180px)" }}>
        {/* File list */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border border-border-primary rounded bg-bg-secondary">
          <div className="p-2 border-b border-border-primary flex items-center justify-between">
            <span className="text-xs text-text-tertiary font-mono">{files.length} calls</span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-xs text-text-secondary hover:text-text-primary cursor-pointer"
            >
              {loading ? "..." : "refresh"}
            </button>
          </div>
          {files.map(f => {
            const ts = f.name.replace(".jsonl", "").replace(/_\d{4}$/, "")
            return (
              <button
                key={f.name}
                type="button"
                onClick={() => void openFile(f.name)}
                className={`w-full text-left px-3 py-2 text-xs font-mono border-b border-border-primary cursor-pointer transition-colors ${
                  selected === f.name
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <div className="truncate">{ts}</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">{(f.size / 1024).toFixed(1)} KB</div>
              </button>
            )
          })}
        </div>

        {/* Log content */}
        <div className="flex-1 overflow-y-auto border border-border-primary rounded bg-bg-secondary">
          {!selected && <div className="p-8 text-center text-text-tertiary text-sm">Select a log file to inspect</div>}
          {selected && loadingFile && <div className="p-8 text-center text-text-tertiary text-sm">Loading...</div>}
          {selected && fileError && <div className="p-8 text-center text-red-400 text-sm font-mono">{fileError}</div>}
          {selected && !loadingFile && !fileError && lines && (
            <div className="divide-y divide-border-primary">
              {lines.map((line, i) => (
                <LogEntry key={i} data={line} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function LogEntry({ data }: { data: unknown }) {
  const [collapsed, setCollapsed] = useState(true)

  if (!data || typeof data !== "object") {
    return <pre className="p-3 text-xs font-mono text-text-secondary whitespace-pre-wrap">{String(data)}</pre>
  }

  const obj = data as Record<string, unknown>
  const type = obj._type as string
  const ts = obj._ts as string

  // Color-code by type
  const typeColors: Record<string, string> = {
    request: "text-blue-400 bg-blue-500/10",
    response: "text-green-400 bg-green-500/10",
    response_stream: "text-purple-400 bg-purple-500/10",
    stream_error: "text-red-400 bg-red-500/10",
  }

  const color = typeColors[type] || "text-text-secondary"

  // For request type, show model + path summary
  let summary = ""
  if (type === "request" && obj.body && typeof obj.body === "object") {
    const body = obj.body as Record<string, unknown>
    summary = `${obj.method} ${obj.path} — model: ${body.model || "?"}, messages: ${Array.isArray(body.messages) ? body.messages.length : "?"}`
  }
  if (type === "response") {
    summary = `status: ${obj.status}`
  }
  if (type === "response_stream") {
    summary = `${obj.eventCount} SSE events`
  }

  return (
    <div className="text-xs font-mono">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full text-left px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-bg-tertiary ${color}`}
      >
        <span className="text-[10px]">{collapsed ? "▶" : "▼"}</span>
        <span className="font-semibold uppercase">{type}</span>
        {ts && <span className="text-text-tertiary">{ts}</span>}
        {summary && <span className="text-text-secondary ml-2">{summary}</span>}
      </button>
      {!collapsed && <JsonBlock data={stripMeta(obj)} />}
    </div>
  )
}

/** Remove _type, _ts from display — they're already in the header */
function stripMeta(obj: Record<string, unknown>): unknown {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === "_type" || k === "_ts") continue
    clean[k] = v
  }
  return clean
}

function JsonBlock({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2)
  return (
    <pre className="px-3 py-2 text-[11px] text-text-secondary whitespace-pre-wrap overflow-x-auto bg-bg-primary/50 max-h-[600px] overflow-y-auto">
      {json}
    </pre>
  )
}

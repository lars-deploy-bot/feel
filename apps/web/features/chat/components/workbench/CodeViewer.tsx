"use client"

import { Check, ChevronDown, ChevronUp, Code, Copy, Eye, Pencil, Save, Search, X } from "lucide-react"
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { TOKEN_COLORS, tokenizeLine } from "@/lib/utils/syntax"
import { useFileContent } from "./hooks/useFileContent"
import { useWorkbenchShortcuts } from "./hooks/useWorkbenchShortcuts"
import { getFileColor } from "./lib/file-colors"
import { saveFile } from "./lib/file-ops"
import { getFileName } from "./lib/file-path"
import { ErrorMessage, LoadingSpinner, PanelBar } from "./ui"

interface CodeViewerProps {
  workspace: string
  worktree?: string | null
  filePath: string
  onClose: () => void
}

export function CodeViewer({ workspace, worktree, filePath, onClose }: CodeViewerProps) {
  const { file, loading, error } = useFileContent(workspace, filePath, worktree)
  const [copied, setCopied] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchIndex, setSearchIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const codeViewRef = useRef<HTMLPreElement>(null)

  const filename = getFileName(filePath)
  const lang = file?.language ?? ""
  const isMarkdown = lang === "markdown"
  const isCsv = lang === "csv" || lang === "tsv"
  const hasPreview = isMarkdown || isCsv

  // Sync editor content when file loads or changes
  useEffect(() => {
    if (file) setEditContent(file.content)
  }, [file])

  // Reset state on file change
  useEffect(() => {
    setSaveError(null)
    setSearchOpen(false)
    setSearchQuery("")
    setEditing(false)
  }, [filePath])

  // Preview tracks whether the file type supports it — always on for previewable files
  useEffect(() => {
    setPreviewing(hasPreview)
  }, [hasPreview, filePath])

  const hasChanges = file !== null && editContent !== file.content

  // --- Search ---

  const searchMatches = useMemo(() => {
    if (!searchQuery) return []
    const matches: number[] = []
    const lower = editContent.toLowerCase()
    const queryLower = searchQuery.toLowerCase()
    let pos = 0
    while (pos < lower.length) {
      const idx = lower.indexOf(queryLower, pos)
      if (idx === -1) break
      matches.push(idx)
      pos = idx + 1
    }
    return matches
  }, [editContent, searchQuery])

  // Reset index when matches change
  useEffect(() => {
    setSearchIndex(0)
  }, [searchMatches.length, searchQuery])

  // Select match in textarea
  useEffect(() => {
    if (searchMatches.length === 0 || !textareaRef.current || previewing) return
    const matchPos = searchMatches[searchIndex]
    if (matchPos === undefined) return
    const ta = textareaRef.current
    ta.focus()
    ta.setSelectionRange(matchPos, matchPos + searchQuery.length)

    // Scroll textarea to show the match
    // Calculate approximate line number and scroll to it
    const textBefore = editContent.substring(0, matchPos)
    const lineNumber = textBefore.split("\n").length - 1
    const lineHeight = 21 // 13px * 1.6
    const scrollTarget = lineNumber * lineHeight - ta.clientHeight / 2
    ta.scrollTop = Math.max(0, scrollTarget)
  }, [searchIndex, searchMatches, searchQuery, editContent, previewing])

  const handleSearchNav = useCallback(
    (direction: 1 | -1) => {
      if (searchMatches.length === 0) return
      setSearchIndex(prev => (prev + direction + searchMatches.length) % searchMatches.length)
    },
    [searchMatches.length],
  )

  const openSearch = useCallback(() => {
    // Switch to edit mode so textarea is available for search selection
    if (previewing) setPreviewing(false)
    setEditing(true)
    setSearchOpen(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [previewing])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery("")
    textareaRef.current?.focus()
  }, [])

  // --- Save ---

  const handleCopy = async () => {
    if (!editContent && editContent !== "") return
    try {
      await navigator.clipboard.writeText(editContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveFile(workspace, filePath, editContent, worktree)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }, [workspace, filePath, editContent, worktree])

  // Keyboard shortcuts — scoped via workbench handler (not window)
  const handleFind = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault()
      openSearch()
    },
    [openSearch],
  )
  const handleSaveShortcut = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault()
      if (hasChanges) handleSave()
    },
    [handleSave, hasChanges],
  )
  useWorkbenchShortcuts([
    { id: "codeviewer-find", key: "f", ctrlOrMeta: true, handler: handleFind },
    { id: "codeviewer-save", key: "s", ctrlOrMeta: true, handler: handleSaveShortcut },
  ])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <PanelBar className="px-3 gap-1.5">
        <span className={`${getFileColor(filename)}`}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <span className="text-[13px] text-black/70 dark:text-white/70 truncate flex-1">
          {filename}
          {hasChanges && <span className="text-amber-500 ml-1">*</span>}
        </span>

        {hasChanges && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 h-7 text-[12px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-40"
            title="Save (Ctrl+S)"
          >
            <Save size={13} strokeWidth={1.5} />
            {saving ? "Saving..." : "Save"}
          </button>
        )}

        {hasPreview && (
          <button
            type="button"
            onClick={() => setPreviewing(p => !p)}
            className={`p-1.5 rounded-lg transition-colors ${
              previewing
                ? "text-sky-500 dark:text-sky-400 bg-sky-500/[0.06]"
                : "text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
            }`}
            title={previewing ? "Edit source" : `Preview ${isCsv ? "table" : "markdown"}`}
          >
            {previewing ? <Code size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
          </button>
        )}

        {!hasPreview && (
          <button
            type="button"
            onClick={() => {
              setEditing(e => !e)
              if (!editing) requestAnimationFrame(() => textareaRef.current?.focus())
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              editing
                ? "text-sky-500 dark:text-sky-400 bg-sky-500/[0.06]"
                : "text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
            }`}
            title={editing ? "View highlighted" : "Edit"}
          >
            {editing ? <Eye size={15} strokeWidth={1.5} /> : <Pencil size={15} strokeWidth={1.5} />}
          </button>
        )}

        <button
          type="button"
          onClick={openSearch}
          className={`p-1.5 rounded-lg transition-colors ${
            searchOpen
              ? "text-sky-500 dark:text-sky-400 bg-sky-500/[0.06]"
              : "text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
          }`}
          title="Search (Ctrl+F)"
        >
          <Search size={15} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={handleCopy}
          disabled={!editContent && editContent !== ""}
          className="p-1.5 text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-lg transition-colors disabled:opacity-30"
          title={copied ? "Copied!" : "Copy"}
        >
          {copied ? (
            <Check size={15} strokeWidth={1.5} className="text-emerald-500" />
          ) : (
            <Copy size={15} strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] rounded-lg transition-colors"
          title="Close (Esc)"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </PanelBar>

      {/* Search bar */}
      {searchOpen && (
        <div className="h-9 px-3 flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.04] bg-black/[0.015] dark:bg-white/[0.02] shrink-0">
          <Search size={14} strokeWidth={1.5} className="text-black/30 dark:text-white/25 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
                closeSearch()
              }
              if (e.key === "Enter") {
                e.preventDefault()
                handleSearchNav(e.shiftKey ? -1 : 1)
              }
            }}
            placeholder="Find..."
            className="flex-1 min-w-0 bg-transparent text-[13px] text-black/80 dark:text-white/80 outline-none placeholder:text-black/25 dark:placeholder:text-white/20"
          />
          {searchQuery && (
            <span className="text-[11px] text-black/35 dark:text-white/30 tabular-nums shrink-0">
              {searchMatches.length === 0 ? "No results" : `${searchIndex + 1} of ${searchMatches.length}`}
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSearchNav(-1)}
            disabled={searchMatches.length === 0}
            className="p-1 text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 rounded-lg transition-colors disabled:opacity-30"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => handleSearchNav(1)}
            disabled={searchMatches.length === 0}
            className="p-1 text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 rounded-lg transition-colors disabled:opacity-30"
            title="Next (Enter)"
          >
            <ChevronDown size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={closeSearch}
            className="p-1 text-black/30 dark:text-white/25 hover:text-black/60 dark:hover:text-white/50 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="px-3 py-1.5 text-[12px] text-red-600 dark:text-red-400 border-b border-black/[0.06] dark:border-white/[0.04]">
          {saveError}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 overflow-auto">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="flex-1 overflow-auto">
          <ErrorMessage message={error} />
        </div>
      ) : previewing && isMarkdown ? (
        <div className="flex-1 overflow-auto">
          <div className="p-5">
            <MarkdownDisplay content={file?.content ?? ""} className="text-[14px]" />
          </div>
        </div>
      ) : previewing && isCsv ? (
        <CsvTable content={file?.content ?? ""} delimiter={lang === "tsv" ? "\t" : ","} />
      ) : editing || hasPreview ? (
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Tab") {
              e.preventDefault()
              const target = e.currentTarget
              const start = target.selectionStart
              const end = target.selectionEnd
              const value = target.value
              setEditContent(`${value.substring(0, start)}  ${value.substring(end)}`)
              requestAnimationFrame(() => {
                target.selectionStart = start + 2
                target.selectionEnd = start + 2
              })
            }
          }}
          spellCheck={false}
          className="flex-1 w-full resize-none bg-white dark:bg-[#0d0d0d] text-[13px] leading-[1.6] font-mono text-zinc-800 dark:text-zinc-200 p-4 outline-none border-none"
          style={{ tabSize: 2 }}
        />
      ) : (
        <HighlightedCode
          ref={codeViewRef}
          content={editContent}
          language={lang}
          onDoubleClick={() => {
            setEditing(true)
            requestAnimationFrame(() => textareaRef.current?.focus())
          }}
        />
      )}
    </div>
  )
}

// --- Syntax-highlighted code view ---

interface HighlightedCodeProps {
  content: string
  language: string
  onDoubleClick: () => void
}

const HighlightedCode = forwardRef<HTMLPreElement, HighlightedCodeProps>(function HighlightedCode(
  { content, language, onDoubleClick },
  ref,
) {
  const lines = content.split("\n")
  const gutterWidth = String(lines.length).length

  return (
    <pre
      ref={ref}
      onDoubleClick={onDoubleClick}
      className="flex-1 overflow-auto bg-white dark:bg-[#0d0d0d] text-[13px] leading-[1.6] font-mono cursor-text select-text"
      style={{ tabSize: 2 }}
    >
      <code className="flex flex-col py-4">
        {lines.map((line, i) => (
          <span key={i} className="flex">
            <span
              className="shrink-0 pr-4 pl-4 text-right text-zinc-300 dark:text-zinc-700 select-none"
              style={{ width: `${gutterWidth + 4}ch` }}
            >
              {i + 1}
            </span>
            <span className="flex-1 pr-4">
              {tokenizeLine(line, language).map((token, j) => (
                <span key={j} className={TOKEN_COLORS[token.type]}>
                  {token.value}
                </span>
              ))}
            </span>
          </span>
        ))}
      </code>
    </pre>
  )
})

// --- CSV Table Viewer ---

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      cells.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

interface CsvTableProps {
  content: string
  delimiter: string
}

const CsvTable = memo(function CsvTable({ content, delimiter }: CsvTableProps) {
  const { headers, rows } = useMemo(() => {
    const lines = content.split("\n").filter(l => l.trim() !== "")
    if (lines.length === 0) return { headers: [], rows: [] }
    return {
      headers: parseCsvLine(lines[0], delimiter),
      rows: lines.slice(1).map(line => parseCsvLine(line, delimiter)),
    }
  }, [content, delimiter])

  if (headers.length === 0) return null

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-[13px] font-mono">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="px-3 py-1.5 text-right text-[11px] text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900 border-b border-black/[0.06] dark:border-white/[0.06] w-10">
              #
            </th>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-1.5 text-left font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 border-b border-black/[0.06] dark:border-white/[0.06] whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
              <td className="px-3 py-1 text-right text-[11px] text-zinc-400 dark:text-zinc-600 border-b border-black/[0.03] dark:border-white/[0.03]">
                {ri + 1}
              </td>
              {headers.map((_, ci) => (
                <td
                  key={ci}
                  className="px-3 py-1 text-zinc-800 dark:text-zinc-200 border-b border-black/[0.03] dark:border-white/[0.03] whitespace-nowrap"
                >
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[11px] text-zinc-400 dark:text-zinc-600 border-t border-black/[0.06] dark:border-white/[0.06]">
        {rows.length} rows, {headers.length} columns
      </div>
    </div>
  )
})

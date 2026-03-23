"use client"

import { Check, ChevronDown, ChevronUp, Code, Copy, Eye, Save, Search, X } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { TOKEN_COLORS, tokenizeLine } from "@/lib/utils/syntax"
import { useFileContent } from "./hooks/useFileContent"
import { useWorkbenchShortcuts } from "./hooks/useWorkbenchShortcuts"
import { getFileColor } from "./lib/file-colors"
import { saveFile } from "./lib/file-ops"
import { getFileName } from "./lib/file-path"
import { ErrorMessage, LoadingSpinner, PanelBar } from "./ui"

/** Shared Tab→2-space indent for any textarea */
function handleTabIndent(e: React.KeyboardEvent<HTMLTextAreaElement>, onChange: (v: string) => void) {
  if (e.key !== "Tab") return
  e.preventDefault()
  const ta = e.currentTarget
  const start = ta.selectionStart
  const end = ta.selectionEnd
  onChange(`${ta.value.substring(0, start)}  ${ta.value.substring(end)}`)
  requestAnimationFrame(() => {
    ta.selectionStart = start + 2
    ta.selectionEnd = start + 2
  })
}

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

  const filename = getFileName(filePath)
  const lang = file?.language ?? ""
  const isMarkdown = lang === "markdown"
  const isCsv = lang === "csv" || lang === "tsv"
  const hasPreview = isMarkdown || isCsv
  const hasChanges = file !== null && editContent !== file.content

  // Sync editor content when file loads
  useEffect(() => {
    if (file) setEditContent(file.content)
  }, [file])

  // Reset transient state on file change
  useEffect(() => {
    setSaveError(null)
    setSearchOpen(false)
    setSearchQuery("")
  }, [filePath])

  // Auto-preview for previewable file types
  useEffect(() => {
    setPreviewing(hasPreview)
  }, [hasPreview, filePath])

  // --- Search ---

  const searchMatches = useMemo(() => {
    if (!searchQuery) return []
    const matches: number[] = []
    const lower = editContent.toLowerCase()
    const q = searchQuery.toLowerCase()
    let pos = 0
    while (pos < lower.length) {
      const idx = lower.indexOf(q, pos)
      if (idx === -1) break
      matches.push(idx)
      pos = idx + 1
    }
    return matches
  }, [editContent, searchQuery])

  useEffect(() => {
    setSearchIndex(0)
  }, [searchMatches.length, searchQuery])

  // Highlight current match in textarea
  useEffect(() => {
    if (searchMatches.length === 0 || !textareaRef.current || previewing) return
    const matchPos = searchMatches[searchIndex]
    if (matchPos === undefined) return
    const ta = textareaRef.current
    ta.focus()
    ta.setSelectionRange(matchPos, matchPos + searchQuery.length)
    const lineNumber = editContent.substring(0, matchPos).split("\n").length - 1
    const lineHeight = 21 // 13px font × 1.6 line-height
    ta.scrollTop = Math.max(0, lineNumber * lineHeight - ta.clientHeight / 2)
  }, [searchIndex, searchMatches, searchQuery, editContent, previewing])

  const handleSearchNav = useCallback(
    (dir: 1 | -1) => {
      if (searchMatches.length === 0) return
      setSearchIndex(prev => (prev + dir + searchMatches.length) % searchMatches.length)
    },
    [searchMatches.length],
  )

  const openSearch = useCallback(() => {
    if (previewing) setPreviewing(false)
    setSearchOpen(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [previewing])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery("")
    textareaRef.current?.focus()
  }, [])

  // --- Save / Copy ---

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

  const handleCopy = async () => {
    if (!editContent) return
    try {
      await navigator.clipboard.writeText(editContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  // --- Keyboard shortcuts ---

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

  // --- Content area ---

  function renderContent() {
    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMessage message={error} />

    if (previewing && isMarkdown) {
      return (
        <div className="flex-1 overflow-auto">
          <div className="p-5">
            <MarkdownDisplay content={file?.content ?? ""} className="text-[14px]" />
          </div>
        </div>
      )
    }

    if (previewing && isCsv) {
      return <CsvTable content={file?.content ?? ""} delimiter={lang === "tsv" ? "\t" : ","} />
    }

    // Markdown/CSV source editing — plain textarea
    if (hasPreview) {
      return (
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          onKeyDown={e => handleTabIndent(e, setEditContent)}
          spellCheck={false}
          className="flex-1 w-full resize-none bg-white dark:bg-[#0d0d0d] text-[13px] leading-[1.6] font-mono text-zinc-800 dark:text-zinc-200 p-4 outline-none border-none"
          style={{ tabSize: 2 }}
        />
      )
    }

    // Code files — always editable with syntax highlighting
    return <SyntaxEditor content={editContent} language={lang} onChange={setEditContent} textareaRef={textareaRef} />
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <PanelBar className="px-3 gap-1.5">
        <span className={getFileColor(filename)}>
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
          disabled={!editContent}
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
        <div className="h-9 px-3 flex items-center gap-2 border-b border-b-[3px] border-black/[0.06] dark:border-white/[0.04] bg-black/[0.015] dark:bg-white/[0.02] shrink-0">
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
      {renderContent()}
    </div>
  )
}

// --- Syntax-highlighted editor (overlay: transparent textarea over highlighted pre) ---

interface SyntaxEditorProps {
  content: string
  language: string
  onChange: (value: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

const SyntaxEditor = memo(function SyntaxEditor({ content, language, onChange, textareaRef }: SyntaxEditorProps) {
  const highlightRef = useRef<HTMLPreElement>(null)

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    const pre = highlightRef.current
    if (ta && pre) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
  }, [textareaRef])

  const lines = content.split("\n")

  return (
    <div className="relative flex-1 min-h-0">
      <pre
        ref={highlightRef}
        className="absolute inset-0 overflow-hidden bg-white dark:bg-[#0d0d0d] text-[13px] leading-[1.6] font-mono p-4 m-0"
        style={{ tabSize: 2 }}
        aria-hidden="true"
      >
        <code>
          {lines.map((line, i) => (
            <span key={i}>
              {tokenizeLine(line, language).map((token, j) => (
                <span key={j} className={TOKEN_COLORS[token.type]}>
                  {token.value}
                </span>
              ))}
              {i < lines.length - 1 ? "\n" : ""}
            </span>
          ))}
        </code>
      </pre>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => handleTabIndent(e, onChange)}
        onScroll={syncScroll}
        spellCheck={false}
        wrap="off"
        className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-zinc-700 dark:caret-zinc-300 text-[13px] leading-[1.6] font-mono p-4 m-0 outline-none border-none whitespace-pre selection:bg-sky-500/25"
        style={{ tabSize: 2, WebkitTextFillColor: "transparent" }}
      />
    </div>
  )
})

// --- CSV Table ---

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
          i++
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

const CsvTable = memo(function CsvTable({ content, delimiter }: { content: string; delimiter: string }) {
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

"use client"

import { Globe } from "lucide-react"
import { useEffect, useState } from "react"
import type { WorkbenchView } from "@/features/chat/lib/workbench-context"

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE TILE — muted with centered label, reveals on hover, title below
// ═══════════════════════════════════════════════════════════════════════════════

function SceneTile({
  label,
  sublabel,
  onClick,
  icon,
  children,
}: {
  label: string
  sublabel: string
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} className="group/tile cursor-pointer text-left w-full flex flex-col">
      <div className="relative flex-1">
        <div className="opacity-30 dark:opacity-20 group-hover/tile:opacity-100 transition-opacity duration-300 ease-out h-full">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-100 group-hover/tile:opacity-0 transition-opacity duration-300">
          <span className="text-[13px] font-medium text-black/50 dark:text-white/40">{label}</span>
        </div>
      </div>
      <div className="mt-2 px-1 shrink-0 flex items-center gap-1.5">
        {icon && (
          <span className="text-black/30 dark:text-white/20 group-hover/tile:text-black/50 dark:group-hover/tile:text-white/40 transition-colors duration-300">
            {icon}
          </span>
        )}
        <span className="text-[12px] font-medium text-black/40 dark:text-white/30 group-hover/tile:text-black/70 dark:group-hover/tile:text-white/60 transition-colors duration-300">
          {label}
        </span>
        <span className="text-[10px] text-black/0 dark:text-white/0 group-hover/tile:text-black/25 dark:group-hover/tile:text-white/20 transition-colors duration-500">
          {sublabel}
        </span>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAKE SCENES
// ═══════════════════════════════════════════════════════════════════════════════

function FakeBrowser() {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.06] h-full min-h-[160px]">
      <div className="h-7 bg-neutral-50 dark:bg-[#222] flex items-center px-3 gap-2 border-b border-black/[0.06] dark:border-white/[0.04]">
        <div className="flex gap-1.5">
          <div className="size-2 rounded-full bg-black/10 dark:bg-white/10" />
          <div className="size-2 rounded-full bg-black/10 dark:bg-white/10" />
          <div className="size-2 rounded-full bg-black/10 dark:bg-white/10" />
        </div>
        <div className="flex-1 h-4 bg-black/[0.04] dark:bg-white/[0.04] rounded-md flex items-center px-2">
          <span className="text-[10px] text-black/25 dark:text-white/20 font-mono">mysite.alive.best</span>
        </div>
      </div>
      <div className="p-4 overflow-hidden min-h-[200px]">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-8 rounded-lg bg-gradient-to-br from-[#FF3B30] to-[#FF6B6B] shrink-0" />
          <div>
            <div className="h-2.5 w-24 bg-black/70 dark:bg-white/60 rounded-sm mb-1.5" />
            <div className="h-1.5 w-36 bg-black/15 dark:bg-white/10 rounded-sm" />
          </div>
        </div>
        <div className="flex gap-3 mb-3">
          {["a", "b", "c", "d"].map(t => (
            <div key={t} className="h-1.5 w-8 bg-black/20 dark:bg-white/15 rounded-sm" />
          ))}
        </div>
        <div className="h-12 rounded-lg bg-gradient-to-r from-neutral-100 dark:from-white/[0.04] via-blue-50 dark:via-blue-500/[0.06] to-neutral-100 dark:to-white/[0.04] border border-black/[0.04] dark:border-white/[0.04] mb-3 flex items-center justify-center">
          <div className="h-2 w-28 bg-black/10 dark:bg-white/10 rounded-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-14 rounded-lg bg-neutral-100/80 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04] p-2.5"
            >
              <div className="h-1.5 w-10 bg-black/15 dark:bg-white/10 rounded-sm mb-1.5" />
              <div className="h-1 w-full bg-black/8 dark:bg-white/[0.06] rounded-sm mb-1" />
              <div className="h-1 w-3/4 bg-black/8 dark:bg-white/[0.06] rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FakeCodeEditor() {
  const codeLines = [
    {
      indent: 0,
      tokens: [
        { t: "export", c: "#c678dd" },
        { t: " ", c: "" },
        { t: "function", c: "#c678dd" },
        { t: " ", c: "" },
        { t: "App", c: "#61afef" },
        { t: "() {", c: "#abb2bf" },
      ],
    },
    {
      indent: 1,
      tokens: [
        { t: "const", c: "#c678dd" },
        { t: " [count] = ", c: "#abb2bf" },
        { t: "useState", c: "#61afef" },
        { t: "(", c: "#abb2bf" },
        { t: "0", c: "#d19a66" },
        { t: ")", c: "#abb2bf" },
      ],
    },
    { indent: 0, tokens: [] },
    {
      indent: 1,
      tokens: [
        { t: "return", c: "#c678dd" },
        { t: " (", c: "#abb2bf" },
      ],
    },
    {
      indent: 2,
      tokens: [
        { t: "<", c: "#abb2bf" },
        { t: "div", c: "#e06c75" },
        { t: ">", c: "#abb2bf" },
      ],
    },
    {
      indent: 3,
      tokens: [
        { t: "<", c: "#abb2bf" },
        { t: "h1", c: "#e06c75" },
        { t: ">", c: "#abb2bf" },
        { t: "{count}", c: "#abb2bf" },
        { t: "</", c: "#abb2bf" },
        { t: "h1", c: "#e06c75" },
        { t: ">", c: "#abb2bf" },
      ],
    },
    {
      indent: 2,
      tokens: [
        { t: "</", c: "#abb2bf" },
        { t: "div", c: "#e06c75" },
        { t: ">", c: "#abb2bf" },
      ],
    },
    { indent: 1, tokens: [{ t: ")", c: "#abb2bf" }] },
  ]

  return (
    <div className="bg-[#282c34] rounded-xl overflow-hidden border border-white/[0.06] h-full min-h-[160px]">
      <div className="h-6 bg-[#21252b] flex items-center px-2">
        <div className="flex items-center gap-1 h-full px-2 bg-[#282c34] rounded-t-md border-t border-x border-white/[0.06]">
          <div className="size-1.5 rounded-sm bg-[#61afef]" />
          <span className="text-[9px] text-white/40 font-mono">App.tsx</span>
        </div>
      </div>
      <div className="p-2.5 font-mono text-[9.5px] leading-[1.7] overflow-hidden flex">
        <div className="pr-2 select-none shrink-0 text-right" style={{ minWidth: "18px" }}>
          {codeLines.map((_, i) => (
            <div key={i} className="text-white/15">
              {i + 1}
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          {codeLines.map((line, i) => (
            <div key={i} style={{ paddingLeft: `${line.indent * 12}px` }}>
              {line.tokens.length === 0 ? (
                <br />
              ) : (
                line.tokens.map((token, j) => (
                  <span key={j} style={{ color: token.c || undefined }}>
                    {token.t}
                  </span>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FakeTerminal() {
  const lines = [
    { prompt: true, text: "bun run dev" },
    { prompt: false, text: "$ watching for changes..." },
    { prompt: false, text: "  ready in 240ms" },
    { prompt: false, text: "" },
    { prompt: true, text: "curl localhost:3000" },
    { prompt: false, text: '{"status":"ok"}' },
    { prompt: false, text: "" },
    { prompt: true, text: "" },
  ]
  const [visibleLines, setVisibleLines] = useState(0)

  useEffect(() => {
    if (visibleLines >= lines.length) return
    const timeout = setTimeout(
      () => {
        setVisibleLines(v => v + 1)
      },
      400 + Math.random() * 500,
    )
    return () => clearTimeout(timeout)
  }, [visibleLines, lines.length])

  return (
    <div className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/[0.06] h-full min-h-[160px]">
      <div className="h-6 bg-[#2a2a2a] flex items-center px-2.5 gap-1">
        <div className="size-2 rounded-full bg-[#ff5f57]" />
        <div className="size-2 rounded-full bg-[#febc2e]" />
        <div className="size-2 rounded-full bg-[#28c840]" />
      </div>
      <div className="p-2.5 font-mono text-[9.5px] leading-relaxed overflow-hidden">
        {lines.slice(0, visibleLines).map((line, i) => (
          <div key={i} className="flex gap-1.5">
            {line.prompt && <span className="text-[#30D158] shrink-0">$</span>}
            <span className={line.prompt ? "text-white/80" : "text-white/40"}>{line.text}</span>
            {i === visibleLines - 1 && line.prompt && line.text === "" && (
              <span className="w-1.5 h-3 bg-white/60 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function _FakeDrive() {
  const items = [
    { folder: true, name: "public", color: "#0066FF" },
    { folder: true, name: "src", color: "#0066FF" },
    { folder: false, name: "index.html", color: "#e06c75" },
    { folder: false, name: "package.json", color: "#98c379" },
    { folder: false, name: "styles.css", color: "#61afef" },
  ]

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/[0.06] h-full">
      <div className="h-6 bg-neutral-50 dark:bg-[#222] flex items-center px-2.5 border-b border-black/[0.06] dark:border-white/[0.04]">
        <span className="text-[9px] text-black/30 dark:text-white/25 font-medium">Files</span>
      </div>
      <div className="overflow-hidden">
        {items.map(item => (
          <div key={item.name} className="flex items-center gap-2 px-2.5 py-1">
            {item.folder ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill={item.color} opacity={0.7}>
                <path d="M1.5 2A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0014.5 5H7.71a1 1 0 01-.71-.29L5.59 3.29A1 1 0 004.88 3H1.5z" />
              </svg>
            ) : (
              <div className="w-3 h-3 flex items-center justify-center">
                <div
                  className="w-2 h-2.5 rounded-[1px] border border-black/15 dark:border-white/15"
                  style={{ borderLeftColor: item.color, borderLeftWidth: 2 }}
                />
              </div>
            )}
            <span className="text-[10px] text-black/60 dark:text-white/50 font-mono truncate">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKBENCH HOME — browser hero + 3 tools
// ═══════════════════════════════════════════════════════════════════════════════

export function WorkbenchHome({ onSelectView }: { onSelectView: (view: WorkbenchView) => void }) {
  return (
    <div className="h-full flex items-center justify-center p-5">
      <div className="w-full max-w-[280px] flex flex-col gap-2.5">
        <SceneTile
          label="Preview"
          sublabel="your site, live"
          onClick={() => onSelectView("site")}
          icon={<Globe size={11} strokeWidth={1.5} />}
        >
          <FakeBrowser />
        </SceneTile>
        <SceneTile label="Code" sublabel="read & edit" onClick={() => onSelectView("code")}>
          <FakeCodeEditor />
        </SceneTile>
        <SceneTile label="Terminal" sublabel="run commands" onClick={() => onSelectView("terminal")}>
          <FakeTerminal />
        </SceneTile>
      </div>
    </div>
  )
}

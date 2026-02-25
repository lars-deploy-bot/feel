"use client"

import { useEffect, useState } from "react"

// ═══════════════════════════════════════════════════════════════════════════════
// FAKE SCENES — each one IS the thing it opens
// ═══════════════════════════════════════════════════════════════════════════════

// ─── FAKE TERMINAL ──────────────────────────────────────────────────────────

function FakeTerminal() {
  const lines = [
    { prompt: true, text: "bun run dev" },
    { prompt: false, text: "$ watching for changes..." },
    { prompt: false, text: "  ready in 240ms" },
    { prompt: false, text: "" },
    { prompt: true, text: "curl localhost:3000/api/health" },
    { prompt: false, text: '{"status":"ok","uptime":42069}' },
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
      300 + Math.random() * 400,
    )
    return () => clearTimeout(timeout)
  }, [visibleLines, lines.length])

  return (
    <div className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/[0.06] h-full">
      <div className="h-7 bg-[#2a2a2a] flex items-center px-3 gap-1.5">
        <div className="size-2.5 rounded-full bg-[#ff5f57]" />
        <div className="size-2.5 rounded-full bg-[#febc2e]" />
        <div className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-white/20 font-mono">terminal</span>
      </div>
      <div className="p-3 font-mono text-[11px] leading-relaxed overflow-hidden">
        {lines.slice(0, visibleLines).map((line, i) => (
          <div key={i} className="flex gap-1.5">
            {line.prompt && <span className="text-[#30D158] shrink-0">$</span>}
            <span className={line.prompt ? "text-white/80" : "text-white/40"}>{line.text}</span>
            {i === visibleLines - 1 && line.prompt && line.text === "" && (
              <span className="w-2 h-3.5 bg-white/60 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── FAKE BROWSER ───────────────────────────────────────────────────────────

function FakeBrowser({ tall }: { tall?: boolean }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-black/[0.08] h-full">
      {/* URL bar */}
      <div className="h-8 bg-neutral-50 flex items-center px-3 gap-2 border-b border-black/[0.06]">
        <div className="flex gap-1.5">
          <div className="size-2 rounded-full bg-black/10" />
          <div className="size-2 rounded-full bg-black/10" />
          <div className="size-2 rounded-full bg-black/10" />
        </div>
        <div className="flex-1 h-4.5 bg-black/[0.04] rounded-md flex items-center px-2">
          <span className="text-[10px] text-black/25 font-mono">your-workspace</span>
        </div>
      </div>
      {/* Fake page */}
      <div className={`p-5 overflow-hidden ${tall ? "min-h-[240px]" : ""}`}>
        {/* Hero */}
        <div className="flex items-center gap-3 mb-5">
          <div className="size-10 rounded-lg bg-gradient-to-br from-[#FF3B30] to-[#FF6B6B] shrink-0" />
          <div>
            <div className="h-3 w-28 bg-black/70 rounded-sm mb-2" />
            <div className="h-2 w-40 bg-black/15 rounded-sm" />
          </div>
        </div>
        {/* Nav */}
        <div className="flex gap-4 mb-4">
          {["Home", "About", "Work", "Contact"].map(t => (
            <div key={t} className="h-1.5 w-10 bg-black/20 rounded-sm" />
          ))}
        </div>
        {/* Hero banner */}
        <div className="h-16 rounded-xl bg-gradient-to-r from-neutral-100 via-blue-50 to-neutral-100 border border-black/[0.04] mb-4 flex items-center justify-center">
          <div className="h-2.5 w-32 bg-black/10 rounded-sm" />
        </div>
        {/* Content grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-lg bg-gradient-to-b from-neutral-100 to-neutral-50 border border-black/[0.04]">
            <div className="p-3">
              <div className="h-2 w-12 bg-black/15 rounded-sm mb-2" />
              <div className="h-1.5 w-full bg-black/8 rounded-sm mb-1" />
              <div className="h-1.5 w-3/4 bg-black/8 rounded-sm" />
            </div>
          </div>
          <div className="h-20 rounded-lg bg-gradient-to-b from-blue-50 to-white border border-blue-100/50">
            <div className="p-3">
              <div className="h-2 w-10 bg-blue-200/60 rounded-sm mb-2" />
              <div className="h-1.5 w-full bg-blue-100/40 rounded-sm mb-1" />
              <div className="h-1.5 w-2/3 bg-blue-100/40 rounded-sm" />
            </div>
          </div>
          <div className="h-20 rounded-lg bg-gradient-to-b from-neutral-100 to-neutral-50 border border-black/[0.04]">
            <div className="p-3">
              <div className="h-2 w-14 bg-black/15 rounded-sm mb-2" />
              <div className="h-1.5 w-full bg-black/8 rounded-sm mb-1" />
              <div className="h-1.5 w-4/5 bg-black/8 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FAKE CODE EDITOR ───────────────────────────────────────────────────────

function FakeCodeEditor() {
  const codeLines = [
    {
      indent: 0,
      tokens: [
        { text: "export", color: "#c678dd" },
        { text: " ", color: "" },
        { text: "function", color: "#c678dd" },
        { text: " ", color: "" },
        { text: "App", color: "#61afef" },
        { text: "() {", color: "#abb2bf" },
      ],
    },
    {
      indent: 1,
      tokens: [
        { text: "const", color: "#c678dd" },
        { text: " [count, setCount] = ", color: "#abb2bf" },
        { text: "useState", color: "#61afef" },
        { text: "(", color: "#abb2bf" },
        { text: "0", color: "#d19a66" },
        { text: ")", color: "#abb2bf" },
      ],
    },
    { indent: 0, tokens: [] },
    {
      indent: 1,
      tokens: [
        { text: "return", color: "#c678dd" },
        { text: " (", color: "#abb2bf" },
      ],
    },
    {
      indent: 2,
      tokens: [
        { text: "<", color: "#abb2bf" },
        { text: "div", color: "#e06c75" },
        { text: " ", color: "" },
        { text: "className", color: "#d19a66" },
        { text: "=", color: "#abb2bf" },
        { text: '"app"', color: "#98c379" },
        { text: ">", color: "#abb2bf" },
      ],
    },
    {
      indent: 3,
      tokens: [
        { text: "<", color: "#abb2bf" },
        { text: "h1", color: "#e06c75" },
        { text: ">", color: "#abb2bf" },
        { text: "Count: {count}", color: "#abb2bf" },
        { text: "</", color: "#abb2bf" },
        { text: "h1", color: "#e06c75" },
        { text: ">", color: "#abb2bf" },
      ],
    },
    {
      indent: 3,
      tokens: [
        { text: "<", color: "#abb2bf" },
        { text: "button", color: "#e06c75" },
        { text: " ", color: "" },
        { text: "onClick", color: "#d19a66" },
        { text: "={() => ", color: "#abb2bf" },
        { text: "setCount", color: "#61afef" },
        { text: "(c => c + 1)}>", color: "#abb2bf" },
      ],
    },
    {
      indent: 2,
      tokens: [
        { text: "</", color: "#abb2bf" },
        { text: "div", color: "#e06c75" },
        { text: ">", color: "#abb2bf" },
      ],
    },
  ]

  return (
    <div className="bg-[#282c34] rounded-xl overflow-hidden border border-white/[0.06] h-full">
      <div className="h-7 bg-[#21252b] flex items-center px-2">
        <div className="flex items-center gap-1.5 h-full px-2.5 bg-[#282c34] rounded-t-md border-t border-x border-white/[0.06]">
          <div className="size-2 rounded-sm bg-[#61afef]" />
          <span className="text-[10px] text-white/40 font-mono">App.tsx</span>
        </div>
        <div className="flex items-center gap-1.5 h-full px-2.5 opacity-40">
          <div className="size-2 rounded-sm bg-[#98c379]" />
          <span className="text-[10px] text-white/30 font-mono">index.ts</span>
        </div>
      </div>
      <div className="p-3 font-mono text-[10.5px] leading-[1.7] overflow-hidden flex">
        <div className="pr-3 select-none shrink-0 text-right" style={{ minWidth: "24px" }}>
          {codeLines.map((_, i) => (
            <div key={i} className="text-white/15">
              {i + 1}
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          {codeLines.map((line, i) => (
            <div key={i} style={{ paddingLeft: `${line.indent * 16}px` }}>
              {line.tokens.length === 0 ? (
                <br />
              ) : (
                line.tokens.map((token, j) => (
                  <span key={j} style={{ color: token.color || undefined }}>
                    {token.text}
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

// ─── FAKE DRIVE ─────────────────────────────────────────────────────────────

type DriveItem =
  | { type: "folder"; name: string; color: string }
  | { type: "file"; name: string; ext: string; color: string }

function FakeDrive() {
  const items: DriveItem[] = [
    { type: "folder", name: "public", color: "#0066FF" },
    { type: "folder", name: "src", color: "#0066FF" },
    { type: "file", name: "index.html", ext: "html", color: "#e06c75" },
    { type: "file", name: "package.json", ext: "json", color: "#98c379" },
    { type: "file", name: "styles.css", ext: "css", color: "#61afef" },
    { type: "file", name: "vite.config.ts", ext: "ts", color: "#0066FF" },
  ]

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-black/[0.08] h-full">
      <div className="h-8 bg-neutral-50 flex items-center px-3 gap-2 border-b border-black/[0.06]">
        <span className="text-[10px] text-black/30 font-medium">Files</span>
        <div className="flex-1" />
        <div className="h-4 w-28 bg-black/[0.04] rounded-md flex items-center px-2">
          <span className="text-[9px] text-black/20">Search files...</span>
        </div>
      </div>
      <div className="overflow-hidden">
        {items.map(item => (
          <div
            key={item.name}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-black/[0.02] transition-colors duration-100"
          >
            {item.type === "folder" ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill={item.color} opacity={0.7}>
                <path d="M1.5 2A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0014.5 5H7.71a1 1 0 01-.71-.29L5.59 3.29A1 1 0 004.88 3H1.5z" />
              </svg>
            ) : (
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <div
                  className="w-2.5 h-3 rounded-[1px] border border-black/15"
                  style={{ borderLeftColor: item.color, borderLeftWidth: 2 }}
                />
              </div>
            )}
            <span className="text-[11px] text-black/70 font-mono truncate">{item.name}</span>
            {item.type === "file" && <span className="text-[9px] text-black/20 font-mono ml-auto">{item.ext}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE TILE — muted with centered label, reveals on hover, title below
// ═══════════════════════════════════════════════════════════════════════════════

function SceneTile({ label, sublabel, children }: { label: string; sublabel: string; children: React.ReactNode }) {
  return (
    <div className="group/tile cursor-pointer">
      <div className="relative">
        {/* Scene — starts muted, reveals on hover */}
        <div className="opacity-30 group-hover/tile:opacity-100 transition-opacity duration-300 ease-out">
          {children}
        </div>
        {/* Centered label — fades out on hover */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-100 group-hover/tile:opacity-0 transition-opacity duration-300">
          <span className="text-[13px] font-medium text-black/50">{label}</span>
        </div>
      </div>
      {/* Title below */}
      <div className="mt-2.5 px-1">
        <span className="text-[12px] font-medium text-black/50 group-hover/tile:text-black/70 transition-colors duration-300">
          {label}
        </span>
        <span className="text-[10px] text-black/0 group-hover/tile:text-black/25 transition-colors duration-500 ml-2">
          {sublabel}
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE LAYOUT — browser hero (full square) + 3 tools below
// ═══════════════════════════════════════════════════════════════════════════════

export default function ExperimentsPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-8">
      <div className="w-full max-w-[540px]">
        {/* BROWSER — hero, full square, dominates */}
        <SceneTile label="Preview" sublabel="your site, live">
          <FakeBrowser tall />
        </SceneTile>

        {/* 3 tools below — equal width */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <SceneTile label="Code" sublabel="read & edit">
            <FakeCodeEditor />
          </SceneTile>
          <SceneTile label="Terminal" sublabel="run commands">
            <FakeTerminal />
          </SceneTile>
          <SceneTile label="Drive" sublabel="manage files">
            <FakeDrive />
          </SceneTile>
        </div>
      </div>
    </div>
  )
}

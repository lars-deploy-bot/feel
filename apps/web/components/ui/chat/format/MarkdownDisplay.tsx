"use client"

import { TOKEN_COLORS, tokenizeLine } from "@/lib/utils/syntax"
import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

// Design tokens — full class strings so Tailwind can scan them
const t = {
  border: "border-black/[0.06] dark:border-white/[0.08]",
  surface: "bg-black/[0.025] dark:bg-white/[0.04]",
  cell: "px-3 py-2",
  heading: "font-semibold mb-2",
} as const

const BLOCK_TAGS = new Set(["pre", "div", "blockquote", "ul", "ol", "table"])

/** Extract language tag from hast node (e.g., "typescript" from class="language-typescript") */
function extractLanguage(node: unknown): string | null {
  const n = node as
    | { children?: Array<{ type?: string; tagName?: string; properties?: Record<string, unknown> }> }
    | undefined
  const el = n?.children?.[0]
  if (el?.type !== "element" || el.tagName !== "code") return null
  return /language-(\w+)/.exec((el.properties?.className as string[])?.join(" ") ?? "")?.[1] ?? null
}

/** Recursively extract raw text from a hast node tree */
function extractText(node: unknown): string {
  const n = node as { type?: string; value?: string; children?: unknown[] } | undefined
  if (!n) return ""
  if (n.type === "text") return n.value ?? ""
  if (Array.isArray(n.children)) return n.children.map(extractText).join("")
  return ""
}

/** Render code with syntax highlighting */
function renderHighlightedCode(code: string, language: string) {
  const lines = code.replace(/\n$/, "").split("\n")
  return lines.map((line, i) => (
    <span key={i}>
      {tokenizeLine(line, language).map((token, j) => (
        <span key={j} className={TOKEN_COLORS[token.type]}>
          {token.value}
        </span>
      ))}
      {i < lines.length - 1 ? "\n" : null}
    </span>
  ))
}

const components: Components = {
  // Code blocks — light fill, no border, shadow for depth
  pre: ({ node }) => {
    const lang = node ? extractLanguage(node) : null
    const rawText = node ? extractText(node) : ""

    return (
      <div className={cn("my-3 rounded-lg overflow-hidden", t.surface)}>
        <pre className="p-3 overflow-x-auto">
          {lang && <div className="text-[10px] font-mono text-black/20 dark:text-white/20 mb-2">{lang}</div>}
          <code className="text-[13px] font-mono leading-relaxed">{renderHighlightedCode(rawText, lang ?? "")}</code>
        </pre>
      </div>
    )
  },

  // Inline code
  code: ({ children, className }) => {
    if (className?.includes("language-")) return null
    return <code className={cn("px-1.5 py-0.5 rounded-lg text-[13px] font-mono", t.surface)}>{children}</code>
  },

  // Headings
  h1: ({ children }) => <h1 className={cn("text-2xl mt-4", t.heading)}>{children}</h1>,
  h2: ({ children }) => <h2 className={cn("text-xl mt-4", t.heading)}>{children}</h2>,
  h3: ({ children }) => <h3 className={cn("text-lg mt-4", t.heading)}>{children}</h3>,
  h4: ({ children }) => <h4 className={cn("text-base mt-3", t.heading)}>{children}</h4>,
  h5: ({ children }) => <h5 className={cn("text-sm mt-3", t.heading)}>{children}</h5>,
  h6: ({ children }) => <h6 className={cn("text-xs mt-3", t.heading)}>{children}</h6>,

  // Lists
  ul: ({ children }) => <ul className="list-disc pl-6 my-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 my-2">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,

  // Block elements
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-black/20 dark:border-white/20 pl-4 my-2 italic text-black/70 dark:text-white/70">
      {children}
    </blockquote>
  ),
  p: ({ children, node }) => {
    const hasBlock = node?.children?.some(
      (c: { type: string; tagName?: string }) => c.type === "element" && BLOCK_TAGS.has(c.tagName ?? ""),
    )
    return hasBlock ? <>{children}</> : <p className="mb-3">{children}</p>
  },
  hr: () => <hr className={cn("my-4", t.border)} />,

  // Inline elements
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className={cn("min-w-full border-collapse border", t.border)}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className={t.surface}>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className={cn("border-b", t.border)}>{children}</tr>,
  th: ({ children }) => <th className={cn(t.cell, "text-left text-xs font-semibold border", t.border)}>{children}</th>,
  td: ({ children }) => <td className={cn(t.cell, "text-sm border", t.border)}>{children}</td>,
}

// --- Export ---

interface MarkdownDisplayProps {
  content: string
  className?: string
}

export function MarkdownDisplay({ content, className }: MarkdownDisplayProps) {
  return (
    <div className={cn("text-black dark:text-white leading-relaxed", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

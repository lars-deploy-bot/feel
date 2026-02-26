"use client"

import { TOKEN_COLORS, tokenizeLine } from "@/lib/utils/syntax"

interface HighlightedCodeProps {
  code: string
  language?: string | null
}

export function HighlightedCode({ code, language }: HighlightedCodeProps) {
  const lines = code.replace(/\n$/, "").split("\n")
  const lang = language ?? ""

  return (
    <div className="my-3 rounded-lg overflow-hidden bg-black/[0.025] dark:bg-white/[0.04]">
      <pre className="p-3 overflow-x-auto">
        {lang && <div className="text-[10px] font-mono text-black/20 dark:text-white/20 mb-2">{lang}</div>}
        <code className="text-[13px] font-mono leading-relaxed">
          {lines.map((line, i) => (
            <span key={i}>
              {tokenizeLine(line, lang).map((token, j) => (
                <span key={j} className={TOKEN_COLORS[token.type]}>
                  {token.value}
                </span>
              ))}
              {i < lines.length - 1 ? "\n" : null}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

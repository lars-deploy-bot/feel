"use client"

import { ArrowLeft } from "lucide-react"
import { useEffect, useRef } from "react"

export function PromptSection({
  prompt,
  onChange,
  onBack,
}: {
  prompt: string
  onChange: (v: string) => void
  onBack: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [])

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 h-10 flex items-center gap-2 border-b border-zinc-100 dark:border-white/[0.04]">
        <button
          type="button"
          onClick={onBack}
          className="p-1 -ml-1 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <span className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100">Prompt</span>
        <span className="ml-auto text-[11px] text-zinc-400 dark:text-zinc-600 tabular-nums">
          {prompt.length.toLocaleString()}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={e => onChange(e.currentTarget.textContent ?? "")}
          className="px-4 py-4 text-[13px] text-zinc-900 dark:text-zinc-100 leading-relaxed outline-none min-h-full whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-300 dark:empty:before:text-zinc-700"
          data-placeholder="Describe what this agent should do..."
        >
          {prompt}
        </div>
      </div>
    </div>
  )
}

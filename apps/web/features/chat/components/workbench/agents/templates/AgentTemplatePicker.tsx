"use client"

import { Plus } from "lucide-react"
import type { AgentTemplate } from "./agent-templates"
import { AGENT_TEMPLATES } from "./agent-templates"

export function AgentTemplatePicker({
  onSelect,
  onBlank,
}: {
  onSelect: (template: AgentTemplate) => void
  onBlank: () => void
}) {
  return (
    <div className="max-w-2xl mx-auto w-full px-5 py-8 min-h-full flex flex-col justify-center">
      <div className="text-center mb-8">
        <h2 className="text-[20px] font-bold text-zinc-900 dark:text-zinc-100 mb-2">Your Agents</h2>
        <p className="text-[14px] text-zinc-400 dark:text-zinc-500">
          Pick a template to get started, or create your own.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-5">
        {AGENT_TEMPLATES.filter(t => t.enabled).map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className="group flex items-center gap-4 px-3 py-3 rounded-2xl text-left transition-all hover:bg-zinc-50 dark:hover:bg-white/[0.03] active:scale-[0.98]"
          >
            <img
              src={template.image}
              alt=""
              className="w-20 h-20 object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">{template.name}</p>
              <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">{template.description}</p>
            </div>
            <span className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
              Get started
            </span>
          </button>
        ))}
      </div>

      {/* Start from scratch */}
      <button
        type="button"
        onClick={onBlank}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/[0.03] hover:text-zinc-600 dark:hover:text-zinc-400 transition-all"
      >
        <Plus size={16} />
        <span className="text-[14px] font-bold">Start from scratch</span>
      </button>
    </div>
  )
}

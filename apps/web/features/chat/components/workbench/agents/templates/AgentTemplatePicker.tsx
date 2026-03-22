"use client"

import { BarChart3, Mail, Plus, Search, Shield, TrendingUp, Zap } from "lucide-react"
import type { AgentTemplate } from "./agent-templates"
import { AGENT_TEMPLATES } from "./agent-templates"

const ICONS: Record<AgentTemplate["icon"], typeof Search> = {
  search: Search,
  "trending-up": TrendingUp,
  mail: Mail,
  shield: Shield,
  "bar-chart": BarChart3,
  zap: Zap,
}

const COLORS: Record<AgentTemplate["color"], { card: string; icon: string }> = {
  blue: {
    card: "border-blue-100 dark:border-blue-500/10 hover:bg-blue-50 dark:hover:bg-blue-500/5",
    icon: "bg-blue-100 dark:bg-blue-500/15 text-blue-500",
  },
  emerald: {
    card: "border-emerald-100 dark:border-emerald-500/10 hover:bg-emerald-50 dark:hover:bg-emerald-500/5",
    icon: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-500",
  },
  violet: {
    card: "border-violet-100 dark:border-violet-500/10 hover:bg-violet-50 dark:hover:bg-violet-500/5",
    icon: "bg-violet-100 dark:bg-violet-500/15 text-violet-500",
  },
  amber: {
    card: "border-amber-100 dark:border-amber-500/10 hover:bg-amber-50 dark:hover:bg-amber-500/5",
    icon: "bg-amber-100 dark:bg-amber-500/15 text-amber-500",
  },
  rose: {
    card: "border-rose-100 dark:border-rose-500/10 hover:bg-rose-50 dark:hover:bg-rose-500/5",
    icon: "bg-rose-100 dark:bg-rose-500/15 text-rose-500",
  },
  cyan: {
    card: "border-cyan-100 dark:border-cyan-500/10 hover:bg-cyan-50 dark:hover:bg-cyan-500/5",
    icon: "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-500",
  },
}

export function AgentTemplatePicker({
  onSelect,
  onBlank,
}: {
  onSelect: (template: AgentTemplate) => void
  onBlank: () => void
}) {
  return (
    <div className="max-w-2xl mx-auto w-full px-5 py-8">
      <div className="text-center mb-8">
        <h2 className="text-[20px] font-bold text-zinc-900 dark:text-zinc-100 mb-2">Your Agents</h2>
        <p className="text-[14px] text-zinc-400 dark:text-zinc-500">Pick a template to get started</p>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-5">
        {AGENT_TEMPLATES.map(template => {
          const Icon = ICONS[template.icon]
          const colors = COLORS[template.color]
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className={`flex items-center gap-4 p-4 rounded-2xl border border-b-[3px] text-left active:translate-y-[2px] active:border-b transition-all ${colors.card}`}
            >
              <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">{template.name}</p>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">{template.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Start from scratch */}
      <button
        type="button"
        onClick={onBlank}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
      >
        <Plus size={16} />
        <span className="text-[14px] font-bold">Start from scratch</span>
      </button>
    </div>
  )
}

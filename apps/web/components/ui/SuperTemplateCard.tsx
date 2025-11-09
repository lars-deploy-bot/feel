"use client"

import type { Template } from "@/data/templates"

interface SuperTemplateCardProps {
  template: Template
  onClick: () => void
}

export function SuperTemplateCard({ template, onClick }: SuperTemplateCardProps) {
  const complexityDots = "●".repeat(template.complexity)
  const complexityLabel = template.complexity === 1 ? "Simple" : template.complexity === 2 ? "Medium" : "Complex"

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative bg-white dark:bg-[#2a2a2a] border border-black/10 dark:border-white/10
        hover:border-black/20 dark:hover:border-white/20
        transition-all duration-200 hover:shadow-lg
        text-left w-full overflow-hidden"
      style={{ borderRadius: "2px" }}
    >
      {/* Screenshot Preview */}
      <div className="relative aspect-[16/10] bg-black/5 dark:bg-white/5 overflow-hidden">
        <img
          src={template.previewImage}
          alt={`${template.name} preview`}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Hover Overlay */}
        <div
          className="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-white/10
          transition-colors duration-200 flex items-center justify-center"
        >
          <span
            className="text-sm font-[500] text-white opacity-0 group-hover:opacity-100
            transition-opacity duration-200 bg-black dark:bg-white dark:text-black px-4 py-2"
            style={{ borderRadius: "2px" }}
          >
            View Details
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        {/* Title */}
        <h3 className="text-base font-[500] text-black dark:text-white">{template.name}</h3>

        {/* Description */}
        <p className="text-sm font-[200] text-black/60 dark:text-white/60 line-clamp-2">{template.description}</p>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs font-[200] text-black/40 dark:text-white/40 pt-1">
          <span title={complexityLabel}>{complexityDots}</span>
          <span>•</span>
          <span>
            {template.fileCount} file{template.fileCount !== 1 ? "s" : ""}
          </span>
          <span>•</span>
          <span>{template.estimatedTime}</span>
          {/* Token estimate hidden - can re-enable with feature flag */}
          {/* <span>•</span>
          <span>~{template.estimatedTokens} tokens</span> */}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {template.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-xs font-[200] px-2 py-0.5 bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60"
              style={{ borderRadius: "2px" }}
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs font-[200] text-black/40 dark:text-white/40">+{template.tags.length - 3}</span>
          )}
        </div>
      </div>
    </button>
  )
}

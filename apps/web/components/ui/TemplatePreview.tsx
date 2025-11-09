"use client"

import { ArrowLeft } from "lucide-react"
import type { Template } from "@/data/templates"

interface TemplatePreviewProps {
  template: Template
  onBack: () => void
  onInsert: () => void
}

export function TemplatePreview({ template, onBack, onInsert }: TemplatePreviewProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Back button */}
      <div className="pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-[200] text-black/60 dark:text-white/60
            hover:text-black dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {/* Preview image */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto max-h-[60vh] flex items-center justify-center">
          <img
            src={template.previewImage}
            alt={`${template.name} preview`}
            className="max-w-full max-h-[60vh] w-auto h-auto object-contain"
            style={{ borderRadius: "2px" }}
          />
        </div>

        {/* Insert button - separate space */}
        <div className="mt-6 max-w-3xl mx-auto relative">
          <button
            type="button"
            onClick={onInsert}
            className="w-full px-5 py-2.5 bg-black text-white dark:bg-white dark:text-black
              hover:bg-black/80 dark:hover:bg-white/80 transition-all
              text-sm font-[500] relative z-10"
            style={{ borderRadius: "2px" }}
          >
            Insert Template
          </button>
          {/* Glowing animation */}
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-r from-transparent via-black/20 to-transparent dark:via-white/20 blur-xl animate-pulse"
            style={{ pointerEvents: "none" }}
          />
        </div>

        {/* Minimal info below */}
        <div className="mt-4 max-w-3xl mx-auto">
          <h2 className="text-xl font-[500] text-black dark:text-white">{template.name}</h2>
          <p className="text-sm font-[200] text-black/60 dark:text-white/60 mt-2 leading-relaxed">
            {template.description}
          </p>
        </div>
      </div>
    </div>
  )
}

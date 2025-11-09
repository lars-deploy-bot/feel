"use client"

import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { SuperTemplateCard } from "@/components/ui/SuperTemplateCard"
import { SuperTemplatePreview } from "@/components/ui/SuperTemplatePreview"
import { getTemplatesByCategory, type Template } from "@/data/templates"

interface SuperTemplatesModalProps {
  onClose: () => void
  onInsertTemplate: (prompt: string) => void
}

type Category = "sliders" | "maps" | "file-upload" | "blog"

const categoryLabels: Record<Category, string> = {
  sliders: "Photo Sliders",
  maps: "Maps",
  "file-upload": "File Upload",
  blog: "Blog",
}

export function SuperTemplatesModal({ onClose, onInsertTemplate }: SuperTemplatesModalProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("sliders")
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  const currentTemplates = getTemplatesByCategory(activeCategory)

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const handleCardClick = (template: Template) => {
    setSelectedTemplate(template)
  }

  const handleBack = () => {
    setSelectedTemplate(null)
  }

  const handleInsertClick = () => {
    if (selectedTemplate) {
      // Insert JSON that will be auto-detected and converted to supertemplate attachment
      const templateJson = JSON.stringify({
        type: "supertemplate",
        id: selectedTemplate.templateId,
        name: selectedTemplate.name,
        preview: selectedTemplate.previewImage,
      })
      onInsertTemplate(templateJson)
      onClose()
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        onKeyDown={e => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 pointer-events-none">
        <div
          className="bg-white dark:bg-[#1a1a1a] shadow-xl pointer-events-auto
            w-full h-full md:h-[calc(100vh-80px)] md:w-[calc(100vw-80px)]
            flex flex-col overflow-hidden
            animate-in fade-in-0 zoom-in-95 duration-300
            md:rounded-lg"
        >
          {/* Header - only show when browsing */}
          {!selectedTemplate && (
            <div className="flex items-center justify-between p-6 md:p-8 border-b border-black/10 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-[500] text-black dark:text-white tracking-wide">Browse Templates</h2>
                <p className="text-sm font-[200] text-black/60 dark:text-white/60 mt-1">
                  Select a template to quickly scaffold common patterns
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded"
                aria-label="Close"
              >
                <X size={20} className="text-black dark:text-white" />
              </button>
            </div>
          )}

          {/* Close button when viewing template (no header) */}
          {selectedTemplate && (
            <div className="absolute top-4 right-4 z-10">
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded bg-white dark:bg-[#1a1a1a] shadow-sm"
                aria-label="Close"
              >
                <X size={20} className="text-black dark:text-white" />
              </button>
            </div>
          )}

          {/* Tabs */}
          {!selectedTemplate && (
            <div className="px-6 md:px-8 pt-6 border-b border-black/10 dark:border-white/10">
              <div className="flex gap-1">
                {(Object.keys(categoryLabels) as Category[]).map(category => {
                  const count = getTemplatesByCategory(category).length
                  const isActive = activeCategory === category

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`px-4 py-2.5 text-sm font-[500] uppercase tracking-wide transition-colors
                        ${
                          isActive
                            ? "text-black dark:text-white border-b-2 border-black dark:border-white"
                            : "text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60"
                        }`}
                    >
                      {categoryLabels[category]}
                      <span className="ml-2 text-xs font-[200]">({count})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            {selectedTemplate ? (
              <SuperTemplatePreview template={selectedTemplate} onBack={handleBack} onInsert={handleInsertClick} />
            ) : currentTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-base font-[200] text-black/40 dark:text-white/40">
                  No templates in this category yet
                </p>
                <p className="text-sm font-[200] text-black/30 dark:text-white/30 mt-2">
                  More templates coming soon...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentTemplates.map(template => (
                  <SuperTemplateCard key={template.id} template={template} onClick={() => handleCardClick(template)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

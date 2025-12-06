"use client"

import { X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { SuperTemplateCard } from "@/components/ui/SuperTemplateCard"
import { SuperTemplatePreview } from "@/components/ui/SuperTemplatePreview"
import { TEMPLATE_CATEGORIES, type Template, type TemplateCategory } from "@/types/templates"

interface SuperTemplatesModalProps {
  onClose: () => void
  onInsertTemplate: (prompt: string) => void
}

export function SuperTemplatesModal({ onClose, onInsertTemplate }: SuperTemplatesModalProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("components")
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Fetch templates from API
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch("/api/templates/list")
        const data = await res.json()
        setTemplates(data.templates || [])
      } catch (error) {
        console.error("Failed to fetch templates:", error)
        setTemplates([])
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  const getTemplatesByCategory = useCallback(
    (category: TemplateCategory) => templates.filter(t => t.category === category),
    [templates],
  )

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
      <button
        type="button"
        className="fixed inset-0 bg-black/50 z-50 cursor-default"
        onClick={onClose}
        onKeyDown={e => e.key === "Escape" && onClose()}
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

          {/* Categories */}
          {!selectedTemplate && (
            <div className="border-b border-black/10 dark:border-white/10">
              {/* Mobile: Horizontal scroll with visual indicators */}
              <div className="md:hidden pt-6 pb-4 relative">
                {/* Gradient fade on right edge to indicate scrollability */}
                <div className="absolute right-0 top-6 bottom-4 w-12 bg-gradient-to-l from-white dark:from-[#1a1a1a] to-transparent pointer-events-none z-10" />

                <div className="overflow-x-auto scrollbar-hide px-6 -mx-6">
                  <div className="flex gap-3 px-6 pb-1">
                    {(Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).map(category => {
                      const count = getTemplatesByCategory(category).length
                      const isActive = activeCategory === category

                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setActiveCategory(category)}
                          className={`px-5 py-3.5 rounded-full whitespace-nowrap text-base font-[500] transition-all flex-shrink-0
                            ${
                              isActive
                                ? "bg-black dark:bg-white text-white dark:text-black shadow-md"
                                : "bg-black/[0.06] dark:bg-white/[0.06] text-black dark:text-white active:bg-black/10 dark:active:bg-white/10"
                            }`}
                        >
                          {TEMPLATE_CATEGORIES[category]}
                          <span className={`ml-2 text-sm font-[300] ${isActive ? "opacity-75" : "opacity-50"}`}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Desktop: Minimal tabs */}
              <div className="hidden md:flex gap-1 px-8 pt-6">
                {(Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).map(category => {
                  const count = getTemplatesByCategory(category).length
                  const isActive = activeCategory === category

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`px-4 py-2.5 text-sm font-[500] uppercase tracking-wide transition-all
                        ${
                          isActive
                            ? "text-black dark:text-white border-b-2 border-black dark:border-white"
                            : "text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60"
                        }`}
                    >
                      {TEMPLATE_CATEGORIES[category]}
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
            ) : loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-base font-[200] text-black/40 dark:text-white/40">Loading templates...</p>
              </div>
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

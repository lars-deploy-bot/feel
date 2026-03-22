import { isAliveWorkspace } from "@webalive/shared/constants"
import { type ClaudeModel, isValidClaudeModel } from "@webalive/shared/models"
import { inputClass, selectChevron } from "@/components/automations/form-styles"
import { SiteCombobox } from "@/components/automations/SiteCombobox"
import { MODEL_OPTIONS } from "@/lib/automation/form-options"
import type { Site } from "@/lib/hooks/useSettingsQueries"

interface GeneralTabProps {
  title: string
  onTitleChange: (v: string) => void
  siteId: string
  siteSearch: string
  onSiteSelect: (id: string, hostname: string) => void
  onSiteSearchChange: (v: string) => void
  sites: Site[]
  model: ClaudeModel | ""
  onModelChange: (v: ClaudeModel | "") => void
  timeoutSeconds: string
  onTimeoutChange: (v: string) => void
}

export function GeneralTab({
  title,
  onTitleChange,
  siteId,
  siteSearch,
  onSiteSelect,
  onSiteSearchChange,
  sites,
  model,
  onModelChange,
  timeoutSeconds,
  onTimeoutChange,
}: GeneralTabProps) {
  return (
    <div className="space-y-3">
      {/* Title */}
      <Field label="Title" htmlFor="auto-title">
        <input
          id="auto-title"
          type="text"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Summary of AI news"
          autoComplete="off"
          className={inputClass}
        />
      </Field>

      {/* Website */}
      <Field label="Website" htmlFor="auto-site">
        <SiteCombobox
          id="auto-site"
          sites={sites}
          selectedId={siteId}
          searchValue={siteSearch}
          onSelect={onSiteSelect}
          onSearchChange={onSiteSearchChange}
          renderLabel={site => (isAliveWorkspace(site.hostname) ? "Alive Platform (superadmin)" : site.hostname)}
          className={inputClass}
          dropdownClassName="absolute z-20 top-full left-0 right-0 mt-1.5 max-h-48 overflow-auto rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.04] animate-in fade-in slide-in-from-bottom-2 duration-150"
          itemClassName="w-full px-4 py-2.5 text-left text-sm rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.07] dark:active:bg-white/[0.09] transition-colors"
        />
      </Field>

      {/* Model & Timeout */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Model" htmlFor="auto-model" muted>
          <select
            id="auto-model"
            value={model}
            onChange={e => {
              const v = e.target.value
              onModelChange(isValidClaudeModel(v) ? v : "")
            }}
            className={`${inputClass} cursor-pointer appearance-none`}
            style={selectChevron}
          >
            <option value="">Default</option>
            {MODEL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Timeout (s)" htmlFor="auto-timeout" muted>
          <input
            id="auto-timeout"
            type="number"
            min={10}
            max={3600}
            value={timeoutSeconds}
            onChange={e => onTimeoutChange(e.target.value)}
            placeholder="300"
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  muted,
  children,
}: {
  label: string
  htmlFor: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className={`text-xs font-medium ${muted ? "text-black/60 dark:text-white/60" : "text-black dark:text-white"}`}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

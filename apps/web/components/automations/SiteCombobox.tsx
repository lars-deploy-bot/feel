"use client"

import { useState } from "react"

// Minimal type: anything with id + hostname works
export interface SiteOption {
  id: string
  hostname: string
}

interface SiteComboboxProps {
  sites: SiteOption[]
  selectedId: string
  searchValue: string
  onSelect: (id: string, hostname: string) => void
  onSearchChange: (value: string) => void
  /** Override how a site hostname is displayed in the dropdown */
  renderLabel?: (site: SiteOption) => string
  id?: string
  placeholder?: string
  className?: string
  dropdownClassName?: string
  itemClassName?: string
}

/**
 * Resolve which site should be selected when a form first mounts.
 *
 * Rules (in priority order):
 * 1. If `defaultSiteId` matches a site, use it.
 * 2. If there is exactly one site, auto-select it.
 * 3. Otherwise, no selection.
 */
export function getInitialSiteSelection(
  sites: SiteOption[],
  defaultSiteId?: string,
): { siteId: string; siteSearch: string } {
  if (defaultSiteId) {
    const match = sites.find(s => s.id === defaultSiteId)
    if (match) return { siteId: match.id, siteSearch: match.hostname }
  }

  if (sites.length === 1) {
    const only = sites[0]
    return { siteId: only?.id ?? "", siteSearch: only?.hostname ?? "" }
  }

  return { siteId: "", siteSearch: "" }
}

const DEFAULT_INPUT_CLASS =
  "w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none hover:border-zinc-300 dark:hover:border-zinc-600"

const DEFAULT_DROPDOWN_CLASS =
  "absolute z-20 top-full left-0 right-0 mt-1.5 max-h-48 overflow-auto rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg"

const DEFAULT_ITEM_CLASS =
  "w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"

/**
 * Searchable site combobox used by both the chat automation config
 * and the settings side-panel general tab.
 */
export function SiteCombobox({
  sites,
  selectedId,
  searchValue,
  onSelect,
  onSearchChange,
  renderLabel,
  id,
  placeholder = "Select website...",
  className,
  dropdownClassName,
  itemClassName,
}: SiteComboboxProps) {
  const [open, setOpen] = useState(false)
  const filtered = sites.filter(s => s.hostname.toLowerCase().includes(searchValue.toLowerCase()))
  const label = renderLabel ?? ((s: SiteOption) => s.hostname)

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        value={searchValue}
        onChange={e => {
          onSearchChange(e.target.value)
          setOpen(true)
          if (!e.target.value) onSelect("", "")
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className={className ?? DEFAULT_INPUT_CLASS}
      />
      {open && filtered.length > 0 && (
        <div
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className={dropdownClassName ?? DEFAULT_DROPDOWN_CLASS}
        >
          {filtered.slice(0, 8).map(site => (
            <button
              key={site.id}
              type="button"
              role="option"
              aria-selected={selectedId === site.id}
              onMouseDown={e => {
                e.preventDefault()
                onSelect(site.id, site.hostname)
                setOpen(false)
              }}
              className={`${itemClassName ?? DEFAULT_ITEM_CLASS} ${selectedId === site.id ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              {label(site)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

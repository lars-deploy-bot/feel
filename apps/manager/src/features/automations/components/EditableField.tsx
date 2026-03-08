import { useEffect, useRef, useState } from "react"

interface EditableFieldProps {
  label: string
  value: string | null | undefined
  onSave: (value: string) => Promise<void>
  placeholder?: string
  multiline?: boolean
}

export function EditableField({ label, value, onSave, placeholder, multiline }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEditing() {
    setDraft(value ?? "")
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (draft.trim() === (value ?? "").trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      save()
    }
    if (e.key === "Escape") {
      cancel()
    }
  }

  if (!editing) {
    return (
      <div className="flex gap-4 py-1.5 group">
        <span className="text-[12px] text-text-tertiary w-20 flex-shrink-0">{label}</span>
        <button
          type="button"
          onClick={startEditing}
          className="text-[12px] text-text-primary min-w-0 text-left hover:text-accent transition-colors duration-100 cursor-pointer"
        >
          {value || <span className="text-text-tertiary">{placeholder ?? "Click to edit"}</span>}
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4 py-1.5">
      <span className="text-[12px] text-text-tertiary w-20 flex-shrink-0 pt-1.5">{label}</span>
      <div className="flex-1 min-w-0">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className="w-full text-[12px] text-text-primary border border-border rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary/30 outline-none transition-all duration-100 resize-none"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            disabled={saving}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            className="w-full text-[12px] text-text-primary border border-border rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary/30 outline-none transition-all duration-100"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            placeholder={placeholder}
          />
        )}
        {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
        <div className="flex gap-2 mt-1.5">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-[11px] text-text-secondary hover:text-text-primary transition-colors duration-100 cursor-pointer disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors duration-100 cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

import { ALL_CLAUDE_MODELS, type ClaudeModel, getModelDisplayName } from "@webalive/shared/models"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { usersApi } from "../users.api"
import { SectionHeader } from "./UserDetail"

interface ModelAccessProps {
  userId: string
  enabledModels: ClaudeModel[]
  onSaved: () => void
}

export function ModelAccess({ userId, enabledModels, onSaved }: ModelAccessProps) {
  const [selected, setSelected] = useState<Set<ClaudeModel>>(new Set(enabledModels))
  const [saving, setSaving] = useState(false)

  const dirty = selected.size !== enabledModels.length || enabledModels.some(m => !selected.has(m))

  function toggle(model: ClaudeModel) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(model)) {
        next.delete(model)
      } else {
        next.add(model)
      }
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      await usersApi.updateModels(userId, [...selected])
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <SectionHeader label="Model Access" />
      <div className="space-y-1.5">
        {ALL_CLAUDE_MODELS.map(model => (
          <label key={model} className="flex items-center gap-2 py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(model)}
              onChange={() => toggle(model)}
              className="accent-text-primary"
            />
            <span className="text-[12px] text-text-primary">{getModelDisplayName(model)}</span>
          </label>
        ))}
      </div>
      <p className="text-[11px] text-text-tertiary mt-1.5">When no models are selected, the user gets Sonnet only.</p>
      {dirty && (
        <Button variant="primary" size="sm" loading={saving} onClick={save} className="mt-2">
          Save
        </Button>
      )}
    </div>
  )
}

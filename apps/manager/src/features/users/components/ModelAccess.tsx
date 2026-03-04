import { ALL_CLAUDE_MODELS, type ClaudeModel, DEFAULT_CLAUDE_MODEL, getModelDisplayName } from "@webalive/shared/models"
import { useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/Button"
import { usersApi } from "../users.api"
import { SectionHeader } from "./UserDetail"

interface ModelAccessProps {
  userId: string
  enabledModels: ClaudeModel[]
  onSaved: () => void
}

/** When nothing is stored, Sonnet is the effective default — show that in the UI */
function effectiveModels(stored: ClaudeModel[]): ClaudeModel[] {
  return stored.length === 0 ? [DEFAULT_CLAUDE_MODEL] : stored
}

export function ModelAccess({ userId, enabledModels, onSaved }: ModelAccessProps) {
  const effective = effectiveModels(enabledModels)
  const [selected, setSelected] = useState<Set<ClaudeModel>>(new Set(effective))
  const [saving, setSaving] = useState(false)

  const dirty = selected.size !== effective.length || effective.some(m => !selected.has(m))

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
      toast.success("Model access saved")
      onSaved()
    } catch {
      toast.error("Failed to save model access")
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
            <span className="text-[12px] text-text-primary">
              {getModelDisplayName(model)}
              {model === DEFAULT_CLAUDE_MODEL && selected.size === 1 && selected.has(model) && (
                <span className="text-text-tertiary ml-1">(default)</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {dirty && (
        <Button variant="primary" size="sm" loading={saving} onClick={save} className="mt-2">
          Save
        </Button>
      )}
    </div>
  )
}

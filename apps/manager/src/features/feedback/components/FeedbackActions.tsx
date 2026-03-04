import { useState } from "react"
import { Button } from "@/components/ui/Button"
import type { FeedbackItem } from "../feedback.types"
import { useUpdateFeedback } from "../hooks/useFeedback"

interface FeedbackActionsProps {
  item: FeedbackItem
}

type FeedbackFieldKey = "github_issue_url" | "aware_email_sent" | "fixed_email_sent"

interface FeedbackField {
  key: FeedbackFieldKey
  label: string
  placeholder: string
  type: "input" | "textarea"
}

const FIELDS: FeedbackField[] = [
  {
    key: "github_issue_url",
    label: "GitHub Issue",
    placeholder: "https://github.com/eenlars/alive/issues/...",
    type: "input",
  },
  {
    key: "aware_email_sent",
    label: "Aware email",
    placeholder: "Paste the email text sent to user...",
    type: "textarea",
  },
  {
    key: "fixed_email_sent",
    label: "Fixed email",
    placeholder: "Paste the email text sent to user...",
    type: "textarea",
  },
]

export function FeedbackActions({ item }: FeedbackActionsProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState("")
  const { mutate, isPending } = useUpdateFeedback()

  function startEdit(key: string, currentValue: string) {
    setEditing(key)
    setValue(currentValue)
  }

  function save() {
    if (!editing) return
    mutate(
      { feedbackId: item.feedback_id, updates: { [editing]: value || null } },
      { onSuccess: () => setEditing(null) },
    )
  }

  return (
    <div className="space-y-2">
      {FIELDS.map(field => {
        const fieldValue = item[field.key]

        return (
          <div key={field.key} className="flex items-start gap-2">
            <span className="text-[11px] text-text-tertiary w-20 shrink-0 pt-1">{field.label}</span>

            {editing === field.key ? (
              <div className="flex-1 flex gap-1.5">
                {field.type === "input" ? (
                  <input
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={field.placeholder}
                    className="flex-1 text-[12px] px-2 py-1 rounded-input border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-text-primary/10"
                  />
                ) : (
                  <textarea
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="flex-1 text-[12px] px-2 py-1 rounded-input border border-border bg-surface text-text-primary placeholder:text-text-tertiary resize-y focus:outline-none focus:ring-1 focus:ring-text-primary/10"
                  />
                )}
                <div className="flex flex-col gap-1 self-start">
                  <Button size="sm" variant="primary" onClick={save} loading={isPending}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : fieldValue ? (
              <div className="flex-1 flex items-start gap-1.5">
                {field.key === "github_issue_url" ? (
                  <a
                    href={fieldValue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-blue-600 hover:underline break-all"
                  >
                    {fieldValue}
                  </a>
                ) : (
                  <span className="text-[12px] text-emerald-600 whitespace-pre-wrap break-words">{fieldValue}</span>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(field.key, fieldValue)}
                  className="text-[11px] text-text-tertiary hover:text-text-secondary shrink-0 cursor-pointer"
                >
                  edit
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startEdit(field.key, "")}
                className="text-[11px] text-text-tertiary hover:text-text-secondary cursor-pointer"
              >
                + add
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

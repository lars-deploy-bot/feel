import { feedbackRepo } from "../../../db/repos"
import type { ManagerFeedback } from "./feedback.types"

export async function listFeedback(): Promise<ManagerFeedback[]> {
  const rows = await feedbackRepo.findAll()
  return rows.map(f => {
    const ctx = f.context && typeof f.context === "object" && !Array.isArray(f.context) ? f.context : null
    return {
      feedback_id: f.feedback_id,
      content: f.content,
      status: f.status,
      user_id: f.user_id,
      github_issue_url: f.github_issue_url,
      aware_email_sent: f.aware_email_sent,
      fixed_email_sent: f.fixed_email_sent,
      closed_at: f.closed_at,
      workspace: ctx && typeof ctx.workspace === "string" ? ctx.workspace : null,
      email: ctx && typeof ctx.email === "string" ? ctx.email : null,
      created_at: f.created_at,
    }
  })
}

export async function updateFeedback(
  feedbackId: string,
  updates: {
    github_issue_url?: string | null
    aware_email_sent?: string | null
    fixed_email_sent?: string | null
    status?: string | null
    closed_at?: string | null
  },
): Promise<void> {
  await feedbackRepo.update(feedbackId, updates)
}

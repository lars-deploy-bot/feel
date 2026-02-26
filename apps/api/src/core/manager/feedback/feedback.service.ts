import { feedbackRepo } from "../../../db/repos"
import type { ManagerFeedback } from "./feedback.types"

export async function listFeedback(): Promise<ManagerFeedback[]> {
  const rows = await feedbackRepo.findAll()
  return rows.map(f => ({
    feedback_id: f.feedback_id,
    content: f.content,
    status: f.status,
    user_id: f.user_id,
    github_issue_url: f.github_issue_url,
    created_at: f.created_at,
  }))
}

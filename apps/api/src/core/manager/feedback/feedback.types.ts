export interface ManagerFeedback {
  feedback_id: string
  content: string
  status: string | null
  user_id: string | null
  github_issue_url: string | null
  created_at: string | null
}

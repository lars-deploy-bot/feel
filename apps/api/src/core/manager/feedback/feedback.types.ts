export interface ManagerFeedback {
  feedback_id: string
  content: string
  status: string | null
  user_id: string | null
  github_issue_url: string | null
  aware_email_sent: string | null
  fixed_email_sent: string | null
  closed_at: string | null
  workspace: string | null
  email: string | null
  created_at: string | null
}

import { app } from "../clients"
import { InternalError } from "../../infra/errors"

export type FeedbackRow = {
  feedback_id: string
  content: string
  status: string | null
  user_id: string | null
  github_issue_url: string | null
  created_at: string | null
}

export async function findAll(): Promise<FeedbackRow[]> {
  const { data, error } = await app
    .from("feedback")
    .select("feedback_id, content, status, user_id, github_issue_url, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch feedback: ${error.message}`)
  }
  return data ?? []
}

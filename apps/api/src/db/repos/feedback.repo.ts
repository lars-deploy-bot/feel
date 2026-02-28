import { InternalError } from "../../infra/errors"
import { app } from "../clients"

/** Matches Supabase's Json type for jsonb columns */
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type FeedbackRow = {
  feedback_id: string
  content: string
  status: string | null
  user_id: string | null
  github_issue_url: string | null
  aware_email_sent: string | null
  fixed_email_sent: string | null
  closed_at: string | null
  context: Json
  created_at: string | null
}

export async function findAll(): Promise<FeedbackRow[]> {
  const { data, error } = await app
    .from("feedback")
    .select(
      "feedback_id, content, status, user_id, github_issue_url, aware_email_sent, fixed_email_sent, closed_at, context, created_at",
    )
    .order("created_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch feedback: ${error.message}`)
  }
  return data ?? []
}

export async function update(
  feedbackId: string,
  updates: {
    github_issue_url?: string | null
    aware_email_sent?: string | null
    fixed_email_sent?: string | null
    status?: string | null
    closed_at?: string | null
  },
): Promise<void> {
  const { error } = await app.from("feedback").update(updates).eq("feedback_id", feedbackId)

  if (error) {
    throw new InternalError(`Failed to update feedback: ${error.message}`)
  }
}

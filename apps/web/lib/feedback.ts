import type { AppFeedbackInsert } from "@/lib/supabase/app"
import { createAppClient } from "@/lib/supabase/app"

export interface FeedbackEntry {
  id: string
  feedback: string
  email?: string
  workspace: string
  conversationId?: string
  userAgent?: string
  timestamp: string
  status?: string
}

interface FeedbackContext {
  workspace?: string
  conversationId?: string
  userAgent?: string
  email?: string
}
export async function addFeedbackEntry(entry: Omit<FeedbackEntry, "id" | "timestamp">): Promise<FeedbackEntry> {
  const app = await createAppClient("service")

  const feedbackInsert: AppFeedbackInsert = {
    content: entry.feedback,
    clerk_id: null, // Not using Clerk, set to null
    context: {
      workspace: entry.workspace,
      conversationId: entry.conversationId,
      userAgent: entry.userAgent,
      email: entry.email,
    },
    status: "pending",
  }

  const { data, error } = await app.from("feedback").insert(feedbackInsert).select().single()

  if (error || !data) {
    console.error("[Supabase Feedback] Failed to insert feedback:", error)
    throw new Error("Failed to save feedback")
  }

  return {
    id: data.feedback_id,
    feedback: data.content,
    email: entry.email,
    workspace: entry.workspace,
    conversationId: entry.conversationId,
    userAgent: entry.userAgent,
    timestamp: data.created_at || new Date().toISOString(),
    status: data.status || "pending",
  }
}

/**
 * Get all feedback entries from Supabase
 * @returns Array of feedback entries
 */
export async function getAllFeedback(): Promise<FeedbackEntry[]> {
  const app = await createAppClient("service")

  const { data, error } = await app.from("feedback").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("[Supabase Feedback] Failed to fetch feedback:", error)
    return []
  }

  return (
    data?.map(item => {
      const context = item.context as FeedbackContext | null
      return {
        id: item.feedback_id,
        feedback: item.content,
        email: context?.email,
        workspace: context?.workspace || "unknown",
        conversationId: context?.conversationId,
        userAgent: context?.userAgent,
        timestamp: item.created_at || new Date().toISOString(),
        status: item.status || "pending",
      }
    }) || []
  )
}

/**
 * Get feedback entries for a specific workspace
 * @param workspace - Workspace to filter by
 * @returns Array of feedback entries
 */
export async function getFeedbackByWorkspace(workspace: string): Promise<FeedbackEntry[]> {
  const allFeedback = await getAllFeedback()
  return allFeedback.filter(entry => entry.workspace === workspace)
}

/**
 * Update feedback status in Supabase
 * @param feedbackId - Feedback ID to update
 * @param status - New status
 * @returns true if successful
 */
export async function updateFeedbackStatus(feedbackId: string, status: string): Promise<boolean> {
  const app = await createAppClient("service")

  const { error } = await app.from("feedback").update({ status }).eq("feedback_id", feedbackId)

  if (error) {
    console.error("[Supabase Feedback] Failed to update status:", error)
    return false
  }

  return true
}

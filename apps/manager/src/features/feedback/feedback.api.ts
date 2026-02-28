import { api } from "@/lib/api"
import type { FeedbackItem } from "./feedback.types"

interface FeedbackListResponse {
  data: FeedbackItem[]
}

export const feedbackApi = {
  list: () => api.get<FeedbackListResponse>("/manager/feedback").then(r => r.data),
  update: (
    feedbackId: string,
    updates: {
      github_issue_url?: string | null
      aware_email_sent?: string | null
      fixed_email_sent?: string | null
      status?: string | null
      closed_at?: string | null
    },
  ) => api.patch(`/manager/feedback/${feedbackId}`, updates),
}

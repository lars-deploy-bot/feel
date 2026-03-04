import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { feedbackApi } from "../feedback.api"
import type { FeedbackItem } from "../feedback.types"

const FEEDBACK_KEY: readonly ["feedback"] = ["feedback"]

export function useFeedback() {
  const {
    data: feedback = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: FEEDBACK_KEY,
    queryFn: feedbackApi.list,
    staleTime: 30_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch feedback") : null

  return {
    feedback,
    loading,
    error,
    refresh: () => refetch(),
  }
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      feedbackId,
      updates,
    }: {
      feedbackId: string
      updates: {
        github_issue_url?: string | null
        aware_email_sent?: string | null
        fixed_email_sent?: string | null
        status?: string | null
        closed_at?: string | null
      }
    }) => feedbackApi.update(feedbackId, updates),
    onMutate: async ({ feedbackId, updates }) => {
      await queryClient.cancelQueries({ queryKey: FEEDBACK_KEY })
      const previous = queryClient.getQueryData<FeedbackItem[]>(FEEDBACK_KEY)

      queryClient.setQueryData<FeedbackItem[]>(FEEDBACK_KEY, old =>
        old?.map(item => (item.feedback_id === feedbackId ? { ...item, ...updates } : item)),
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(FEEDBACK_KEY, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FEEDBACK_KEY })
    },
  })
}

import { z } from "zod"

export const SeedAutomationTranscriptRequestSchema = z.object({
  jobId: z.string().min(1),
  initialMessage: z.string().min(1).max(2_000).optional(),
})

export const SeedAutomationTranscriptResponseSchema = z.object({
  ok: z.literal(true),
  seed: z.object({
    jobId: z.string().min(1),
    runId: z.string().uuid(),
    conversationId: z.string().uuid(),
    tabId: z.string().uuid(),
    title: z.string().min(1),
    initialMessage: z.string().min(1),
  }),
})

export const CleanupAutomationTranscriptRequestSchema = z.object({
  jobId: z.string().min(1),
  runId: z.string().uuid(),
  conversationId: z.string().uuid(),
  tabId: z.string().uuid(),
})

export const CleanupAutomationTranscriptResponseSchema = z.object({
  ok: z.literal(true),
})

export type SeedAutomationTranscriptRequest = z.infer<typeof SeedAutomationTranscriptRequestSchema>
export type SeedAutomationTranscriptResponse = z.infer<typeof SeedAutomationTranscriptResponseSchema>
export type CleanupAutomationTranscriptRequest = z.infer<typeof CleanupAutomationTranscriptRequestSchema>
export type CleanupAutomationTranscriptResponse = z.infer<typeof CleanupAutomationTranscriptResponseSchema>

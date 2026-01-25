/**
 * Tool Component Registrations
 *
 * Register React components for custom tool rendering.
 * Display config (autoExpand, preview) is in @alive-brug/tools.
 *
 * Import this file once at app initialization.
 */

import { registerComponent, LINEAR, EMAIL, AI } from "./tool-registry"

// === AI Components ===
import {
  ClarificationQuestionsOutput,
  validateClarificationQuestions,
} from "@/components/ui/chat/tools/ai/ClarificationQuestionsOutput"

// === Linear Components ===
import { LinearIssueResult, validateLinearIssue } from "@/components/linear/LinearIssueResult"
import { LinearIssuesResult, validateLinearIssues } from "@/components/linear/LinearIssuesResult"
import {
  LinearCommentResult,
  LinearCommentsResult,
  validateLinearComment,
  validateLinearComments,
} from "@/components/linear/LinearCommentResult"

// === Email Components (superadmin only) ===
import { EmailDraftOutput, validateEmailDraft } from "@/components/ui/chat/tools/email/EmailDraftOutput"

// ============================================================
// LINEAR COMPONENTS
// ============================================================

registerComponent(LINEAR.CREATE_ISSUE, LinearIssueResult, validateLinearIssue)
registerComponent(LINEAR.UPDATE_ISSUE, LinearIssueResult, validateLinearIssue)
registerComponent(LINEAR.GET_ISSUE, LinearIssueResult, validateLinearIssue)
registerComponent(LINEAR.LIST_ISSUES, LinearIssuesResult, validateLinearIssues)
registerComponent(LINEAR.CREATE_COMMENT, LinearCommentResult, validateLinearComment)
registerComponent(LINEAR.LIST_COMMENTS, LinearCommentsResult, validateLinearComments)

// Note: LIST_PROJECTS and LIST_TEAMS use default JSON rendering (no custom component)

// ============================================================
// EMAIL COMPONENTS (superadmin feature flag)
// ============================================================

registerComponent(EMAIL.COMPOSE, EmailDraftOutput, validateEmailDraft)
registerComponent(EMAIL.CREATE_DRAFT, EmailDraftOutput, validateEmailDraft)
registerComponent(EMAIL.REPLY, EmailDraftOutput, validateEmailDraft)

// ============================================================
// AI COMPONENTS (clarification questions)
// ============================================================

registerComponent(AI.ASK_CLARIFICATION, ClarificationQuestionsOutput, validateClarificationQuestions)

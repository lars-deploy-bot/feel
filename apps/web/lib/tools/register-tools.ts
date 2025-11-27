/**
 * Tool Component Registrations
 *
 * Register React components for custom tool rendering.
 * Display config (autoExpand, preview) is in @alive-brug/tools.
 *
 * Import this file once at app initialization.
 */

import { registerComponent, LINEAR } from "./tool-registry"

// === Linear Components ===
import { LinearIssueResult, validateLinearIssue } from "@/components/linear/LinearIssueResult"
import { LinearIssuesResult, validateLinearIssues } from "@/components/linear/LinearIssuesResult"
import {
  LinearCommentResult,
  LinearCommentsResult,
  validateLinearComment,
  validateLinearComments,
} from "@/components/linear/LinearCommentResult"

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

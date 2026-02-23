/**
 * Outlook MCP Tools
 *
 * Tool definitions and execution handlers for Outlook email operations.
 *
 * IMPORTANT: compose_email returns structured data for the UI draft renderer.
 * Send/draft creation are NOT MCP tools — they're REST-only (user must click).
 *
 * Payload contract (compose_email output):
 *   { to: string[], cc?: string[], bcc?: string[], subject: string, body: string, threadId?: string, status: "draft" }
 */

import { z } from "zod"
import type { OutlookClient } from "../outlook-client.js"

// All tool definitions
const allTools = [
  {
    name: "compose_email",
    description:
      "Compose an email for the user to review. Returns structured data that displays as an email card with Send/Save buttons. The user must click Send or Save Draft — this tool does NOT send or save anything automatically. Use this when the user asks you to write/draft/compose an email.",
    inputSchema: {
      type: "object" as const,
      properties: {
        to: {
          type: "string",
          description: "Recipient email address",
        },
        subject: {
          type: "string",
          description: "Email subject",
        },
        body: {
          type: "string",
          description: "Email body (plain text)",
        },
        cc: {
          type: "string",
          description: "CC recipients (optional, comma-separated)",
        },
        bcc: {
          type: "string",
          description: "BCC recipients (optional, comma-separated)",
        },
        threadId: {
          type: "string",
          description: "Conversation ID for replies (optional)",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "get_profile",
    description: "Get the authenticated user's Outlook profile (email address and display name)",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "search_emails",
    description:
      "Search emails using Outlook/Graph query syntax. Examples: 'from:someone@example.com', 'subject:invoice', plain text search",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'from:boss@example.com', 'subject:urgent', or plain text)",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results (default: 10, max: 50)",
          default: 10,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_email",
    description: "Get the full content of a specific email by its ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        messageId: {
          type: "string",
          description: "The email message ID",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "list_folders",
    description: "List all Outlook mail folders (Inbox, Sent Items, etc.)",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "move_to_folder",
    description: "Move an email to a specific folder",
    inputSchema: {
      type: "object" as const,
      properties: {
        messageId: {
          type: "string",
          description: "The email message ID to move",
        },
        folderId: {
          type: "string",
          description: "The target folder ID (use list_folders to find IDs)",
        },
      },
      required: ["messageId", "folderId"],
    },
  },
  {
    name: "archive_email",
    description: "Archive an email (move to Archive folder)",
    inputSchema: {
      type: "object" as const,
      properties: {
        messageId: {
          type: "string",
          description: "The email message ID to archive",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "mark_as_read",
    description: "Mark an email as read",
    inputSchema: {
      type: "object" as const,
      properties: {
        messageId: {
          type: "string",
          description: "The email message ID",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "mark_as_unread",
    description: "Mark an email as unread",
    inputSchema: {
      type: "object" as const,
      properties: {
        messageId: {
          type: "string",
          description: "The email message ID",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "trash_email",
    description: "Move an email to the Deleted Items folder",
    inputSchema: {
      type: "object" as const,
      properties: {
        messageId: {
          type: "string",
          description: "The email message ID to trash",
        },
      },
      required: ["messageId"],
    },
  },
]

// Export all tools (no disabled tools for Outlook — send/draft are REST-only, not listed)
export const tools = allTools

// ============================================================
// Zod schemas for input validation
// ============================================================

const composeEmailSchema = z.object({
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  threadId: z.string().optional(),
})

const searchSchema = z.object({
  query: z.string(),
  maxResults: z.number().min(1).max(50).default(10),
})

const messageIdSchema = z.object({
  messageId: z.string(),
})

const moveToFolderSchema = z.object({
  messageId: z.string(),
  folderId: z.string(),
})

// ============================================================
// Tool execution
// ============================================================

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean }

export async function executeTool(
  client: OutlookClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "compose_email": {
        const { to, subject, body, cc, bcc, threadId } = composeEmailSchema.parse(args)

        // Split comma-separated addresses into arrays
        const toArray = to
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
        const ccArray = cc
          ? cc
              .split(",")
              .map(s => s.trim())
              .filter(Boolean)
          : undefined
        const bccArray = bcc
          ? bcc
              .split(",")
              .map(s => s.trim())
              .filter(Boolean)
          : undefined

        // Payload contract: matches EmailDraft interface expected by the frontend
        const emailData = {
          to: toArray,
          cc: ccArray,
          bcc: bccArray,
          subject,
          body,
          threadId,
          status: "draft" as const,
        }

        return {
          content: [{ type: "text", text: JSON.stringify(emailData) }],
        }
      }

      case "get_profile": {
        const profile = await client.getProfile()
        return {
          content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
        }
      }

      case "search_emails": {
        const { query, maxResults } = searchSchema.parse(args)
        const emails = await client.searchEmails(query, maxResults)
        return {
          content: [
            {
              type: "text",
              text: emails.length ? JSON.stringify(emails, null, 2) : `No emails found matching: ${query}`,
            },
          ],
        }
      }

      case "get_email": {
        const { messageId } = messageIdSchema.parse(args)
        const email = await client.getEmail(messageId)
        return {
          content: [{ type: "text", text: JSON.stringify(email, null, 2) }],
        }
      }

      case "list_folders": {
        const folders = await client.listFolders()
        return {
          content: [{ type: "text", text: JSON.stringify(folders, null, 2) }],
        }
      }

      case "move_to_folder": {
        const { messageId, folderId } = moveToFolderSchema.parse(args)
        await client.moveToFolder(messageId, folderId)
        return {
          content: [{ type: "text", text: `Email ${messageId} moved to folder ${folderId}` }],
        }
      }

      case "archive_email": {
        const { messageId } = messageIdSchema.parse(args)
        await client.archiveEmail(messageId)
        return {
          content: [{ type: "text", text: `Email ${messageId} archived successfully` }],
        }
      }

      case "mark_as_read": {
        const { messageId } = messageIdSchema.parse(args)
        await client.markAsRead(messageId)
        return {
          content: [{ type: "text", text: `Email ${messageId} marked as read` }],
        }
      }

      case "mark_as_unread": {
        const { messageId } = messageIdSchema.parse(args)
        await client.markAsUnread(messageId)
        return {
          content: [{ type: "text", text: `Email ${messageId} marked as unread` }],
        }
      }

      case "trash_email": {
        const { messageId } = messageIdSchema.parse(args)
        await client.trashEmail(messageId)
        return {
          content: [{ type: "text", text: `Email ${messageId} moved to trash` }],
        }
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
          isError: true,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    }
  }
}

/**
 * Outlook API Client
 *
 * Wraps Microsoft Graph API for email operations.
 * Each request uses the access token passed via HTTP Authorization header.
 *
 * API Reference: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

/** Retry with exponential backoff + jitter for transient failures (429, 5xx) */
async function retryFetch(fn: () => Promise<globalThis.Response>, maxRetries = 2): Promise<globalThis.Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fn()
    const isRetryable = res.status === 429 || res.status >= 500
    if (!isRetryable || attempt >= maxRetries) return res
    const baseDelay = 500 * 2 ** attempt
    const jitter = Math.random() * baseDelay * 0.5
    await new Promise(resolve => setTimeout(resolve, baseDelay + jitter))
  }
}

// ============================================================
// Types
// ============================================================

export interface EmailSummary {
  id: string
  conversationId: string
  from: string
  to: string[]
  subject: string
  receivedDateTime: string
  snippet: string
  isRead: boolean
  /** Graph folder ID the message lives in */
  parentFolderId: string
}

export interface EmailFull extends EmailSummary {
  cc: string[]
  body: string
  bodyContentType: "text" | "html"
  attachments: AttachmentInfo[]
}

export interface AttachmentInfo {
  id: string
  name: string
  contentType: string
  size: number
}

export interface MailFolder {
  id: string
  displayName: string
  totalItemCount: number
  unreadItemCount: number
}

export interface UserProfile {
  email: string
  displayName: string
}

// ============================================================
// Graph response shapes
// ============================================================

interface GraphUser {
  displayName: string
  mail: string | null
  userPrincipalName: string
}

interface GraphRecipient {
  emailAddress: { name?: string; address: string }
}

interface GraphMessage {
  id: string
  conversationId: string
  from?: GraphRecipient
  toRecipients: GraphRecipient[]
  ccRecipients?: GraphRecipient[]
  subject: string
  receivedDateTime: string
  bodyPreview: string
  isRead: boolean
  parentFolderId: string
  body?: { contentType: string; content: string }
  hasAttachments?: boolean
}

interface GraphAttachment {
  id: string
  name: string
  contentType: string
  size: number
}

interface GraphFolder {
  id: string
  displayName: string
  totalItemCount: number
  unreadItemCount: number
}

// ============================================================
// Client
// ============================================================

export class OutlookClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async graphFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`
    const res = await retryFetch(() =>
      fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      }),
    )

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`Graph API ${res.status}: ${text}`)
    }

    // Some endpoints (PATCH/DELETE) return 204 No Content
    if (res.status === 204) return undefined as T

    return res.json()
  }

  // ----------------------------------------------------------
  // Profile
  // ----------------------------------------------------------

  async getProfile(): Promise<UserProfile> {
    const user = await this.graphFetch<GraphUser>("/me")
    return {
      email: user.mail ?? user.userPrincipalName,
      displayName: user.displayName,
    }
  }

  // ----------------------------------------------------------
  // Search / List
  // ----------------------------------------------------------

  async searchEmails(query: string, maxResults: number = 10): Promise<EmailSummary[]> {
    // Graph uses $search for KQL queries and $filter for OData
    // $search is the closest analogue to Gmail's query syntax
    const params = new URLSearchParams({
      $top: String(Math.min(maxResults, 50)),
      $select: "id,conversationId,from,toRecipients,subject,receivedDateTime,bodyPreview,isRead,parentFolderId",
      $orderby: "receivedDateTime desc",
    })

    // $search handles both KQL (from:, subject:, etc.) and plain-text queries
    params.set("$search", `"${query}"`)
    // $search and $orderby can't be combined in Graph; remove orderby
    params.delete("$orderby")
    const data = await this.graphFetch<{ value: GraphMessage[] }>(`/me/messages?${params}`)
    const messages = data.value

    return messages.map(toSummary)
  }

  // ----------------------------------------------------------
  // Get single email
  // ----------------------------------------------------------

  async getEmail(messageId: string): Promise<EmailFull> {
    const id = encodeURIComponent(messageId)
    const msg = await this.graphFetch<GraphMessage>(
      `/me/messages/${id}?$select=id,conversationId,from,toRecipients,ccRecipients,subject,receivedDateTime,bodyPreview,isRead,parentFolderId,body,hasAttachments`,
    )

    let attachments: AttachmentInfo[] = []
    if (msg.hasAttachments) {
      const data = await this.graphFetch<{ value: GraphAttachment[] }>(
        `/me/messages/${id}/attachments?$select=id,name,contentType,size`,
      )
      attachments = data.value.map(a => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        size: a.size,
      }))
    }

    return {
      ...toSummary(msg),
      cc: (msg.ccRecipients ?? []).map(recipientToString),
      body: msg.body?.content ?? "",
      bodyContentType: msg.body?.contentType === "html" ? "html" : "text",
      attachments,
    }
  }

  // ----------------------------------------------------------
  // Folders
  // ----------------------------------------------------------

  async listFolders(): Promise<MailFolder[]> {
    const data = await this.graphFetch<{ value: GraphFolder[] }>(
      "/me/mailFolders?$select=id,displayName,totalItemCount,unreadItemCount&$top=50",
    )
    return data.value.map(f => ({
      id: f.id,
      displayName: f.displayName,
      totalItemCount: f.totalItemCount,
      unreadItemCount: f.unreadItemCount,
    }))
  }

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  async moveToFolder(messageId: string, folderId: string): Promise<void> {
    await this.graphFetch<GraphMessage>(`/me/messages/${encodeURIComponent(messageId)}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: folderId }),
    })
  }

  async archiveEmail(messageId: string): Promise<void> {
    // Well-known name "archive" works as destinationId regardless of locale
    await this.graphFetch(`/me/messages/${encodeURIComponent(messageId)}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: "archive" }),
    })
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.graphFetch(`/me/messages/${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: true }),
    })
  }

  async markAsUnread(messageId: string): Promise<void> {
    await this.graphFetch(`/me/messages/${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: false }),
    })
  }

  async trashEmail(messageId: string): Promise<void> {
    // Well-known name "deleteditems" works as destinationId regardless of locale
    await this.graphFetch(`/me/messages/${encodeURIComponent(messageId)}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: "deleteditems" }),
    })
  }
}

// ============================================================
// Helpers
// ============================================================

function recipientToString(r: GraphRecipient): string {
  const addr = r.emailAddress.address
  const name = r.emailAddress.name
  return name ? `${name} <${addr}>` : addr
}

function toSummary(msg: GraphMessage): EmailSummary {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    from: msg.from ? recipientToString(msg.from) : "",
    to: msg.toRecipients.map(recipientToString),
    subject: msg.subject,
    receivedDateTime: msg.receivedDateTime,
    snippet: msg.bodyPreview,
    isRead: msg.isRead,
    parentFolderId: msg.parentFolderId,
  }
}

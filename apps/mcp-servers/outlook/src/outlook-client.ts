/**
 * Outlook API Client
 *
 * Wraps Microsoft Graph API for email operations.
 * Each request uses the access token passed via HTTP Authorization header.
 *
 * API Reference: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

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
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    })

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

    // If the query contains KQL operators (from:, subject:, etc.) use $search
    // Otherwise use $filter with a contains-based approach
    const isKql = /\b(from|to|subject|body|received|sent|hasAttachment):/i.test(query)

    let messages: GraphMessage[]

    if (isKql) {
      params.set("$search", `"${query}"`)
      // $search and $orderby can't be combined in Graph; remove orderby
      params.delete("$orderby")
      const data = await this.graphFetch<{ value: GraphMessage[] }>(`/me/messages?${params}`)
      messages = data.value
    } else {
      // Plain text search: search subject and body
      params.set("$search", `"${query}"`)
      params.delete("$orderby")
      const data = await this.graphFetch<{ value: GraphMessage[] }>(`/me/messages?${params}`)
      messages = data.value
    }

    return messages.map(toSummary)
  }

  // ----------------------------------------------------------
  // Get single email
  // ----------------------------------------------------------

  async getEmail(messageId: string): Promise<EmailFull> {
    const msg = await this.graphFetch<GraphMessage>(
      `/me/messages/${messageId}?$select=id,conversationId,from,toRecipients,ccRecipients,subject,receivedDateTime,bodyPreview,isRead,parentFolderId,body,hasAttachments`,
    )

    let attachments: AttachmentInfo[] = []
    if (msg.hasAttachments) {
      const data = await this.graphFetch<{ value: GraphAttachment[] }>(
        `/me/messages/${messageId}/attachments?$select=id,name,contentType,size`,
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
    await this.graphFetch<GraphMessage>(`/me/messages/${messageId}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: folderId }),
    })
  }

  async archiveEmail(messageId: string): Promise<void> {
    // Use well-known folder name — works regardless of locale
    const folder = await this.graphFetch<GraphFolder>("/me/mailFolders/archive")
    await this.moveToFolder(messageId, folder.id)
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.graphFetch(`/me/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: true }),
    })
  }

  async markAsUnread(messageId: string): Promise<void> {
    await this.graphFetch(`/me/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: false }),
    })
  }

  async trashEmail(messageId: string): Promise<void> {
    // Use well-known folder name — works regardless of locale
    const folder = await this.graphFetch<GraphFolder>("/me/mailFolders/deleteditems")
    await this.moveToFolder(messageId, folder.id)
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

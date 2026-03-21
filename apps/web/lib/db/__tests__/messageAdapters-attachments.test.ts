import { describe, expect, it } from "vitest"
import type {
  Attachment,
  LibraryImageAttachment,
  SkillAttachment,
  SuperTemplateAttachment,
  UploadedFileAttachment,
} from "@/features/chat/components/ChatInput/types"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { toDbMessage, toUIMessage } from "@/lib/db/messageAdapters"

describe("Attachment Persistence", () => {
  it("should persist library image attachments", () => {
    const imageAttachment: LibraryImageAttachment = {
      kind: "library-image",
      id: "img-123",
      photobookKey: "domain.com/abc123def",
      preview: "data:image/webp;base64,xyz",
      mode: "analyze",
    }

    const userMessage: UIMessage = {
      id: "msg-1",
      type: "user",
      content: "Check this image",
      timestamp: new Date(),
      attachments: [imageAttachment],
    }

    // Convert to DB format
    const dbMessage = toDbMessage(userMessage, "tab-1", 1)

    // Verify attachments are stored
    expect(dbMessage.attachments).toBeDefined()
    expect(dbMessage.attachments?.[0]).toMatchObject({
      kind: "library-image",
      id: "img-123",
      photobookKey: "domain.com/abc123def",
      preview: "data:image/webp;base64,xyz",
      mode: "analyze",
    })

    // Convert back to UI format
    const restoredMessage = toUIMessage(dbMessage)

    // Verify attachments are restored
    expect(restoredMessage.attachments).toBeDefined()
    expect(restoredMessage.attachments).toHaveLength(1)
    expect(restoredMessage.attachments?.[0]).toMatchObject({
      kind: "library-image",
      id: "img-123",
      photobookKey: "domain.com/abc123def",
      mode: "analyze",
    })
  })

  it("should persist uploaded file attachments", () => {
    const fileAttachment: UploadedFileAttachment = {
      kind: "uploaded-file",
      id: "file-456",
      workspacePath: ".uploads/design.png",
      originalName: "design.png",
      mimeType: "image/png",
      size: 102400,
      preview: "data:image/png;base64,abc",
    }

    const userMessage: UIMessage = {
      id: "msg-2",
      type: "user",
      content: "Review the design",
      timestamp: new Date(),
      attachments: [fileAttachment],
    }

    // Convert to DB format
    const dbMessage = toDbMessage(userMessage, "tab-1", 2)

    // Verify attachments are stored
    expect(dbMessage.attachments).toBeDefined()
    expect(dbMessage.attachments?.[0]).toMatchObject({
      kind: "uploaded-file",
      id: "file-456",
      workspacePath: ".uploads/design.png",
      originalName: "design.png",
      mimeType: "image/png",
      size: 102400,
    })

    // Convert back
    const restoredMessage = toUIMessage(dbMessage)
    expect(restoredMessage.attachments).toHaveLength(1)
    expect(restoredMessage.attachments?.[0]).toMatchObject({
      kind: "uploaded-file",
      id: "file-456",
      workspacePath: ".uploads/design.png",
      originalName: "design.png",
      mimeType: "image/png",
      size: 102400,
    })
  })

  it("should handle messages without attachments", () => {
    const userMessage: UIMessage = {
      id: "msg-3",
      type: "user",
      content: "No attachments here",
      timestamp: new Date(),
    }

    const dbMessage = toDbMessage(userMessage, "tab-1", 3)
    expect(dbMessage.attachments).toBeUndefined()

    const restoredMessage = toUIMessage(dbMessage)
    expect(restoredMessage.attachments).toBeUndefined()
  })

  it("should persist attachments when called with addMessage-style options", () => {
    // This test covers the exact code path used by dexieMessageStore.addMessage()
    // which was previously constructing DbMessage manually (missing attachments)
    const imageAttachment: LibraryImageAttachment = {
      kind: "library-image",
      id: "img-add-msg",
      photobookKey: "domain.com/photo123",
      preview: "data:image/webp;base64,abc",
      mode: "website",
    }

    const fileAttachment: UploadedFileAttachment = {
      kind: "uploaded-file",
      id: "file-add-msg",
      workspacePath: ".uploads/photo.jpg",
      originalName: "photo.jpg",
      mimeType: "image/jpeg",
      size: 204800,
      preview: "data:image/jpeg;base64,xyz",
    }

    const userMessage: UIMessage = {
      id: "msg-addmsg",
      type: "user",
      content: "Here are my photos",
      timestamp: new Date(),
      attachments: [imageAttachment, fileAttachment],
    }

    // Use the same options addMessage passes
    const dbMessage = toDbMessage(userMessage, "tab-1", 5, {
      status: "complete",
      origin: "local",
      pendingSync: true,
    })

    // Verify metadata options are applied
    expect(dbMessage.status).toBe("complete")
    expect(dbMessage.origin).toBe("local")
    expect(dbMessage.pendingSync).toBe(true)

    // Verify attachments survive the conversion
    expect(dbMessage.attachments).toBeDefined()
    expect(dbMessage.attachments).toHaveLength(2)
    expect(dbMessage.attachments?.[0]).toMatchObject({
      kind: "library-image",
      id: "img-add-msg",
      photobookKey: "domain.com/photo123",
    })
    expect(dbMessage.attachments?.[1]).toMatchObject({
      kind: "uploaded-file",
      id: "file-add-msg",
      workspacePath: ".uploads/photo.jpg",
      originalName: "photo.jpg",
    })

    // Verify round-trip back to UI
    const restored = toUIMessage(dbMessage)
    expect(restored.attachments).toHaveLength(2)
    expect(restored.attachments?.[0]).toMatchObject({ kind: "library-image", id: "img-add-msg" })
    expect(restored.attachments?.[1]).toMatchObject({ kind: "uploaded-file", id: "file-add-msg" })
  })

  it("should persist all attachment kinds through round-trip", () => {
    const attachments: Attachment[] = [
      {
        kind: "library-image",
        id: "img-1",
        photobookKey: "domain.com/abc",
        preview: "data:image/webp;base64,",
        mode: "analyze",
      } satisfies LibraryImageAttachment,
      {
        kind: "supertemplate",
        id: "tmpl-1",
        templateId: "carousel-v1",
        name: "Carousel",
        preview: "https://example.com/preview.png",
      } satisfies SuperTemplateAttachment,
      {
        kind: "skill",
        id: "skill-1",
        skillId: "revise-code",
        displayName: "Revise Code",
        description: "Review code quality",
        prompt: "Please review...",
        source: "superadmin",
      } satisfies SkillAttachment,
      {
        kind: "uploaded-file",
        id: "file-1",
        workspacePath: ".uploads/doc.pdf",
        originalName: "doc.pdf",
        mimeType: "application/pdf",
        size: 50000,
      } satisfies UploadedFileAttachment,
    ]

    const userMessage: UIMessage = {
      id: "msg-all-kinds",
      type: "user",
      content: "All attachment types",
      timestamp: new Date(),
      attachments,
    }

    const dbMessage = toDbMessage(userMessage, "tab-1", 6)
    expect(dbMessage.attachments).toHaveLength(4)

    const restored = toUIMessage(dbMessage)
    expect(restored.attachments).toHaveLength(4)
    expect(restored.attachments?.map(a => a.kind)).toEqual(["library-image", "supertemplate", "skill", "uploaded-file"])
  })

  it("should drop transient fields like uploadProgress and error", () => {
    const attachmentWithTransient: LibraryImageAttachment = {
      kind: "library-image",
      id: "img-789",
      photobookKey: "domain.com/xyz",
      preview: "data:image/webp;base64,",
      uploadProgress: 100, // Should be dropped
      error: undefined, // Should be dropped
    }

    const userMessage: UIMessage = {
      id: "msg-4",
      type: "user",
      content: "Test transient fields",
      timestamp: new Date(),
      attachments: [attachmentWithTransient],
    }

    const dbMessage = toDbMessage(userMessage, "tab-1", 4)

    // Verify transient fields are not stored
    expect(dbMessage.attachments?.[0]).not.toHaveProperty("uploadProgress")
    expect(dbMessage.attachments?.[0]).not.toHaveProperty("error")

    // But essential fields are there
    expect(dbMessage.attachments?.[0]).toMatchObject({
      kind: "library-image",
      id: "img-789",
      photobookKey: "domain.com/xyz",
    })
  })
})

import { describe, expect, it } from "vitest"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { toDbMessageContent, toDbMessageType } from "@/lib/db/messageAdapters"

describe("messageAdapters task_notification mapping (#244)", () => {
  const taskNotificationContent = {
    type: "system",
    subtype: "task_notification",
    task_id: "b0d0e6d",
    status: "failed",
    output_file: "/tmp/claude-0/tasks/b0d0e6d.output",
    summary: 'Background command "Push branch" failed with exit code 1',
    uuid: "uuid-1",
    session_id: "sess-1",
  }

  it("serializes task_notification as sdk_message kind, not text", () => {
    const message: UIMessage = {
      id: "task-1",
      type: "task_notification",
      content: taskNotificationContent,
      timestamp: new Date(),
    }

    const dbContent = toDbMessageContent(message)

    expect(dbContent.kind).toBe("sdk_message")
    expect((dbContent as { kind: "sdk_message"; data: unknown }).data).toEqual(taskNotificationContent)
  })

  it("maps task_notification to system db type", () => {
    expect(toDbMessageType("task_notification")).toBe("system")
  })
})

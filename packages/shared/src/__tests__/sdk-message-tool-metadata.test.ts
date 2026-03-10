import { describe, expect, it } from "vitest"
import { createToolMetadataStore, syncSdkMessageToolMetadata } from "../sdk-message-tool-metadata"

function getFirstContentBlock(message: {
  message: {
    content: unknown[]
  }
}): Record<string, unknown> {
  const [firstBlock] = message.message.content
  if (!firstBlock || typeof firstBlock !== "object" || Array.isArray(firstBlock)) {
    throw new Error("Expected first content block to be an object")
  }
  return firstBlock
}

describe("syncSdkMessageToolMetadata", () => {
  it("records tool_use blocks and annotates later tool_result blocks", () => {
    const store = createToolMetadataStore()

    const assistantMessage = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_read", name: "Read", input: { file_path: "/src/index.ts" } }],
      },
    }

    const assistantSync = syncSdkMessageToolMetadata(assistantMessage, store)
    expect(assistantSync.toolUses).toEqual([
      {
        toolUseId: "toolu_read",
        toolName: "Read",
        toolInput: { file_path: "/src/index.ts" },
      },
    ])

    const userMessage = {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_read", content: "file contents" }],
      },
    }

    const userSync = syncSdkMessageToolMetadata(userMessage, store)
    expect(userSync.toolResults).toEqual([{ toolUseId: "toolu_read" }])

    const toolResult = getFirstContentBlock(userMessage)
    expect(toolResult.tool_name).toBe("Read")
    expect(toolResult.tool_input).toEqual({ file_path: "/src/index.ts" })
  })

  it("annotates multiple tool_result blocks from the same sequential store", () => {
    const store = createToolMetadataStore()

    syncSdkMessageToolMetadata(
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "toolu_read", name: "Read", input: { file_path: "a.ts" } },
            { type: "tool_use", id: "toolu_glob", name: "Glob", input: { pattern: "*.ts" } },
          ],
        },
      },
      store,
    )

    const userMessage = {
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_read", content: "file a" },
          { type: "tool_result", tool_use_id: "toolu_glob", content: "a.ts\nb.ts" },
        ],
      },
    }

    syncSdkMessageToolMetadata(userMessage, store)

    const [firstResult, secondResult] = userMessage.message.content.map(block => {
      if (!block || typeof block !== "object" || Array.isArray(block)) {
        throw new Error("Expected tool result block to be an object")
      }
      return block
    })

    expect(firstResult.tool_name).toBe("Read")
    expect(secondResult.tool_name).toBe("Glob")
    expect(secondResult.tool_input).toEqual({ pattern: "*.ts" })
  })

  it("leaves unmatched tool_result blocks unchanged", () => {
    const store = createToolMetadataStore()
    const userMessage = {
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_missing", content: "data" }],
      },
    }

    syncSdkMessageToolMetadata(userMessage, store)

    const toolResult = getFirstContentBlock(userMessage)
    expect(toolResult.tool_name).toBeUndefined()
    expect(toolResult.tool_input).toBeUndefined()
  })
})

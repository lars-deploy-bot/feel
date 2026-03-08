import { BridgeStreamType } from "@/features/chat/lib/streaming/ndjson"

interface NDJSONEvent {
  type: string
  data?: unknown
}

interface AssistantTextBlock {
  type?: unknown
  text?: unknown
}

interface AssistantEventData {
  messageType?: unknown
  content?: {
    message?: {
      content?: unknown
    }
  }
}

/**
 * Parse NDJSON response body into stream events.
 */
export function parseNDJSONEvents(body: string): NDJSONEvent[] {
  return body
    .split("\n")
    .filter(line => line.trim().length > 0)
    .map(line => {
      const parsed: unknown = JSON.parse(line)
      if (typeof parsed !== "object" || parsed === null || !("type" in parsed) || typeof parsed.type !== "string") {
        throw new Error(`Unexpected NDJSON event format: ${line}`)
      }
      return parsed as NDJSONEvent
    })
}

/**
 * Parse NDJSON response body into stream event type names.
 */
export function parseNDJSONEventTypes(body: string): string[] {
  return parseNDJSONEvents(body).map(event => event.type)
}

/**
 * Extract visible assistant text blocks from a stream NDJSON payload.
 */
export function extractAssistantTextFromNDJSON(body: string): string {
  const events = parseNDJSONEvents(body)
  const textBlocks: string[] = []

  for (const event of events) {
    if (event.type !== BridgeStreamType.MESSAGE) continue

    const data = event.data as AssistantEventData | undefined
    if (data?.messageType !== "assistant") continue

    const blocks = data.content?.message?.content
    if (!Array.isArray(blocks)) continue

    for (const block of blocks as AssistantTextBlock[]) {
      if (block.type === "text" && typeof block.text === "string" && block.text.trim().length > 0) {
        textBlocks.push(block.text.trim())
      }
    }
  }

  if (textBlocks.length === 0) {
    const eventTypes = events.map(e => e.type)
    const hasError = events.some(e => e.type === BridgeStreamType.ERROR)
    const errorEvents = events.filter(e => e.type === BridgeStreamType.ERROR)
    const errorDetails = errorEvents.map(e => JSON.stringify(e.data)).join("; ")
    throw new Error(
      "No assistant text blocks found in NDJSON response. " +
        `Events: [${eventTypes.join(", ")}]` +
        (hasError ? `. Stream errors: ${errorDetails}` : "") +
        `. Total events: ${events.length}`,
    )
  }

  return textBlocks.join("\n")
}

import { BridgeStreamType } from "@/features/chat/lib/streaming/ndjson"
import { isBridgeMessageEvent } from "@/features/chat/types/guards"

/**
 * Parse NDJSON response body into stream events.
 */
export function parseNDJSONEvents(body: string) {
  return body
    .split("\n")
    .filter(line => line.trim().length > 0)
    .map(line => {
      const parsed: unknown = JSON.parse(line)
      if (typeof parsed !== "object" || parsed === null || !("type" in parsed) || typeof parsed.type !== "string") {
        throw new Error(`Unexpected NDJSON event format: ${line}`)
      }
      return {
        type: parsed.type,
        data: "data" in parsed ? parsed.data : undefined,
      }
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
    if (!isBridgeMessageEvent(event) || event.data.messageType !== "assistant") continue

    const blocks =
      typeof event.data.content === "object" &&
      event.data.content !== null &&
      "message" in event.data.content &&
      typeof event.data.content.message === "object" &&
      event.data.content.message !== null &&
      "content" in event.data.content.message
        ? event.data.content.message.content
        : undefined
    if (!Array.isArray(blocks)) continue

    for (const block of blocks) {
      if (
        typeof block === "object" &&
        block !== null &&
        "type" in block &&
        block.type === "text" &&
        "text" in block &&
        typeof block.text === "string" &&
        block.text.trim().length > 0
      ) {
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

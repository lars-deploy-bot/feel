/**
 * Shared Bridge API Client for MCP Tools
 *
 * Provides a clean, DRY interface for tools to call back to the Bridge API.
 * Handles port resolution, error formatting, and response parsing.
 */

function getApiBaseUrl(): string {
  if (process.env.BRIDGE_API_URL) return process.env.BRIDGE_API_URL
  if (process.env.BRIDGE_API_PORT) return `http://localhost:${process.env.BRIDGE_API_PORT}`
  return "http://localhost:8999" // Default to production
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

export interface ApiCallOptions {
  endpoint: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: Record<string, any>
  timeout?: number
}

/**
 * Call Bridge API and return formatted tool result
 */
export async function callBridgeApi(options: ApiCallOptions): Promise<ToolResult> {
  const { endpoint, method = "POST", body, timeout = 60000 } = options

  try {
    const apiUrl = `${getApiBaseUrl()}${endpoint}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(apiUrl, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`

      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.message || errorMessage
      } catch {
        // Response wasn't JSON, use status text
      }

      return {
        content: [{ type: "text", text: `✗ API call failed\n\n${errorMessage}` }],
        isError: true,
      }
    }

    const result = (await response.json()) as any

    if (result.success || result.ok) {
      return {
        content: [
          {
            type: "text",
            text: result.message || result.output || "✓ Operation completed successfully",
          },
        ],
        isError: false,
      }
    }

    return {
      content: [{ type: "text", text: `✗ ${result.message || "Unknown error"}` }],
      isError: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("aborted")) {
      return {
        content: [{ type: "text", text: `✗ Request timed out after ${timeout / 1000}s` }],
        isError: true,
      }
    }

    return {
      content: [{ type: "text", text: `✗ Failed to reach Bridge API\n\nError: ${errorMessage}` }],
      isError: true,
    }
  }
}

/**
 * Helper to create success result
 */
export function successResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: `✓ ${message}` }],
    isError: false,
  }
}

/**
 * Helper to create error result
 */
export function errorResult(message: string, details?: string): ToolResult {
  return {
    content: [{ type: "text", text: details ? `✗ ${message}\n\n${details}` : `✗ ${message}` }],
    isError: true,
  }
}

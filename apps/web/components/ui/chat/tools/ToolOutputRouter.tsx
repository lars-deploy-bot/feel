import { BashOutput } from "@/components/ui/chat/tools/bash/BashOutput"
import { EditOutput } from "@/components/ui/chat/tools/edit/EditOutput"
import { GlobOutput } from "@/components/ui/chat/tools/glob/GlobOutput"
import { GrepOutput } from "@/components/ui/chat/tools/grep/GrepOutput"
import { ReadOutput } from "@/components/ui/chat/tools/read/ReadOutput"
import { StripeAccountOutput } from "@/components/ui/chat/tools/stripe/StripeAccountOutput"
import { StripeBalanceOutput } from "@/components/ui/chat/tools/stripe/StripeBalanceOutput"
import { StripeCustomersOutput } from "@/components/ui/chat/tools/stripe/StripeCustomersOutput"
import { StripePaymentIntentsOutput } from "@/components/ui/chat/tools/stripe/StripePaymentIntentsOutput"
import { StripeResourcesOutput } from "@/components/ui/chat/tools/stripe/StripeResourcesOutput"
import { StripeSearchOutput } from "@/components/ui/chat/tools/stripe/StripeSearchOutput"
import { StripeSubscriptionsOutput } from "@/components/ui/chat/tools/stripe/StripeSubscriptionsOutput"
import { TaskOutput } from "@/components/ui/chat/tools/task/TaskOutput"
import { WriteOutput } from "@/components/ui/chat/tools/write/WriteOutput"
import { getToolRenderer, validateToolData, transformToolData } from "@/lib/tools/tool-registry"
// Register all tools (display, renderers, previews)
import "@/lib/tools/register-tools"

interface ToolOutputRouterProps {
  toolName: string
  // Tool output is dynamic JSON - SDK doesn't provide output types
  // Runtime structural validation ensures type safety
  content: any
  // Original tool input - useful for renderers when output is empty (e.g., create_comment returns {})
  toolInput?: unknown
}

/**
 * Unwrap MCP text wrapper format: [{type: "text", text: "..."}] → parsed JSON
 * Also handles string content and nested wrappers.
 */
function unwrapMcp(content: unknown): unknown {
  let data = content

  // Handle MCP wrapper: [{type: "text", text: "..."}]
  if (Array.isArray(data) && data[0]?.type === "text" && data[0]?.text) {
    try {
      data = JSON.parse(data[0].text)
    } catch {
      return content
    }
  }

  // Handle string content
  if (typeof data === "string") {
    try {
      data = JSON.parse(data)
    } catch {
      return content
    }
  }

  // Handle nested wrapper (sometimes double-wrapped)
  if (Array.isArray(data) && data[0]?.type === "text" && data[0]?.text) {
    try {
      data = JSON.parse(data[0].text)
    } catch {
      // Keep current data
    }
  }

  return data
}

/**
 * Check if content is MCP text format: [{type: "text", text: "..."}]
 * Returns the extracted text(s) or null if not MCP format
 */
function extractMcpText(content: unknown): string[] | null {
  if (!Array.isArray(content)) return null

  const texts: string[] = []
  for (const item of content) {
    if (item?.type === "text" && typeof item?.text === "string") {
      texts.push(item.text)
    }
  }

  return texts.length > 0 ? texts : null
}

/**
 * Simple renderer for MCP text responses
 */
function McpTextOutput({ texts }: { texts: string[] }) {
  return (
    <div className="mt-2 space-y-2">
      {texts.map((text, i) => (
        <div
          key={i}
          className="text-xs text-black/60 dark:text-white/60 font-diatype-mono whitespace-pre-wrap leading-relaxed px-3 py-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-md border border-black/5 dark:border-white/5"
        >
          {text}
        </div>
      ))}
    </div>
  )
}

export function ToolOutputRouter({ toolName, content, toolInput }: ToolOutputRouterProps) {
  const tool = toolName.toLowerCase()

  // Check component registry for custom renderers
  const Component = getToolRenderer(toolName)
  if (Component) {
    // Apply transform (handles MCP unwrapping if configured)
    const data = transformToolData(toolName, content)
    // Validate data is suitable for renderer
    if (validateToolData(toolName, data)) {
      return <Component data={data} toolName={toolName} toolInput={toolInput} />
    }
  }

  switch (tool) {
    case "bash":
      if (content.output !== undefined && content.exitCode !== undefined) {
        return <BashOutput {...content} />
      }
      break

    case "read":
      // TextFileOutput
      if (content.total_lines !== undefined && content.content) {
        return <ReadOutput {...content} />
      }
      // ImageFileOutput
      if (content.image && content.file_size !== undefined) {
        return <ReadOutput {...content} />
      }
      // PDFFileOutput
      if (content.pages && content.total_pages !== undefined) {
        return <ReadOutput {...content} />
      }
      // NotebookFileOutput
      if (content.cells) {
        return <ReadOutput {...content} />
      }
      break

    case "edit":
      if (content.replacements !== undefined) {
        return <EditOutput {...content} />
      }
      break

    case "write":
      if (content.bytes_written !== undefined) {
        return <WriteOutput {...content} />
      }
      break

    case "grep":
      // GrepFilesOutput
      if (content.files && content.count !== undefined) {
        return <GrepOutput {...content} />
      }
      // GrepContentOutput
      if (content.matches && content.total_matches !== undefined) {
        return <GrepOutput {...content} />
      }
      // GrepCountOutput
      if (content.counts && content.total !== undefined) {
        return <GrepOutput {...content} />
      }
      break

    case "glob":
      if (content.matches && content.count !== undefined) {
        return <GlobOutput {...content} />
      }
      break

    case "task":
      if (content.result) {
        return <TaskOutput {...content} />
      }
      break

    case "mcp__stripe__list_subscriptions": {
      const subscriptions = unwrapMcp(content)
      if (Array.isArray(subscriptions) && subscriptions.length > 0 && subscriptions[0].id) {
        return <StripeSubscriptionsOutput subscriptions={subscriptions} />
      }
      break
    }

    case "mcp__stripe__list_customers": {
      const data = unwrapMcp(content) as Record<string, unknown> | unknown[]
      // Stripe API returns {object: "list", data: [...]}
      const customers = (data as Record<string, unknown>)?.data || data
      if (Array.isArray(customers) && customers.length > 0 && (customers[0] as Record<string, unknown>).id) {
        return <StripeCustomersOutput customers={customers} />
      }
      break
    }

    case "mcp__stripe__fetch_stripe_resources": {
      // This tool returns multiple text items, each needs parsing
      const resources: any[] = []
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === "text" && item.text) {
            try {
              resources.push(JSON.parse(item.text))
            } catch {
              // Skip unparseable items
            }
          }
        }
      }
      if (resources.length > 0) {
        return <StripeResourcesOutput resources={resources} />
      }
      break
    }

    case "mcp__stripe__retrieve_balance": {
      const balance = unwrapMcp(content)
      if (balance && typeof balance === "object") {
        return <StripeBalanceOutput balance={balance} />
      }
      break
    }

    case "mcp__stripe__get_stripe_account_info": {
      const account = unwrapMcp(content)
      if (account && typeof account === "object") {
        return <StripeAccountOutput account={account} />
      }
      break
    }

    case "mcp__stripe__list_payment_intents": {
      const paymentIntents = unwrapMcp(content)
      if (Array.isArray(paymentIntents) && paymentIntents.length > 0) {
        return <StripePaymentIntentsOutput paymentIntents={paymentIntents} />
      }
      break
    }

    case "mcp__stripe__search_stripe_resources": {
      const data = unwrapMcp(content) as Record<string, unknown> | null
      if (data?.results && Array.isArray(data.results)) {
        return <StripeSearchOutput results={data.results} />
      }
      break
    }

    // Add other tools as needed
    default:
      break
  }

  // Generic fallback: try to extract MCP text format first, then fall back to JSON
  const mcpTexts = extractMcpText(content)
  if (mcpTexts) {
    return <McpTextOutput texts={mcpTexts} />
  }

  // Final fallback: raw JSON display
  return (
    <pre className="text-xs text-black/60 dark:text-white/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
      {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
    </pre>
  )
}

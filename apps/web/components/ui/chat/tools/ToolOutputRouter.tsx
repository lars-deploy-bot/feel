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

interface ToolOutputRouterProps {
  toolName: string
  // Tool output is dynamic JSON - SDK doesn't provide output types
  // Runtime structural validation ensures type safety
  content: any
}

export function ToolOutputRouter({ toolName, content }: ToolOutputRouterProps) {
  const tool = toolName.toLowerCase()

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

    case "mcp__stripe__list_subscriptions":
      // Stripe MCP returns array of subscriptions in text field as JSON string
      try {
        let subscriptions = content

        // Handle MCP wrapper format: [{type: "text", text: "[...]"}]
        if (Array.isArray(content) && content[0]?.type === "text" && content[0]?.text) {
          subscriptions = JSON.parse(content[0].text)
        }

        // Handle if content is already a string (pre-parsed by getDisplayContent)
        if (typeof content === "string") {
          subscriptions = JSON.parse(content)
        }

        // If we have an array of objects with type/text, extract from first
        if (Array.isArray(subscriptions) && subscriptions[0]?.type === "text" && subscriptions[0]?.text) {
          subscriptions = JSON.parse(subscriptions[0].text)
        }

        if (Array.isArray(subscriptions) && subscriptions.length > 0 && subscriptions[0].id) {
          return <StripeSubscriptionsOutput subscriptions={subscriptions} />
        }
      } catch (e) {
        console.error("Failed to parse Stripe subscriptions:", e)
      }
      break

    case "mcp__stripe__list_customers":
      // Stripe MCP returns customers in text field as JSON string
      try {
        let data = content

        // Handle MCP wrapper format: [{type: "text", text: "{...}"}]
        if (Array.isArray(content) && content[0]?.type === "text" && content[0]?.text) {
          data = JSON.parse(content[0].text)
        }

        // Handle if content is already a string
        if (typeof content === "string") {
          data = JSON.parse(content)
        }

        // Stripe API returns {object: "list", data: [...]}
        const customers = data?.data || data

        if (Array.isArray(customers) && customers.length > 0 && customers[0].id) {
          return <StripeCustomersOutput customers={customers} />
        }
      } catch (e) {
        console.error("Failed to parse Stripe customers:", e)
      }
      break

    case "mcp__stripe__fetch_stripe_resources":
      // Stripe MCP returns resources as [{type: "text", text: "{...}"}]
      try {
        const resources = []

        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === "text" && item.text) {
              // Parse the JSON string in the text field
              const parsed = JSON.parse(item.text)
              resources.push(parsed)
            }
          }
        }

        if (resources.length > 0) {
          return <StripeResourcesOutput resources={resources} />
        }
      } catch (e) {
        console.error("Failed to parse Stripe resources:", e)
      }
      break

    case "mcp__stripe__retrieve_balance":
      // Stripe balance: [{type: "text", text: "{...}"}]
      try {
        if (Array.isArray(content) && content[0]?.type === "text" && content[0]?.text) {
          const balance = JSON.parse(content[0].text)
          return <StripeBalanceOutput balance={balance} />
        }
      } catch (e) {
        console.error("Failed to parse Stripe balance:", e)
      }
      break

    case "mcp__stripe__get_stripe_account_info":
      // Stripe account: [{type: "text", text: "{...}"}]
      try {
        if (Array.isArray(content) && content[0]?.type === "text" && content[0]?.text) {
          const account = JSON.parse(content[0].text)
          return <StripeAccountOutput account={account} />
        }
      } catch (e) {
        console.error("Failed to parse Stripe account:", e)
      }
      break

    case "mcp__stripe__list_payment_intents":
      // Stripe payment intents: [{type: "text", text: "[...]"}]
      try {
        if (Array.isArray(content) && content[0]?.type === "text" && content[0]?.text) {
          const paymentIntents = JSON.parse(content[0].text)
          if (Array.isArray(paymentIntents)) {
            return <StripePaymentIntentsOutput paymentIntents={paymentIntents} />
          }
        }
      } catch (e) {
        console.error("Failed to parse Stripe payment intents:", e)
      }
      break

    case "mcp__stripe__search_stripe_resources":
      // Stripe search results: [{type: "text", text: "{\"results\":[...]}"}]
      try {
        if (Array.isArray(content) && content[0]?.type === "text" && content[0]?.text) {
          const data = JSON.parse(content[0].text)
          if (data.results && Array.isArray(data.results)) {
            return <StripeSearchOutput results={data.results} />
          }
        }
      } catch (e) {
        console.error("Failed to parse Stripe search results:", e)
      }
      break

    // Add other tools as needed
    default:
      // Fallback to JSON for unknown tools
      return (
        <pre className="text-xs text-black/60 dark:text-white/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
          {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
        </pre>
      )
  }

  // Fallback if tool is recognized but content doesn't match expected schema
  return (
    <pre className="text-xs text-black/60 dark:text-white/60 font-diatype-mono leading-relaxed overflow-auto max-h-80 p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10">
      {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
    </pre>
  )
}

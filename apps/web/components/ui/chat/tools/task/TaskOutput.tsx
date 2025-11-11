import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { hasMarkdown } from "@/lib/utils/markdown-utils"

interface TaskOutputProps {
  result: string
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  total_cost_usd?: number
  duration_ms?: number
}

export function TaskOutput({ result, usage, total_cost_usd, duration_ms }: TaskOutputProps) {
  return (
    <div className="space-y-2">
      {(usage || total_cost_usd || duration_ms) && (
        <div className="text-xs text-black/40 dark:text-white/40 font-normal">
          {duration_ms && `${duration_ms}ms`}
          {total_cost_usd && ` • $${total_cost_usd.toFixed(4)}`}
          {usage && ` • ${usage.input_tokens + usage.output_tokens} tokens`}
        </div>
      )}
      <div className="text-xs bg-black/[0.02] dark:bg-white/[0.02] p-3 border border-black/10 dark:border-white/10 max-h-80 overflow-auto">
        {hasMarkdown(result) ? (
          <MarkdownDisplay content={result} className="text-black/80 dark:text-white/80" />
        ) : (
          <div className="text-black/80 dark:text-white/80 font-normal leading-relaxed whitespace-pre-wrap">
            {result}
          </div>
        )}
      </div>
    </div>
  )
}

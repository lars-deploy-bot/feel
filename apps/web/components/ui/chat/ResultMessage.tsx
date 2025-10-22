import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import { CheckCircle, XCircle } from 'lucide-react'

interface ResultMessageProps {
	content: SDKResultMessage
}

export function ResultMessage({ content }: ResultMessageProps) {
	return (
		<div className="py-2 mb-4">
			<div className="text-sm font-medium text-gray-600 normal-case tracking-normal">
				{content.is_error ? 'Error' : 'Completed'}
				<span className="ml-2 text-xs text-gray-400">
					{(content.duration_ms / 1000).toFixed(1)}s • ${content.total_cost_usd.toFixed(4)}
				</span>
			</div>
			{content.result && (
				<div className="mt-1 text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{content.result}</div>
			)}
		</div>
	)
}

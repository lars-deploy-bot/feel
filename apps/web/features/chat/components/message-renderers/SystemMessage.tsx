import type { SDKSystemMessage } from "@anthropic-ai/claude-agent-sdk"

interface SystemMessageProps {
  content: SDKSystemMessage
}

export function SystemMessage({ content }: SystemMessageProps) {
  return (
    <div className="py-2 mb-4 text-sm text-gray-600">
      <div className="mb-1 normal-case tracking-normal">System Initialized</div>
      <div className="space-y-1 text-xs normal-case tracking-normal">
        <div>
          <span>Model:</span>
          <span className="ml-1">{content.model}</span>
        </div>
        <div>
          <span>Directory:</span>
          <span className="ml-1">{content.cwd}</span>
        </div>
        <div>
          <span>Tools:</span>
          <span className="ml-1">{content.tools?.length || 0} available</span>
        </div>
        {content.claude_code_version && (
          <div>
            <span>Version:</span>
            <span className="ml-1">{content.claude_code_version}</span>
          </div>
        )}
      </div>
    </div>
  )
}

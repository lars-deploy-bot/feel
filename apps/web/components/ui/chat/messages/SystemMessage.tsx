import type { SDKSystemMessage } from "@anthropic-ai/claude-agent-sdk"

interface SystemMessageProps {
  content: SDKSystemMessage
}

export function SystemMessage({ content }: SystemMessageProps) {
  return (
    <div className="py-2 mb-4 text-sm text-black/60">
      <div className="mb-1.5 font-medium normal-case tracking-normal">System Initialized</div>
      <div className="space-y-1 text-xs font-normal normal-case tracking-normal">
        <div>
          <span className="font-medium">Model:</span>
          <span className="ml-1">{content.model}</span>
        </div>
        <div>
          <span className="font-medium">Directory:</span>
          <span className="ml-1">{content.cwd}</span>
        </div>
        <div>
          <span className="font-medium">Tools:</span>
          <span className="ml-1">{content.tools?.length || 0} available</span>
        </div>
        {content.claude_code_version && (
          <div>
            <span className="font-medium">Version:</span>
            <span className="ml-1">{content.claude_code_version}</span>
          </div>
        )}
      </div>
    </div>
  )
}

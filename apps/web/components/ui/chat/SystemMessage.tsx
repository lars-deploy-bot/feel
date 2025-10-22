import { SDKSystemMessage } from '@anthropic-ai/claude-agent-sdk'
import { Text } from '../Typography'

interface SystemMessageProps {
  content: SDKSystemMessage
}

export function SystemMessage({ content }: SystemMessageProps) {
  return (
    <div className="message message-system">
      <Text as="div" size="sm" weight="light" transform="none" className="mb-1">
        System Initialized
      </Text>
      <div className="space-y-1">
        <div>
          <Text as="span" size="xs" weight="light" transform="none">Model:</Text>
          <Text as="span" size="xs" transform="none" className="ml-1">{content.model}</Text>
        </div>
        <div>
          <Text as="span" size="xs" weight="light" transform="none">Directory:</Text>
          <Text as="span" size="xs" transform="none" className="ml-1">{content.cwd}</Text>
        </div>
        <div>
          <Text as="span" size="xs" weight="light" transform="none">Tools:</Text>
          <Text as="span" size="xs" transform="none" className="ml-1">{content.tools?.length || 0} available</Text>
        </div>
        {content.claude_code_version && (
          <div>
            <Text as="span" size="xs" weight="light" transform="none">Version:</Text>
            <Text as="span" size="xs" transform="none" className="ml-1">{content.claude_code_version}</Text>
          </div>
        )}
      </div>
    </div>
  )
}
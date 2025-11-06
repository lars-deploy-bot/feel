# Message Handling

## Files

- `features/chat/lib/message-parser.ts` – Tool tracking
- `features/chat/lib/message-grouper.ts` – Message grouping
- `features/chat/lib/message-renderer.tsx` – UI routing

## Tool Tracking

SDK sends tool invocations and results in separate messages:

```typescript
const toolUseMap = new Map<string, string>()

// Assistant message with tool_use: store mapping
if (content.type === 'tool_use') {
  toolUseMap.set(content.id, content.name)  // "tool_1" → "Read"
}

// User message with tool_result: lookup tool name
if (content.type === 'tool_result') {
  const toolName = toolUseMap.get(content.tool_use_id)
  item.tool_name = toolName  // For ToolOutputRouter
}
```

## Message Grouping

Separate text messages from thinking/tool groups:

```typescript
function isTextMessage(msg) {
  if (msg.type === 'user') return true
  if (msg.type === 'sdk_message' && msg.content?.type === 'assistant') {
    const content = msg.content.message?.content
    return content?.length === 1 && content[0]?.type === 'text'
  }
  return false
}
```

**Logic:**
- Text message → Standalone group `{ type: 'text', messages: [msg], isComplete: true }`
- Non-text → Accumulate in `currentThinkingGroup`
- Next text or completion → Flush accumulated group
- Completion message → Group with `isComplete: true`

**Example:**

Input:
```
1. assistant (thinking + tool_use)
2. user (tool_result)
3. assistant (single text: "Done!")
4. complete
```

Output:
```
1. { type: 'thinking', messages: [1, 2], isComplete: false }
2. { type: 'text', messages: [3], isComplete: true }
3. { type: 'complete', messages: [4], isComplete: true }
```

## UI Routing

Route each message type to component via `getMessageComponentType()`:

```typescript
const getMessageComponentType = (message) => {
  const { type, content } = message

  if (type === 'user') return 'user'
  if (type === 'start') return 'start'
  if (type === 'complete') return 'complete'

  if (type === 'sdk_message' && content?.type === 'system') return 'system'
  if (type === 'sdk_message' && content?.type === 'assistant') return 'assistant'
  if (type === 'sdk_message' && content?.type === 'user') return 'tool_result'
  if (type === 'result') return 'result'

  return 'unknown'
}
```

**Components:**

| Type | Component | Purpose |
|---|---|---|
| user | UserMessage | User input (right-aligned) |
| start | StartMessage | Debug info (host, cwd, messageLength) |
| system | SystemMessage | System-level messages |
| assistant | AssistantMessage | Model output + tool blocks |
| tool_result | ToolResultMessage | Tool execution results |
| result | ResultMessage | Final SDK result |
| complete | CompleteMessage | Completion summary |
| unknown | JSON dump | Fallback |

## Tool Output Routing

Within AssistantMessage, tool blocks routed via `ToolInputRouter`:

```typescript
switch (toolName) {
  case 'Read': return <ReadToolInput />
  case 'Write': return <WriteToolInput />
  case 'Edit': return <EditToolInput />
  case 'Glob': return <GlobToolInput />
  case 'Grep': return <GrepToolInput />
  default: return <DefaultToolInput />
}
```

Tool results routed via `ToolOutputRouter` similarly.

## Key Types

```typescript
interface UIMessage {
  type: 'user' | 'sdk_message' | 'start' | 'result' | 'complete'
  content: any
}

interface MessageGroup {
  type: 'text' | 'thinking' | 'complete' | 'unknown'
  messages: UIMessage[]
  isComplete: boolean
}
```

## Testing Message Flow

**Verify tool tracking:**
- [ ] Assistant message with tool_use stored in map
- [ ] User message with tool_result finds name in map
- [ ] Tool result component renders with correct tool name
- [ ] Missing tool_use_id doesn't crash (graceful fallback)

**Verify message grouping:**
- [ ] Consecutive text messages create separate groups
- [ ] Thinking + tool + result grouped together
- [ ] Text between tool messages flushes group
- [ ] Completion message marks group as complete

**Verify UI routing:**
- [ ] Each message type renders correct component
- [ ] Tool blocks routed to ToolInputRouter
- [ ] Tool results routed to ToolOutputRouter
- [ ] Unknown types fallback to JSON dump

**Debug tips:**
- Add console.log in isTextMessage() to see discrimination
- Log toolUseMap contents to verify tool tracking
- Check MessageGroup[] in React DevTools state
- Inspect component rendering in browser DevTools

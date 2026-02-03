# Message Handling Architecture

**Guide Type**: Architecture Reference
**Last Updated**: 2025-01-12

## Overview

The message handling system processes user messages, attachments, and Claude responses through a multi-stage pipeline involving parsing, grouping, and rendering.

## Message Flow

```
User Input → Attachments → Prompt Builder → Claude SDK
                                ↓
                         SSE Stream Events
                                ↓
                         Message Parser
                                ↓
                         Message Grouper
                                ↓
                         Message Renderer
                                ↓
                            UI Display
```

## Attachment System

### Attachment Types

**Location**: `features/chat/components/ChatInput/types.ts`

```typescript
export type Attachment =
  | FileUploadAttachment    // Files being uploaded
  | LibraryImageAttachment  // Images from photobook library
  | SuperTemplateAttachment // SuperTemplate components
  | UserPromptAttachment    // Pre-configured prompts
```

#### 1. FileUploadAttachment

Temporary attachment during upload process:

```typescript
interface FileUploadAttachment {
  kind: "file-upload"
  file: File
  category: FileCategory // "image" | "document"
  preview?: string // Blob URL
  uploadProgress?: number
}
```

**Lifecycle**:
1. User drops/selects file
2. Creates blob preview for instant display
3. Uploads to server
4. Converts to `LibraryImageAttachment` after upload
5. Blob URL revoked

#### 2. LibraryImageAttachment

Images already uploaded to photobook:

```typescript
interface LibraryImageAttachment {
  kind: "library-image"
  photobookKey: string // "domain/hash"
  preview?: string // URL to w640 variant
}
```

**Purpose**: Only `library-image` attachments are sent to Claude SDK.

#### 3. SuperTemplateAttachment

Component templates from Alive Super Templates:

```typescript
interface SuperTemplateAttachment {
  kind: "supertemplate"
  templateId: string // e.g., "carousel-thumbnails-v1.0.0"
  name: string
  preview?: string // Template preview image
}
```

**Behavior**: Triggers MCP tool when sent to Claude.

#### 4. UserPromptAttachment

Pre-configured prompt templates:

```typescript
interface UserPromptAttachment {
  kind: "user-prompt"
  promptType: string // e.g., "revise-code", "organize-code"
  data: string // Full prompt text (sent to SDK)
  displayName: string // "Revise Code"
  userFacingDescription?: string // Short UI description
}
```

**Dual-View**: UI shows `userFacingDescription`, SDK receives `data`.

See [User Prompts Feature](../features/user-prompts.md) for details.

### Attachment Management

**Hook**: `features/chat/components/ChatInput/hooks/useAttachments.ts`

#### Adding Attachments

```typescript
const {
  addAttachment,        // Add file (creates FileUploadAttachment)
  addPhotobookImage,    // Add from library (creates LibraryImageAttachment)
  addSuperTemplateAttachment, // Add template
  addUserPrompt,        // Add prompt template
  removeAttachment,     // Remove by ID
  clearAttachments      // Clear all
} = useAttachments(config)
```

#### Duplicate Detection

**File Uploads**: Hash-based duplicate detection
```typescript
const hash = await hashFile(file)
const existingImage = images.find(img => img.key.includes(hash))
```

**Library Images**: Key-based duplicate detection
```typescript
if (attachments.some(a => isLibraryImage(a) && a.photobookKey === imageKey))
```

**User Prompts**: Type-based duplicate detection
```typescript
if (attachments.some(a => isUserPromptAttachment(a) && a.promptType === promptType))
```

**SuperTemplates**: ID-based duplicate detection
```typescript
if (attachments.some(a => isSuperTemplateAttachment(a) && a.templateId === templateId))
```

## Prompt Building

**Location**: `features/chat/utils/prompt-builder.ts`

### Build Order

```typescript
export function buildPromptWithAttachments(message: string, attachments: Attachment[]): string {
  // 1. User prompts (prepended at beginning)
  const userPrompts = attachments.filter(a => a.kind === "user-prompt")

  // 2. User message

  // 3. Library images (appended as base64)
  const libraryImages = attachments.filter(a => a.kind === "library-image")

  // 4. SuperTemplates (appended as MCP triggers)
  const supertemplates = attachments.filter(a => a.kind === "supertemplate")
}
```

### Example Output

```
[USER PROMPT: Revise code checklist...]

User's actual message here

[Image: base64...]

[SuperTemplate: carousel-thumbnails-v1.0.0]
```

**Important**: Only `library-image` attachments are sent as images. `file-upload` attachments must be converted first.

## Tool Tracking

**Location**: `features/chat/lib/message-parser.ts`

### Problem

Claude SDK returns interleaved messages:

```
1. Assistant: text + tool_use
2. User: tool_result
3. Assistant: text + tool_use
4. User: tool_result
```

Tool results don't include the tool name, only `tool_use_id`.

### Solution

Global `toolUseMap` tracks tool names:

```typescript
const toolUseMap = new Map<string, string>()

// When assistant message has tool_use
if (content.type === "tool_use") {
  toolUseMap.set(content.id, content.name)
}

// When user message has tool_result
if (content.type === "tool_result") {
  const toolName = toolUseMap.get(content.tool_use_id)
}
```

**Why Global?**: Messages arrive across multiple function calls. Can't use local state.

## Message Grouping

**Location**: `features/chat/lib/message-grouper.ts`

### Grouping Strategy

Groups consecutive messages by role and thinking state:

```typescript
type MessageGroup = {
  role: "user" | "assistant"
  messages: UIMessage[]
  isThinking?: boolean
}
```

### Rules

1. **Consecutive Same Role**: Group together
2. **Thinking Messages**: Separate group
3. **Tool Messages**: Group with thinking
4. **Text Messages**: Separate from tools

### Example

**Input**:
```
[assistant] text
[assistant] thinking
[assistant] tool_use
[user] tool_result
[assistant] text
```

**Output**:
```
Group 1: [assistant text]
Group 2: [assistant thinking, assistant tool_use, user tool_result]
Group 3: [assistant text]
```

## Message Rendering

**Location**: `features/chat/lib/message-renderer.tsx`

### Renderer Dispatch

```typescript
export function renderMessage(msg: UIMessage, ...): ReactNode {
  switch (msg.type) {
    case "user": return <UserMessage />
    case "assistant": return <AssistantMessage />
    case "tool_result": return <ToolResultMessage />
    case "thinking": return <ThinkingMessage />
    case "result": return <ResultMessage />
    case "complete": return <CompleteMessage />
    case "error": return <ErrorMessage />
    default: return <SystemMessage />
  }
}
```

### Component Files

**Location**: `features/chat/components/message-renderers/`

- `UserMessage.tsx`: User messages with attachments
- `AssistantMessage.tsx`: Claude responses with markdown
- `ToolResultMessage.tsx`: Tool execution results
- `ThinkingMessage.tsx`: Claude's thinking process
- `ChatAttachments.tsx`: Attachment display in messages

## Attachment Display

### In Input Bar (Before Sending)

**Component**: `PromptBarAttachmentGrid.tsx`

Shows attachments with remove button:
- Images: Thumbnail preview
- SuperTemplates: Template preview
- User Prompts: Icon + displayName
- Upload progress bars

### In Messages (After Sending)

**Component**: `ChatAttachments.tsx`

Shows attachments in sent messages:
- **Images**: Grid of thumbnails
- **SuperTemplates**: Template card with name + ID
- **User Prompts**: Purple gradient card with description

**Key Behavior**: User prompts show `userFacingDescription` (not full `data`)

```typescript
<p className="text-sm">
  {prompt.userFacingDescription || prompt.data}
</p>
```

## Type Guards

**Location**: `features/chat/components/ChatInput/types.ts`

Safely narrow attachment types:

```typescript
export function isFileUpload(attachment: Attachment): attachment is FileUploadAttachment
export function isLibraryImage(attachment: Attachment): attachment is LibraryImageAttachment
export function isSuperTemplateAttachment(attachment: Attachment): attachment is SuperTemplateAttachment
export function isUserPromptAttachment(attachment: Attachment): attachment is UserPromptAttachment

// Combined guards
export function isImageAttachment(attachment: Attachment): boolean
export function isDocumentAttachment(attachment: Attachment): boolean
```

## Performance Considerations

### Blob URL Management

**Problem**: Blob URLs leak memory if not revoked.

**Solution**: Revoke immediately after conversion or removal

```typescript
function revokeBlobUrl(url: string | undefined): void {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

// When converting file-upload → library-image
revokeBlobUrl(attachment.preview)

// When removing attachment
const attachment = attachments.find(a => a.id === id)
if (attachment && isFileUpload(attachment)) {
  revokeBlobUrl(attachment.preview)
}
```

### Duplicate Detection Efficiency

**Hash-based** (files): O(1) lookup in image store
**Key-based** (library): O(n) scan through attachments
**Type-based** (prompts): O(n) scan through attachments

**Optimization**: Could use Set for O(1) duplicate checks.

## Testing

### Unit Tests

- `prompt-builder.test.ts`: Attachment ordering and content
- Need: Attachment hooks tests
- Need: Message grouper tests

### Integration Tests

- Should test full flow: attach → build → send → display
- Should test duplicate detection
- Should test blob URL cleanup

## Common Patterns

### Adding New Attachment Type

1. Add interface to `types.ts`:
```typescript
export interface MyAttachment extends BaseAttachment {
  kind: "my-type"
  // ... fields
}
```

2. Add to union type:
```typescript
export type Attachment = ... | MyAttachment
```

3. Add type guard:
```typescript
export function isMyAttachment(a: Attachment): a is MyAttachment {
  return a.kind === "my-type"
}
```

4. Add hook method in `useAttachments.ts`:
```typescript
const addMyAttachment = useCallback((data) => {
  const attachment: MyAttachment = { kind: "my-type", ... }
  setAttachments(prev => [...prev, attachment])
}, [])
```

5. Handle in `prompt-builder.ts`:
```typescript
const myAttachments = attachments.filter(a => a.kind === "my-type")
// ... append to prompt
```

6. Render in `ChatAttachments.tsx`:
```typescript
const myAttachments = attachments.filter((a): a is MyAttachment => a.kind === "my-type")
// ... render
```

## Error Handling

### Upload Failures

```typescript
setAttachments(prev =>
  prev.map(a =>
    a.id === attachment.id
      ? { ...a, error: "Upload failed", uploadProgress: 0 }
      : a
  )
)
```

**UI**: Shows red border and "Upload failed" text.

### Duplicate Attachments

**Pattern**: Show toast error, don't add to list

```typescript
if (/* duplicate detected */) {
  config.onMessage?.("Already attached", "error")
  return
}
```

### Max Attachments

```typescript
if (config.maxAttachments && attachments.length >= config.maxAttachments) {
  config.onMessage?.(`Maximum ${config.maxAttachments} attachments allowed`, "error")
  return
}
```

## Related Documentation

- [User Prompts Feature](../features/user-prompts.md) - Detailed prompt system docs
- [Streaming Architecture](../streaming/cancellation-architecture.md) - SSE event flow
- [Workspace Privilege Separation](./workspace-privilege-separation.md) - File operation security

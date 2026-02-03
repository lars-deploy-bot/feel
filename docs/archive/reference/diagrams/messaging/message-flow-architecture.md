# Message Flow Architecture

**Context:** Complete reference diagram for Claude Bridge messaging system
**Date:** 2025-11-25
**Type:** ASCII Architecture Diagram

## Overview

This diagram documents the complete message flow architecture in Claude Bridge, from SDK messages through stream processing to UI rendering. It covers:

- Message type taxonomy (SDK → UI)
- Parsing pipeline (`parseStreamEvent`)
- Grouping logic (`groupMessages`)
- Classification and visibility rules
- Tool use/result correlation
- Component rendering mapping
- Debug mode behavior

## Diagram

```
Messaging Logic Diagram

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                           MESSAGE FLOW OVERVIEW                              │
  └──────────────────────────────────────────────────────────────────────────────┘

    Claude SDK                    Stream Route                  Client
    ──────────                    ────────────                  ──────
        │                              │                            │
        │  SDK Messages (NDJSON)       │                            │
        │  - system                    │                            │
        │  - assistant                 │                            │
        │  - user (tool_result)        │                            │
        │  - result                    │                            │
        │──────────────────────────────▶                            │
        │                              │                            │
        │                              │  Bridge Events (NDJSON)    │
        │                              │  - bridge_start            │
        │                              │  - bridge_message          │
        │                              │  - bridge_warning (oauth)  │
        │                              │  - bridge_complete         │
        │                              │  - bridge_error            │
        │                              │  - bridge_ping (filtered)  │
        │                              │  - bridge_done             │
        │                              │──────────────────────────▶│
        │                              │                            │
        │                              │                     parseStreamEvent()
        │                              │                            │
        │                              │                      UIMessage[]
        │                              │                            │
        │                              │                     groupMessages()
        │                              │                            │
        │                              │                     MessageGroup[]
        │                              │                            │
        │                              │                     ThinkingGroup
        │                              │                       + renderMessage()

  ---
  Message Type Taxonomy

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                            SDK MESSAGE TYPES                                 │
  │                        (from Claude Agent SDK)                               │
  └──────────────────────────────────────────────────────────────────────────────┘

  SDK Message
  ├── SDKSystemMessage        type: "system"
  │   └── subtype: "init" | "compact_boundary"
  │
  ├── SDKAssistantMessage     type: "assistant"
  │   └── message.content[]
  │       ├── TextBlock       type: "text"
  │       └── ToolUseBlock    type: "tool_use" → {id, name, input}
  │
  ├── SDKUserMessage          type: "user"
  │   └── message.content[]
  │       └── ToolResultBlock type: "tool_result" → {tool_use_id, content, is_error}
  │
  └── SDKResultMessage        type: "result"
      └── {is_error, result, error_code}


  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                             UI MESSAGE TYPES                                 │
  │                     (after parseStreamEvent())                               │
  └──────────────────────────────────────────────────────────────────────────────┘

  UIMessage.type
  ├── "user"              → Human input
  ├── "start"             → Stream initialization
  ├── "sdk_message"       → Wrapped SDK message (most common)
  ├── "result"            → Execution result
  ├── "complete"          → Stream finished
  ├── "compact_boundary"  → Context compaction marker
  └── "interrupt"         → User cancelled / connection lost

  ---
  Parsing Pipeline

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                   parseStreamEvent() - message-parser.ts:74                  │
  └──────────────────────────────────────────────────────────────────────────────┘

    Stream Event
         │
         ▼
    ┌────────────────┐
    │ Event Type?    │
    └────────────────┘
         │
         ├─▶ bridge_start     → UIMessage{type: "start"}
         │
         ├─▶ bridge_message   → ┌─────────────────────────────────────┐
         │                      │ SDK Message Processing               │
         │                      │                                      │
         │                      │ 1. Check compact_boundary subtype    │
         │                      │    → UIMessage{type: "compact_boundary"}
         │                      │                                      │
         │                      │ 2. If assistant + tool_use:          │
         │                      │    recordToolUse(convId, id, name)   │
         │                      │    (stores in streamingStore)        │
         │                      │                                      │
         │                      │ 3. If user + tool_result:            │
         │                      │    Augment with tool_name/input      │
         │                      │    from streamingStore               │
         │                      │                                      │
         │                      │ → UIMessage{type: "sdk_message"}     │
         │                      └─────────────────────────────────────┘
         │
         ├─▶ bridge_complete  → UIMessage{type: "complete"}
         │
         ├─▶ bridge_error     → UIMessage{type: "sdk_message",
         │                               content: {is_error: true, ...}}
         │                      (Converts to fake result for display)
         │
         ├─▶ bridge_warning   → ┌─────────────────────────────────────┐
         │                      │ OAuth Warning Processing             │
         │                      │                                      │
         │                      │ Synthetic message for user alerts    │
         │                      │ (e.g., expired OAuth tokens)         │
         │                      │                                      │
         │                      │ Chat UI displays toast notification  │
         │                      │ with action button ("Reconnect")     │
         │                      │                                      │
         │                      │ → Handled separately from UIMessage  │
         │                      │   (triggers toast, not rendered)     │
         │                      └─────────────────────────────────────┘
         │
         ├─▶ bridge_ping      → null (filtered out)
         │
         ├─▶ bridge_done      → UIMessage{type: "complete"}
         │
         └─▶ bridge_interrupt → UIMessage{type: "interrupt"}

  ---
  Message Grouping

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                      groupMessages() - message-grouper.ts                    │
  └──────────────────────────────────────────────────────────────────────────────┘

    UIMessage[]                           MessageGroup[]
         │                                     │
         │   Rules:                            │
         │   ─────                             │
         │   • Text/Error → standalone         │
         │     group, type: "text"             │
         │                                     │
         │   • Everything else →               │
         │     accumulate in "thinking"        │
         │                                     │
         │   • Complete message →              │
         │     flush thinking as complete      │
         │                                     │
         ▼                                     ▼

    Example:
    ────────
    [start, system, assistant, tool_result, complete]
                │
                ▼
    Group 1: {type: "thinking", messages: [start, system, assistant], isComplete: true}
    Group 2: {type: "text", messages: [tool_result], isComplete: true}

    Note: "complete" message flushes the thinking group

  ---
  Classification Logic (ThinkingGroup Display)

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │              classifyMessage() - message-classifier.ts:34                    │
  └──────────────────────────────────────────────────────────────────────────────┘

    Input: UIMessage, isDebugMode
    Output: "tool_result" | "thinking" | "hidden"

                        ┌─────────────────┐
                        │ Component Type? │
                        └─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
    TOOL_RESULT             COMPLETE               RESULT
        │                       │                       │
        │                       │                       ├─▶ is_error?
        ▼                       ▼                       │   Yes → "tool_result"
    "tool_result"           "hidden"                   │   No + debug → "thinking"
    (always shown)          (never shown)              │   No + normal → "hidden"
                                                       │
                                                       ▼
                                                 ASSISTANT
                                                       │
                                                       ├─▶ debug? → "thinking"
                                                       └─▶ normal? → "hidden"

                                                 Everything else
                                                       │
                                                       ▼
                                                  "thinking"


    ┌──────────────────────────────────────────────────────────────────────────┐
    │                          DISPLAY MATRIX                                  │
    ├──────────────────┬────────────────────────┬─────────────────────────────┤
    │  Component Type  │   Normal Mode          │   Debug Mode                │
    ├──────────────────┼────────────────────────┼─────────────────────────────┤
    │  TOOL_RESULT     │   ✓ Shown (expandable) │   ✓ Shown (expandable)      │
    │  ASSISTANT       │   ✗ Hidden             │   ✓ In thinking wrapper     │
    │  SYSTEM          │   ✓ In thinking wrapper│   ✓ In thinking wrapper     │
    │  START           │   ✓ In thinking wrapper│   ✓ In thinking wrapper     │
    │  RESULT          │   ✗ Hidden (unless err)│   ✓ In thinking wrapper     │
    │  RESULT (error)  │   ✓ Shown directly     │   ✓ Shown directly          │
    │  COMPLETE        │   ✗ Hidden             │   ✗ Hidden                  │
    └──────────────────┴────────────────────────┴─────────────────────────────┘

  ---
  ThinkingGroup Component Rendering

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                   ThinkingGroup.tsx - Main Rendering Flow                    │
  └──────────────────────────────────────────────────────────────────────────────┘

    ThinkingGroup({messages, isComplete})
                  │
                  │ 1. Split messages
                  ▼
    ┌─────────────────────────────────────────────────┐
    │  toolResults = getToolResults(messages)         │ ← Always shown
    │  thinkingContent = getThinkingContent(          │
    │                      messages, isDebugMode)     │ ← Debug-dependent
    └─────────────────────────────────────────────────┘
                  │
                  │ 2. Render structure
                  ▼
    ┌──────────────────────────────────────────────────────────────────────┐
    │  <div className="my-4">                                              │
    │                                                                      │
    │    ┌────────────────────────────────────────────────────────┐       │
    │    │ TOOL RESULTS (render directly with own expand/collapse) │       │
    │    │                                                         │       │
    │    │   {toolResults.map(msg => renderMessage(msg))}         │       │
    │    │                                                         │       │
    │    │   Each tool result has its own ToolResult component     │       │
    │    │   with expand/collapse button                           │       │
    │    └────────────────────────────────────────────────────────┘       │
    │                                                                      │
    │    ┌────────────────────────────────────────────────────────┐       │
    │    │ THINKING WRAPPER (collapsible)                          │       │
    │    │                                                         │       │
    │    │   <button onClick={toggle}>                             │       │
    │    │     {!isComplete && <ThinkingSpinner />}                │       │
    │    │     {isComplete ? "thought" : "thinking"}               │       │
    │    │     {isDebugMode && `(${thinkingContent.length})`}      │       │
    │    │   </button>                                             │       │
    │    │                                                         │       │
    │    │   {isExpanded && (                                      │       │
    │    │     <div className="border-l-2 pl-4">                   │       │
    │    │       {thinkingContent.map(msg => renderMessage(msg))}  │       │
    │    │     </div>                                              │       │
    │    │   )}                                                    │       │
    │    └────────────────────────────────────────────────────────┘       │
    │                                                                      │
    │  </div>                                                              │
    └──────────────────────────────────────────────────────────────────────┘


    Visual States:
    ──────────────

    Streaming (isComplete=false):
    ┌────────────────────────────┐
    │ ◌ thinking                 │  ← Spinner animating
    └────────────────────────────┘

    Complete (isComplete=true):
    ┌────────────────────────────┐
    │ thought                    │  ← Static text, clickable
    └────────────────────────────┘

    Complete + Debug Mode:
    ┌────────────────────────────┐
    │ thought (3)                │  ← Shows count of thinking messages
    └────────────────────────────┘

    Expanded:
    ┌────────────────────────────┐
    │ thought                    │
    │ │                          │
    │ │  SystemMessage           │  ← Blue left border, indented
    │ │  AssistantMessage        │
    │ │  ...                     │
    └────────────────────────────┘

  ---
  Tool Use ↔ Tool Result Tracking

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                    TOOL USE/RESULT CORRELATION                               │
  │                    (per-conversation tracking)                               │
  └──────────────────────────────────────────────────────────────────────────────┘

    Problem: SDK's tool_result doesn't include tool_name or tool_input
             We need this for proper UI rendering

    Solution: Track tool_use → tool_result correlation per conversation

                   Assistant Message                    User Message
                   ─────────────────                    ────────────
                   content: [                          content: [
                     {                                   {
                       type: "tool_use",                  type: "tool_result",
    ┌───────────────── id: "toolu_123",  ─────┐           tool_use_id: "toolu_123",
    │                  name: "Read",          │           content: "file contents..."
    │                  input: {path: "/x"}    │         }
    │                }                        │        ]
    │              ]                          │
    │                                         │
    │  streamingStore.recordToolUse()         │  streamingStore.getToolName()
    │  ─────────────────────────────          │  streamingStore.getToolInput()
    │                                         │  ─────────────────────────────
    │  toolUseMap[convId] = {                 │
    │    "toolu_123": {                       │  → Augments tool_result with:
    │      name: "Read",          ────────────┤     tool_name: "Read"
    │      input: {path: "/x"}    ────────────┤     tool_input: {path: "/x"}
    │    }                                    │
    │  }                                      │
    └─────────────────────────────────────────┘

    Result: ToolResultMessage can display:
            • Tool name (Read, Edit, Bash, etc.)
            • Tool input context (e.g., what file was being read)
            • Proper preview text

  ---
  Component Type → Renderer Mapping

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │               renderMessage() - message-renderer.tsx                         │
  └──────────────────────────────────────────────────────────────────────────────┘

    COMPONENT_TYPE          React Component              Notes
    ──────────────          ───────────────              ─────
    USER                →   UserMessage                  Human input + attachments
    START               →   StartMessage                 Stream init metadata
    SYSTEM              →   SystemMessage                Model, cwd, tools (debug only)
    ASSISTANT           →   AssistantMessage             Tool invocations (debug only)
    TOOL_RESULT         →   ToolResultMessage            Expandable tool outputs
    RESULT              →   ResultMessage                SDK execution results
    COMPLETE            →   CompleteMessage              Stream completion
    COMPACT_BOUNDARY    →   CompactBoundaryMessage       Context compaction marker
    INTERRUPT           →   InterruptMessage             Cancellation notice

    Special case:
    ─────────────
    sdk_message + isErrorResultMessage() → ErrorResultMessage
    (Checked before component type routing)

  ---
  Debug Mode Summary

  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                          DEBUG MODE BEHAVIOR                                 │
  │                         (debug-store.ts)                                     │
  └──────────────────────────────────────────────────────────────────────────────┘

    useDebugVisible() = isDevelopment() && isDebugView
                        ─────────────     ───────────
                             │                │
                             │                └─ User toggle (UI button)
                             │
                             └─ NODE_ENV === "development"
                                OR hostname contains "staging"

    ┌────────────────────────────────────────────────────────────────────────┐
    │  Normal Mode                    │  Debug Mode                          │
    ├─────────────────────────────────┼──────────────────────────────────────┤
    │  Tool results shown             │  Tool results shown                  │
    │  Text messages shown            │  Text messages shown                 │
    │  "thought" label (collapsed)    │  "thought (3)" label with count      │
    │  ───────────────────────────────│──────────────────────────────────────│
    │  Assistant messages HIDDEN      │  Assistant messages VISIBLE          │
    │  Result messages HIDDEN         │  Result messages VISIBLE             │
    │  System messages minimal        │  System messages with full details   │
    │                                 │  (model, cwd, tools count)           │
    └─────────────────────────────────┴──────────────────────────────────────┘

  ---
  Key Files Reference

  | File                        | Purpose                                                  |
  |-----------------------------|----------------------------------------------------------|
  | message-parser.ts:74-222    | parseStreamEvent() - converts stream events to UIMessage |
  | message-parser.ts:259-278   | getMessageComponentType() - routes to correct renderer   |
  | message-grouper.ts:11-57    | groupMessages() - creates thinking/text groups           |
  | message-classifier.ts:34-63 | classifyMessage() - decides visibility by category       |
  | message-renderer.tsx:25-81  | renderMessage() - maps to React components               |
  | ThinkingGroup.tsx:22-73     | Renders thinking wrapper with expand/collapse            |
  | debug-store.ts:127-138      | useDebugVisible() - debug mode logic                     |
```

## Key Insights

### 1. Separation of Concerns

The architecture cleanly separates:
- **Parsing** (stream events → UI messages)
- **Grouping** (thinking vs. text/error groups)
- **Classification** (visibility decisions)
- **Rendering** (React components)

### 2. Tool Correlation Pattern

The system uses a per-conversation map to track tool invocations (`tool_use`) and match them with their results (`tool_result`). This is necessary because the SDK's `tool_result` messages don't include the tool name or input, which are needed for proper UI rendering.

### 3. Debug Mode Toggle

Debug mode is controlled by two factors:
1. Environment (development or staging)
2. User preference (UI toggle)

This allows developers to see internal SDK messages while keeping the production UI clean.

### 4. Thinking Group Pattern

The ThinkingGroup component:
- Always renders tool results directly (with their own expand/collapse)
- Wraps internal messages in a collapsible "thinking" section
- Shows a spinner while streaming, "thought" when complete
- Only populates thinking content in debug mode

## Related Documentation

- [Architecture](../../architecture/README.md) - System design patterns
- [Message Types](../../features/message-types.md) - Detailed type documentation (if exists)
- [UI Components](../../components/README.md) - Component structure (if exists)

## Usage Notes

This diagram should be updated when:
- New SDK message types are added
- UI message types change
- Grouping or classification logic is modified
- New rendering components are introduced
- Tool correlation strategy changes

# Messaging System Diagrams

Architecture diagrams and flow documentation for the Claude Bridge messaging system.

## Overview

The messaging system handles the flow of data from the Claude SDK through stream processing to UI rendering. It includes:

- **Message parsing** - Converting SDK messages to UI-friendly formats
- **Message grouping** - Organizing messages into thinking/text groups
- **Message classification** - Determining visibility based on debug mode
- **Tool correlation** - Tracking tool use/result relationships
- **Component rendering** - Mapping messages to React components

## Available Diagrams

### Core Architecture

- **[Message Flow Architecture](./message-flow-architecture.md)** - Complete ASCII diagram showing the entire message pipeline from SDK to UI, including:
  - Message type taxonomy (SDK → UI)
  - Parsing pipeline (`parseStreamEvent`)
  - Grouping logic (`groupMessages`)
  - Classification and visibility rules
  - Tool use/result correlation
  - Component rendering mapping
  - Debug mode behavior

## Key Concepts

### Message Types

The system distinguishes between:
1. **SDK Messages** - Raw messages from Claude Agent SDK (system, assistant, user, result)
2. **UI Messages** - Parsed messages ready for UI consumption (user, start, sdk_message, result, complete, compact_boundary, interrupt)
3. **Message Groups** - Collections of messages for rendering (thinking groups vs. text/error groups)

### Tool Correlation

Tool use messages (`tool_use`) are tracked in a per-conversation map and correlated with their results (`tool_result`) to enable proper UI rendering with tool names and inputs.

### Debug Mode

Debug mode reveals internal SDK messages (assistant messages, system messages, results) that are normally hidden from users. It's controlled by:
- Environment (development/staging)
- User preference (UI toggle)

## Related Documentation

- [Architecture](../../architecture/README.md) - System design patterns
- [Security](../../security/README.md) - Security flows
- [Features](../../features/README.md) - Feature documentation

## File Organization

```
messaging/
├── README.md                      # This file
└── message-flow-architecture.md   # Complete message flow diagram
```

Future diagrams might include:
- Session management flow
- Credit deduction sequences
- Error handling paths
- Streaming protocol details

# Robust Claude Fixture System - Implementation Plan

> **Goal**: Build a production-grade fixture system with validation, realistic streaming, and excellent developer experience.

## Gaps in Current Design

### 1. StreamBuilder Limitations
- ❌ No chunk-by-chunk streaming simulation
- ❌ No partial content blocks
- ❌ No multi-message streaming patterns
- ❌ No validation that output matches production
- ❌ No support for complex tool chains

### 2. Handler Limitations
- ❌ No realistic network delays
- ❌ No network failure simulation (504, connection reset)
- ❌ No conditional responses based on input
- ❌ No stateful handlers (conversation memory)
- ❌ No progressive loading simulation

### 3. Fixture System Gaps
- ❌ No fixture validation against production types
- ❌ No fixture metadata (tags, descriptions, use cases)
- ❌ No fixture discovery/search
- ❌ No fixture versioning/updates
- ❌ No automated fixture testing
- ❌ No fixture composition patterns

### 4. Developer Experience Gaps
- ❌ No fixture preview/inspection
- ❌ No fixture comparison tools
- ❌ No fixture generation helpers
- ❌ No fixture usage analytics
- ❌ Limited IDE support

---

## Enhanced Architecture

### Core Components

```
apps/web/lib/
├── fixtures/
│   ├── core/
│   │   ├── stream-builder.ts        # Enhanced StreamBuilder
│   │   ├── stream-validator.ts      # Validate fixtures
│   │   ├── stream-renderer.ts       # Chunk-by-chunk simulation
│   │   └── fixture-metadata.ts      # Metadata types
│   ├── library/
│   │   ├── simple/                  # Basic responses
│   │   ├── tools/                   # Tool usage
│   │   ├── errors/                  # Error cases
│   │   ├── streaming/               # Complex streams
│   │   ├── network/                 # Network failures
│   │   └── scenarios/               # Multi-step workflows
│   ├── registry.ts                  # Fixture discovery
│   ├── validator.ts                 # Test fixtures
│   └── index.ts
├── mocks/
│   ├── browser.ts                   # MSW setup
│   ├── handlers/
│   │   ├── claude-stream.ts         # Main handler
│   │   ├── conditional.ts           # Input-based responses
│   │   ├── stateful.ts              # Conversation memory
│   │   └── network.ts               # Network simulation
│   └── dev-toolbar/
│       ├── FixtureSelector.tsx
│       ├── FixturePreview.tsx
│       ├── NetworkSimulator.tsx
│       └── ConversationState.tsx
└── test-utils/                      # Shared E2E utilities
    ├── stream-builder.ts            # Re-export from fixtures/core
    └── handlers.ts                  # Re-export for backward compat
```

---

## Enhanced StreamBuilder

### Features

1. **Chunk-by-chunk Streaming**
```typescript
// Simulate realistic SSE streaming with delays
builder
  .start()
  .textChunked('Hello ', 50)   // 50ms delay per chunk
  .textChunked('world!', 50)
  .complete()
```

2. **Partial Content Blocks**
```typescript
// Simulate thinking that updates progressively
builder
  .start()
  .thinkingPartial('Analyzing')      // First chunk
  .thinkingPartial('Analyzing...')   // Second chunk
  .thinkingPartial('Analyzing... Done!') // Final chunk
  .text('Here is the result')
  .complete()
```

3. **Tool Error Handling**
```typescript
// Tool can succeed or fail
builder
  .start()
  .tool('Read', { file_path: '/missing.txt' }, 'File not found', true) // isError=true
  .text('I could not read that file')
  .complete()
```

4. **Multi-Turn Conversations**
```typescript
// Simulate a conversation with multiple turns
builder
  .start()
  .turn(1, () => [
    builder.text('Let me read the file'),
    builder.tool('Read', { file_path: '/test.ts' }, 'const x = 1')
  ])
  .turn(2, () => [
    builder.text('Now let me edit it'),
    builder.tool('Edit', { file_path: '/test.ts', old_string: '1', new_string: '2' }, 'Edited')
  ])
  .turn(3, () => [
    builder.text('Done! I updated the file')
  ])
  .complete({ totalTurns: 3, maxTurns: 25 })
```

5. **Fixture Validation**
```typescript
// Validate fixture against production types
const fixture = builder.start().text('Hello').complete()

const result = validateFixture(fixture)
if (!result.valid) {
  throw new Error(`Invalid fixture: ${result.errors.join(', ')}`)
}
```

### Implementation

```typescript
// apps/web/lib/fixtures/core/stream-builder-enhanced.ts
import type { StreamEvent } from "@/features/chat/lib/streamHandler"
import { validateStreamEvent } from "./stream-validator"

interface ChunkConfig {
  delayMs: number
  chunkSize: number
}

interface FixtureMetadata {
  id: string
  name: string
  description: string
  tags: string[]
  category: string
  useCases: string[]
  createdAt: string
  version: string
}

export class EnhancedStreamBuilder {
  private events: StreamEvent[] = []
  private chunks: Array<{ event: StreamEvent; delayMs: number }> = []
  private msgCount = 0
  private turnCount = 0
  private metadata?: FixtureMetadata
  private validated = false

  constructor(metadata?: Partial<FixtureMetadata>) {
    if (metadata) {
      this.metadata = {
        id: metadata.id || `fixture-${Date.now()}`,
        name: metadata.name || 'Unnamed Fixture',
        description: metadata.description || '',
        tags: metadata.tags || [],
        category: metadata.category || 'uncategorized',
        useCases: metadata.useCases || [],
        createdAt: new Date().toISOString(),
        version: metadata.version || '1.0.0',
      }
    }
  }

  /**
   * Add metadata to fixture
   */
  withMetadata(metadata: Partial<FixtureMetadata>): this {
    this.metadata = { ...this.metadata!, ...metadata }
    return this
  }

  /**
   * Start event
   */
  start(cwd = "/test", host = "test"): this {
    const event: StreamEvent = {
      type: "start",
      requestId: "test-req-123",
      timestamp: new Date().toISOString(),
      data: {
        host,
        cwd,
        message: "Starting Claude query...",
        messageLength: 100,
        isResume: false,
      },
    }
    this.events.push(event)
    this.chunks.push({ event, delayMs: 0 })
    return this
  }

  /**
   * Add text with chunked streaming simulation
   */
  textChunked(content: string, options: ChunkConfig = { delayMs: 100, chunkSize: 10 }): this {
    const { delayMs, chunkSize } = options
    const words = content.split(' ')
    const chunks: string[] = []

    // Split into chunks
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '))
    }

    // Create event for each chunk
    chunks.forEach((chunk, index) => {
      this.msgCount++
      const event: StreamEvent = {
        type: "message",
        requestId: "test-req-123",
        timestamp: new Date().toISOString(),
        data: {
          messageCount: this.msgCount,
          messageType: "assistant",
          content: {
            uuid: `uuid-${this.msgCount}`,
            session_id: "test-session",
            type: "assistant",
            message: {
              role: "assistant",
              content: [{ type: "text", text: chunk }],
              stop_reason: index === chunks.length - 1 ? "end_turn" : null,
            },
            parent_tool_use_id: null,
          },
        },
      }
      this.events.push(event)
      this.chunks.push({ event, delayMs })
    })

    return this
  }

  /**
   * Add text (normal, not chunked)
   */
  text(content: string): this {
    this.msgCount++
    const event: StreamEvent = {
      type: "message",
      requestId: "test-req-123",
      timestamp: new Date().toISOString(),
      data: {
        messageCount: this.msgCount,
        messageType: "assistant",
        content: {
          uuid: `uuid-${this.msgCount}`,
          session_id: "test-session",
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: content }],
            stop_reason: "end_turn",
          },
          parent_tool_use_id: null,
        },
      },
    }
    this.events.push(event)
    this.chunks.push({ event, delayMs: 0 })
    return this
  }

  /**
   * Add thinking block with progressive updates
   */
  thinkingPartial(content: string, delayMs = 50): this {
    this.msgCount++
    const event: StreamEvent = {
      type: "message",
      requestId: "test-req-123",
      timestamp: new Date().toISOString(),
      data: {
        messageCount: this.msgCount,
        messageType: "assistant",
        content: {
          uuid: `uuid-${this.msgCount}`,
          session_id: "test-session",
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "thinking", thinking: content }],
            stop_reason: "end_turn",
          },
          parent_tool_use_id: null,
        },
      },
    }
    this.events.push(event)
    this.chunks.push({ event, delayMs })
    return this
  }

  /**
   * Add thinking block (complete)
   */
  thinking(content: string): this {
    return this.thinkingPartial(content, 0)
  }

  /**
   * Add tool use + result
   */
  tool(name: string, input: Record<string, unknown>, result: string, isError = false): this {
    // Tool use
    this.msgCount++
    const toolId = `tool-${this.msgCount}`

    const toolUseEvent: StreamEvent = {
      type: "message",
      requestId: "test-req-123",
      timestamp: new Date().toISOString(),
      data: {
        messageCount: this.msgCount,
        messageType: "assistant",
        content: {
          uuid: `uuid-${this.msgCount}`,
          session_id: "test-session",
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: toolId, name, input }],
            stop_reason: "tool_use",
          },
          parent_tool_use_id: null,
        },
      },
    }
    this.events.push(toolUseEvent)
    this.chunks.push({ event: toolUseEvent, delayMs: 50 })

    // Tool result
    this.msgCount++
    const toolResultEvent: StreamEvent = {
      type: "message",
      requestId: "test-req-123",
      timestamp: new Date().toISOString(),
      data: {
        messageCount: this.msgCount,
        messageType: "user",
        content: {
          uuid: `uuid-${this.msgCount}`,
          session_id: "test-session",
          type: "user",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolId,
                content: result,
                is_error: isError,
              },
            ],
          },
        },
      },
    }
    this.events.push(toolResultEvent)
    this.chunks.push({ event: toolResultEvent, delayMs: 100 })

    return this
  }

  /**
   * Add error event
   */
  error(message: string, code = "QUERY_FAILED"): this {
    const event: StreamEvent = {
      type: "error",
      requestId: "test-req-123",
      timestamp: new Date().toISOString(),
      data: {
        error: code,
        code,
        message,
        details: message,
      },
    }
    this.events.push(event)
    this.chunks.push({ event, delayMs: 0 })
    return this
  }

  /**
   * Add complete event
   */
  complete(data?: Partial<{ totalMessages: number; totalTurns: number; maxTurns: number }>): this {
    const event: StreamEvent = {
      type: "complete",
      requestId: "test-req-123",
      timestamp: new Date().toISOString(),
      data: {
        totalMessages: this.msgCount,
        totalTurns: this.turnCount || 1,
        maxTurns: 25,
        result: null,
        message: `Claude query completed successfully (${this.turnCount || 1}/25 turns used)`,
        ...data,
      },
    }
    this.events.push(event)
    this.chunks.push({ event, delayMs: 0 })
    return this
  }

  /**
   * Validate fixture
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check that start event exists
    if (!this.events.find(e => e.type === 'start')) {
      errors.push('Missing start event')
    }

    // Check that complete or error event exists
    const hasEnd = this.events.find(e => e.type === 'complete' || e.type === 'error')
    if (!hasEnd) {
      errors.push('Missing complete or error event')
    }

    // Validate each event
    for (const event of this.events) {
      const result = validateStreamEvent(event)
      if (!result.valid) {
        errors.push(`Invalid event (${event.type}): ${result.error}`)
      }
    }

    this.validated = true
    return { valid: errors.length === 0, errors }
  }

  /**
   * Convert to SSE format (non-chunked)
   */
  toSSE(): string {
    if (!this.validated) {
      const validation = this.validate()
      if (!validation.valid) {
        console.warn('Fixture validation failed:', validation.errors)
      }
    }

    const lines = this.events.map(e => `event: bridge_${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
    lines.push("event: done\ndata: {}\n\n")
    return lines.join("")
  }

  /**
   * Convert to chunked SSE (for realistic streaming simulation)
   */
  toChunkedSSE(): Array<{ chunk: string; delayMs: number }> {
    if (!this.validated) {
      const validation = this.validate()
      if (!validation.valid) {
        console.warn('Fixture validation failed:', validation.errors)
      }
    }

    const chunked = this.chunks.map(({ event, delayMs }) => ({
      chunk: `event: bridge_${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      delayMs,
    }))

    chunked.push({ chunk: "event: done\ndata: {}\n\n", delayMs: 0 })
    return chunked
  }

  /**
   * Get metadata
   */
  getMetadata(): FixtureMetadata | undefined {
    return this.metadata
  }

  /**
   * Get events
   */
  getEvents(): StreamEvent[] {
    return this.events
  }
}
```

---

## Fixture Metadata & Registry

### Metadata Types

```typescript
// apps/web/lib/fixtures/core/fixture-metadata.ts

export interface FixtureMetadata {
  id: string
  name: string
  description: string
  tags: string[]
  category: 'simple' | 'tools' | 'errors' | 'streaming' | 'network' | 'scenarios'
  useCases: string[]
  createdAt: string
  version: string
  estimatedDuration?: number  // In milliseconds
  complexity?: 'low' | 'medium' | 'high'
}

export interface FixtureWithMetadata {
  metadata: FixtureMetadata
  builder: EnhancedStreamBuilder
}

export const FixtureCategories = {
  simple: {
    name: 'Simple Responses',
    description: 'Basic Q&A without tools',
    icon: '💬',
  },
  tools: {
    name: 'Tool Usage',
    description: 'File operations and tool chains',
    icon: '🔧',
  },
  errors: {
    name: 'Error Cases',
    description: 'API errors and failures',
    icon: '❌',
  },
  streaming: {
    name: 'Streaming',
    description: 'Complex multi-turn conversations',
    icon: '📡',
  },
  network: {
    name: 'Network Issues',
    description: 'Timeouts, connection failures',
    icon: '🌐',
  },
  scenarios: {
    name: 'Scenarios',
    description: 'Complete workflows',
    icon: '🎬',
  },
} as const
```

### Fixture Registry

```typescript
// apps/web/lib/fixtures/registry.ts

import type { FixtureWithMetadata } from './core/fixture-metadata'

class FixtureRegistry {
  private fixtures = new Map<string, FixtureWithMetadata>()

  register(fixture: FixtureWithMetadata): void {
    this.fixtures.set(fixture.metadata.id, fixture)
  }

  get(id: string): FixtureWithMetadata | undefined {
    return this.fixtures.get(id)
  }

  getByCategory(category: string): FixtureWithMetadata[] {
    return Array.from(this.fixtures.values()).filter(
      f => f.metadata.category === category
    )
  }

  search(query: string): FixtureWithMetadata[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.fixtures.values()).filter(f =>
      f.metadata.name.toLowerCase().includes(lowerQuery) ||
      f.metadata.description.toLowerCase().includes(lowerQuery) ||
      f.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  getByTags(tags: string[]): FixtureWithMetadata[] {
    return Array.from(this.fixtures.values()).filter(f =>
      tags.some(tag => f.metadata.tags.includes(tag))
    )
  }

  all(): FixtureWithMetadata[] {
    return Array.from(this.fixtures.values())
  }
}

export const fixtureRegistry = new FixtureRegistry()
```

---

## Example Fixtures with Metadata

```typescript
// apps/web/lib/fixtures/library/simple/greeting.ts

import { EnhancedStreamBuilder } from '../../core/stream-builder-enhanced'
import { fixtureRegistry } from '../../registry'

const greeting = new EnhancedStreamBuilder({
  id: 'simple-greeting',
  name: 'Simple Greeting',
  description: 'Basic greeting response without tools',
  tags: ['greeting', 'basic', 'fast'],
  category: 'simple',
  useCases: [
    'Testing basic chat functionality',
    'UI development without API calls',
    'Quick smoke tests',
  ],
  version: '1.0.0',
  estimatedDuration: 100,
  complexity: 'low',
})
  .start()
  .text('Hello! How can I help you today?')
  .complete()

// Auto-register
fixtureRegistry.register({ metadata: greeting.getMetadata()!, builder: greeting })

export default greeting
```

```typescript
// apps/web/lib/fixtures/library/tools/file-read-edit.ts

import { EnhancedStreamBuilder } from '../../core/stream-builder-enhanced'
import { fixtureRegistry } from '../../registry'

const fileReadEdit = new EnhancedStreamBuilder({
  id: 'tools-file-read-edit',
  name: 'File Read and Edit',
  description: 'Read a file, then edit it - multi-tool workflow',
  tags: ['file', 'read', 'edit', 'multi-tool'],
  category: 'tools',
  useCases: [
    'Testing tool usage rendering',
    'Testing multi-step workflows',
    'Verifying file operation UI',
  ],
  version: '1.0.0',
  estimatedDuration: 500,
  complexity: 'medium',
})
  .start()
  .thinking('Let me read the file first...')
  .tool('Read', { file_path: '/src/index.ts' }, 'export const x = 1\nexport const y = 2')
  .text('I see you have x and y defined. Let me update x to 10.')
  .tool('Edit', { file_path: '/src/index.ts', old_string: 'x = 1', new_string: 'x = 10' }, 'File edited successfully')
  .text('Done! I updated x from 1 to 10.')
  .complete({ totalTurns: 2 })

fixtureRegistry.register({ metadata: fileReadEdit.getMetadata()!, builder: fileReadEdit })

export default fileReadEdit
```

```typescript
// apps/web/lib/fixtures/library/streaming/realistic-conversation.ts

import { EnhancedStreamBuilder } from '../../core/stream-builder-enhanced'
import { fixtureRegistry } from '../../registry'

const realisticConversation = new EnhancedStreamBuilder({
  id: 'streaming-realistic',
  name: 'Realistic Chunked Conversation',
  description: 'Simulates realistic SSE streaming with delays',
  tags: ['streaming', 'realistic', 'chunked', 'slow'],
  category: 'streaming',
  useCases: [
    'Testing streaming UI',
    'Testing loading states',
    'Performance testing with slow responses',
  ],
  version: '1.0.0',
  estimatedDuration: 3000,
  complexity: 'high',
})
  .start()
  .thinkingPartial('Analyzing', 100)
  .thinkingPartial('Analyzing your request', 100)
  .thinkingPartial('Analyzing your request...', 100)
  .textChunked('Let me help you with that.', { delayMs: 80, chunkSize: 2 })
  .textChunked('First, I will read the configuration file.', { delayMs: 80, chunkSize: 2 })
  .tool('Read', { file_path: '/config.json' }, '{"port": 3000, "host": "localhost"}')
  .textChunked('I found your configuration. The server runs on port 3000.', { delayMs: 80, chunkSize: 2 })
  .complete()

fixtureRegistry.register({ metadata: realisticConversation.getMetadata()!, builder: realisticConversation })

export default realisticConversation
```

---

## Conditional & Stateful Handlers

### Input-Based Responses

```typescript
// apps/web/lib/mocks/handlers/conditional.ts

import type { Route } from '@playwright/test'
import { fixtureRegistry } from '@/lib/fixtures/registry'

export async function conditionalHandler(route: Route) {
  const request = await route.request().json()
  const userMessage = request.message?.toLowerCase() || ''

  // Select fixture based on user input
  let fixture

  if (userMessage.includes('read') && userMessage.includes('file')) {
    fixture = fixtureRegistry.get('tools-file-read')
  } else if (userMessage.includes('error') || userMessage.includes('fail')) {
    fixture = fixtureRegistry.get('errors-api-error')
  } else if (userMessage.includes('hello') || userMessage.includes('hi')) {
    fixture = fixtureRegistry.get('simple-greeting')
  } else {
    // Default
    fixture = fixtureRegistry.get('simple-default')
  }

  if (!fixture) {
    fixture = fixtureRegistry.get('simple-greeting')
  }

  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: fixture!.builder.toSSE(),
  })
}
```

### Stateful Conversation Handler

```typescript
// apps/web/lib/mocks/handlers/stateful.ts

import type { Route } from '@playwright/test'
import { EnhancedStreamBuilder } from '@/lib/fixtures/core/stream-builder-enhanced'

// Track conversation state
const conversationState = new Map<string, {
  turnCount: number
  history: string[]
  context: Record<string, any>
}>()

export async function statefulHandler(route: Route) {
  const request = await route.request().json()
  const conversationId = request.conversationId || 'default'
  const userMessage = request.message || ''

  // Get or create state
  let state = conversationState.get(conversationId)
  if (!state) {
    state = { turnCount: 0, history: [], context: {} }
    conversationState.set(conversationId, state)
  }

  // Update state
  state.turnCount++
  state.history.push(userMessage)

  // Generate contextual response
  const builder = new EnhancedStreamBuilder()
    .start()

  if (state.turnCount === 1) {
    builder.text('Hello! This is our first interaction.')
  } else {
    builder.text(`This is turn ${state.turnCount}. We've chatted ${state.history.length} times.`)
  }

  // Remember context
  if (userMessage.includes('my name is')) {
    const name = userMessage.split('my name is')[1].trim()
    state.context.userName = name
    builder.text(`Nice to meet you, ${name}!`)
  }

  if (state.context.userName) {
    builder.text(`By the way, ${state.context.userName}, I remember your name from earlier!`)
  }

  builder.complete({ totalTurns: state.turnCount, maxTurns: 25 })

  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: builder.toSSE(),
  })
}
```

### Network Failure Simulation

```typescript
// apps/web/lib/mocks/handlers/network.ts

import type { Route } from '@playwright/test'

export interface NetworkSimulation {
  type: 'timeout' | 'connection_reset' | 'slow' | '5xx_error'
  delayMs?: number
  errorCode?: number
}

export async function networkFailureHandler(route: Route, simulation: NetworkSimulation) {
  switch (simulation.type) {
    case 'timeout':
      // Hang forever (simulates timeout)
      await new Promise(() => {})
      break

    case 'connection_reset':
      // Abort request
      await route.abort('connectionreset')
      break

    case 'slow':
      // Very slow response
      await new Promise(r => setTimeout(r, simulation.delayMs || 10000))
      await route.continue()
      break

    case '5xx_error':
      // Server error
      await route.fulfill({
        status: simulation.errorCode || 504,
        body: JSON.stringify({ error: 'Gateway Timeout' }),
      })
      break
  }
}
```

---

## Automated Fixture Testing

```typescript
// apps/web/lib/fixtures/__tests__/all-fixtures.test.ts

import { describe, expect, it } from 'vitest'
import { fixtureRegistry } from '../registry'

describe('Fixture Library Validation', () => {
  const allFixtures = fixtureRegistry.all()

  it('should have at least 20 fixtures', () => {
    expect(allFixtures.length).toBeGreaterThanOrEqual(20)
  })

  it('should have all required categories', () => {
    const categories = new Set(allFixtures.map(f => f.metadata.category))
    expect(categories.has('simple')).toBe(true)
    expect(categories.has('tools')).toBe(true)
    expect(categories.has('errors')).toBe(true)
  })

  allFixtures.forEach(fixture => {
    describe(`Fixture: ${fixture.metadata.name}`, () => {
      it('should have valid metadata', () => {
        expect(fixture.metadata.id).toBeDefined()
        expect(fixture.metadata.name).toBeDefined()
        expect(fixture.metadata.description).toBeTruthy()
        expect(fixture.metadata.tags.length).toBeGreaterThan(0)
      })

      it('should pass validation', () => {
        const result = fixture.builder.validate()
        if (!result.valid) {
          console.error(`Fixture validation failed for ${fixture.metadata.name}:`, result.errors)
        }
        expect(result.valid).toBe(true)
      })

      it('should generate valid SSE', () => {
        const sse = fixture.builder.toSSE()
        expect(sse).toContain('event: bridge_start')
        expect(sse).toContain('event: done')
      })

      it('should have realistic content', () => {
        const events = fixture.builder.getEvents()
        expect(events.length).toBeGreaterThan(0)

        // Check for text content
        const hasText = events.some(e =>
          e.type === 'message' && e.data.messageType === 'assistant'
        )
        const hasError = events.some(e => e.type === 'error')
        expect(hasText || hasError).toBe(true)
      })
    })
  })
})
```

---

## Dev Toolbar with Advanced Features

```typescript
// apps/web/components/dev/EnhancedFixtureToolbar.tsx
'use client'

import { useState, useMemo } from 'react'
import { fixtureRegistry } from '@/lib/fixtures/registry'
import { FixtureCategories } from '@/lib/fixtures/core/fixture-metadata'
import { setFixture, setNetworkSimulation } from '@/lib/mocks/handlers'

export function EnhancedFixtureToolbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [networkMode, setNetworkMode] = useState<'normal' | 'slow' | 'timeout' | 'error'>('normal')

  const allFixtures = useMemo(() => fixtureRegistry.all(), [])

  const filteredFixtures = useMemo(() => {
    let fixtures = allFixtures

    if (selectedCategory) {
      fixtures = fixtures.filter(f => f.metadata.category === selectedCategory)
    }

    if (searchQuery) {
      fixtures = fixtureRegistry.search(searchQuery)
    }

    return fixtures
  }, [allFixtures, selectedCategory, searchQuery])

  const handleSelectFixture = (fixtureId: string) => {
    const fixture = fixtureRegistry.get(fixtureId)
    if (fixture) {
      setFixture(fixture.builder)
      console.log(`Selected fixture: ${fixture.metadata.name}`)
    }
  }

  const handleNetworkChange = (mode: typeof networkMode) => {
    setNetworkMode(mode)
    setNetworkSimulation(mode)
    console.log(`Network mode: ${mode}`)
  }

  if (!isMockMode) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 font-mono text-sm">
      {/* Header */}
      <div className="bg-yellow-500 text-black px-3 py-2 rounded-t flex items-center justify-between">
        <span>🎭 MOCK MODE</span>
        <button onClick={() => setIsOpen(!isOpen)} className="font-bold">
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {/* Panel */}
      {isOpen && (
        <div className="bg-white border border-gray-300 rounded-b shadow-2xl w-96 max-h-[600px] flex flex-col">
          {/* Search */}
          <div className="p-3 border-b">
            <input
              type="text"
              placeholder="Search fixtures..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-1 p-2 border-b overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2 py-1 rounded whitespace-nowrap ${!selectedCategory ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              All
            </button>
            {Object.entries(FixtureCategories).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-2 py-1 rounded whitespace-nowrap ${selectedCategory === key ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* Fixtures */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredFixtures.map(fixture => (
              <button
                key={fixture.metadata.id}
                onClick={() => handleSelectFixture(fixture.metadata.id)}
                className="w-full text-left p-3 mb-2 bg-gray-50 hover:bg-gray-100 rounded border"
              >
                <div className="font-semibold">{fixture.metadata.name}</div>
                <div className="text-xs text-gray-600">{fixture.metadata.description}</div>
                <div className="flex gap-1 mt-1">
                  {fixture.metadata.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                {fixture.metadata.estimatedDuration && (
                  <div className="text-xs text-gray-500 mt-1">
                    ~{fixture.metadata.estimatedDuration}ms
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Network Simulation */}
          <div className="border-t p-3">
            <div className="font-semibold mb-2">Network Simulation</div>
            <div className="flex gap-2">
              {(['normal', 'slow', 'timeout', 'error'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleNetworkChange(mode)}
                  className={`px-3 py-1 rounded ${networkMode === mode ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Summary of Robustness Improvements

### 1. Type Safety ✅
- Validated against production `StreamEvent` types
- Metadata is strongly typed
- Fixtures can't drift from production

### 2. Realistic Streaming ✅
- Chunk-by-chunk simulation with configurable delays
- Progressive content updates
- Multi-turn conversation support

### 3. Comprehensive Testing ✅
- All fixtures automatically tested
- Validation ensures correctness
- Easy to add new fixtures without breaking

### 4. Discovery & Organization ✅
- Fixture registry with search
- Category-based organization
- Metadata-rich for easy discovery

### 5. Developer Experience ✅
- Visual toolbar with search
- Network simulation controls
- Fixture preview
- Keyboard shortcuts

### 6. Advanced Patterns ✅
- Conditional responses based on input
- Stateful conversation handlers
- Network failure simulation
- Fixture composition

### 7. Maintainability ✅
- Auto-registration system
- Version tracking
- Use case documentation
- Automated tests

---

## Implementation Priority

**Phase 1** (Critical - 4 hours):
1. Enhanced StreamBuilder with chunking
2. Fixture metadata types
3. Fixture registry
4. Validation system

**Phase 2** (Important - 3 hours):
5. Create 30+ fixtures with metadata
6. Automated fixture tests
7. Basic dev toolbar

**Phase 3** (Nice to Have - 3 hours):
8. Conditional handlers
9. Stateful handlers
10. Network simulation
11. Advanced dev toolbar

**Total**: ~10 hours for robust system

---

## Success Metrics

- [ ] 30+ validated fixtures covering all categories
- [ ] 100% fixture validation pass rate
- [ ] <100ms average fixture response time
- [ ] Realistic streaming with configurable delays
- [ ] Search/discovery works smoothly
- [ ] Network simulation modes functional
- [ ] Zero fixture type drift from production
- [ ] All fixtures have complete metadata
- [ ] Developer satisfaction > 90%

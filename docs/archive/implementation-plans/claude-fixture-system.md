# Implementation Plan: Claude API Fixture System

> **Problem**: Every local development interaction with Claude costs money. Developers need realistic, reusable fixtures to develop against without API charges.

## Table of Contents

1. [Current State](#current-state)
2. [Problem Analysis](#problem-analysis)
3. [How Big Companies Do It](#how-big-companies-do-it)
4. [Proposed Architecture](#proposed-architecture)
5. [Implementation Phases](#implementation-phases)
6. [Code Structure](#code-structure)
7. [Developer Experience](#developer-experience)
8. [Migration Path](#migration-path)

---

## Current State

### What We Have

✅ **E2E Testing (Playwright)**
- `StreamBuilder` - Type-safe SSE stream builder
- `handlers` - Convenience functions for common patterns
- Custom Playwright fixture for request interception
- Works perfectly for E2E tests

✅ **Unit Testing (Vitest)**
- Global SDK mock that throws errors
- Prevents accidental API calls in tests
- Requires manual mocking per test

### What We're Missing

❌ **Local Development**
- No mocking system for browser dev
- Every chat interaction = real API call ($$$)
- Slow iteration on UI/UX
- Can't test error cases easily
- Hard to debug streaming issues

❌ **Fixture Library**
- No reusable response fixtures
- Can't easily test edge cases
- No way to share scenarios across team

❌ **Dev Mode Toggle**
- No way to switch between mock/real API
- Can't selectively mock endpoints

---

## Problem Analysis

### Pain Points

1. **Cost**: Every `localhost:8999` interaction costs ~$0.01-0.05
   - Testing a feature 20 times = $1
   - 5 developers × 20 tests/day × 20 days = $2,000/month

2. **Speed**: Real API has ~2-5s latency
   - Slows down iteration
   - Makes debugging painful

3. **Reliability**: Can't test offline
   - API downtime blocks development
   - Rate limits during heavy dev

4. **Testing Edge Cases**: Hard to trigger specific scenarios
   - Error states
   - Max turns limit
   - Tool failures
   - Long responses

### Requirements

**Must Have:**
- ✅ Zero cost for local development
- ✅ Realistic Claude responses
- ✅ Easy to toggle mock/real API
- ✅ Reuse existing E2E infrastructure
- ✅ Type-safe fixtures
- ✅ Fast (<100ms response time)

**Nice to Have:**
- ⚠️ Record real API responses for fixtures
- ⚠️ Fixture browser UI
- ⚠️ Per-developer fixture overrides
- ⚠️ Automatic fixture updates

---

## How Big Companies Do It

### Industry Patterns

#### 1. **Mock Service Worker (MSW)** - Industry Standard

**Used by**: Microsoft, Shopify, GitHub, Stripe

```typescript
// Intercepts network requests at the service worker level
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.post('/api/chat', () => {
    return HttpResponse.json({ message: 'Mocked response' })
  })
]
```

**Pros:**
- Works in browser and Node.js
- Intercepts at network level (no code changes)
- Can coexist with real API (selective mocking)
- Industry standard, well-maintained

**Cons:**
- Requires service worker setup
- Can be tricky with SSE streams

#### 2. **Fixture Libraries** - Realistic Data

**Used by**: Linear, Vercel, Supabase

```typescript
// fixtures/chat-responses.ts
export const fixtures = {
  simple_greeting: {
    message: 'Hello! How can I help?',
    thinking: null
  },
  file_read_response: {
    tool: 'Read',
    path: '/src/index.ts',
    content: '...'
  }
}
```

**Pros:**
- Reusable across tests and dev
- Easy to maintain
- Can be generated from real API
- Version controlled

#### 3. **VCR Pattern** - Record/Replay

**Used by**: Stripe, Twilio

```ruby
# Records real API calls to cassettes
VCR.use_cassette('stripe_payment') do
  Stripe::Charge.create(...)
end
```

**Pros:**
- Fixtures stay realistic
- Easy to update
- Captures actual API behavior

**Cons:**
- Requires initial API call
- Can capture sensitive data
- Cassettes get stale

#### 4. **Environment-Based Toggling**

**Used by**: Everyone

```typescript
const USE_MOCK_API = process.env.NEXT_PUBLIC_MOCK_API === 'true'

if (USE_MOCK_API) {
  // Use fixtures
} else {
  // Use real API
}
```

**Pros:**
- Simple
- Easy to understand
- Per-developer control

---

## Proposed Architecture

### Overview

```
┌─────────────────────────────────────────┐
│         Browser (Development)           │
├─────────────────────────────────────────┤
│  React App                              │
│  ↓ fetch('/api/claude/stream')         │
├─────────────────────────────────────────┤
│  MSW Service Worker (if MOCK_MODE=true)│
│  ↓ Intercepts request                  │
│  ↓ Loads fixture from library          │
│  ↓ Uses StreamBuilder to generate SSE  │
│  ↓ Returns mocked response             │
├─────────────────────────────────────────┤
│  Real API (if MOCK_MODE=false)         │
│  ↓ Next.js API route                   │
│  ↓ Anthropic SDK                       │
│  ↓ Real Claude API ($$$)               │
└─────────────────────────────────────────┘
```

### Components

#### 1. **MSW Setup** (`apps/web/lib/mocks/`)

Intercepts API requests in the browser during development.

#### 2. **Fixture Library** (`apps/web/lib/fixtures/`)

Reusable Claude response fixtures using existing `StreamBuilder`.

#### 3. **Mock Mode Toggle** (Environment Variable)

```bash
NEXT_PUBLIC_MOCK_API=true    # Use fixtures
NEXT_PUBLIC_MOCK_API=false   # Use real API (default)
```

#### 4. **Shared Test Utilities** (`apps/web/lib/test-utils/`)

Move `StreamBuilder` and `handlers` from E2E to shared location.

### Key Design Decisions

**1. Reuse E2E Infrastructure**
- Don't rebuild `StreamBuilder` - move it to shared lib
- Fixtures work in both E2E tests AND local dev

**2. MSW for Browser Mocking**
- Industry standard
- No code changes needed
- Easy to toggle

**3. Fixture-First Approach**
- Create comprehensive fixture library
- Organized by scenario (success, errors, tools)
- Type-safe and composable

**4. Opt-In Mocking**
- Default = real API
- Set env var to enable mocks
- Per-developer control

---

## Implementation Phases

### Phase 1: Foundation (2-3 hours)

**Goal**: Set up MSW and move shared utilities

**Tasks:**
1. Install MSW: `bun add -D msw`
2. Create `apps/web/lib/test-utils/` directory
3. Move `StreamBuilder` from `tests/e2e/lib/` to `lib/test-utils/`
4. Move `handlers` from `tests/e2e/lib/` to `lib/test-utils/`
5. Update E2E test imports
6. Initialize MSW in development mode

**Files Created:**
```
apps/web/lib/
├── test-utils/
│   ├── stream-builder.ts      # Moved from tests/e2e
│   ├── stream-handlers.ts     # Moved from tests/e2e
│   └── index.ts              # Barrel export
└── mocks/
    ├── browser.ts            # MSW browser setup
    └── handlers.ts           # MSW request handlers
```

**Acceptance Criteria:**
- [ ] E2E tests still pass with new import paths
- [ ] `StreamBuilder` accessible from anywhere
- [ ] MSW initialized (but not yet handling requests)

### Phase 2: Fixture Library (3-4 hours)

**Goal**: Create comprehensive fixture library

**Tasks:**
1. Create fixture library structure
2. Define common scenarios (20-30 fixtures)
3. Create fixture selector/loader
4. Add TypeScript types for fixtures

**Files Created:**
```
apps/web/lib/fixtures/
├── index.ts                  # Fixture registry
├── categories/
│   ├── simple-responses.ts   # Basic Q&A
│   ├── tool-usage.ts         # File operations
│   ├── errors.ts             # Error cases
│   ├── streaming.ts          # Multi-turn, long responses
│   └── edge-cases.ts         # Max turns, timeouts, etc.
└── types.ts                  # Fixture type definitions
```

**Fixture Examples:**

```typescript
// lib/fixtures/categories/simple-responses.ts
import { StreamBuilder } from '@/lib/test-utils'

export const simpleResponses = {
  greeting: new StreamBuilder()
    .start()
    .text('Hello! How can I help you today?')
    .complete(),

  shortAnswer: new StreamBuilder()
    .start()
    .text('Sure, I can help with that!')
    .complete(),

  withThinking: new StreamBuilder()
    .start()
    .thinking('Let me analyze this...')
    .text('Based on my analysis, here is what I found.')
    .complete()
}
```

```typescript
// lib/fixtures/categories/tool-usage.ts
export const toolUsage = {
  fileRead: new StreamBuilder()
    .start()
    .tool('Read', { file_path: '/src/index.ts' }, 'export default function App() {...}')
    .text('I found your App component in index.ts')
    .complete(),

  fileWrite: new StreamBuilder()
    .start()
    .tool('Write', { file_path: '/src/new.ts', content: 'const x = 1' }, 'File created')
    .text('I created the new file')
    .complete()
}
```

```typescript
// lib/fixtures/categories/errors.ts
export const errors = {
  apiError: new StreamBuilder()
    .start()
    .error('Service temporarily unavailable', 'API_ERROR'),

  maxTurns: new StreamBuilder()
    .start()
    .error('Conversation reached maximum turn limit (25/25 turns)', 'ERROR_MAX_TURNS'),

  timeout: new StreamBuilder()
    .start()
    .error('Request timeout after 120s', 'TIMEOUT')
}
```

```typescript
// lib/fixtures/index.ts
import { simpleResponses } from './categories/simple-responses'
import { toolUsage } from './categories/tool-usage'
import { errors } from './categories/errors'

export const fixtures = {
  simple: simpleResponses,
  tools: toolUsage,
  errors: errors
}

export type FixtureKey = keyof typeof fixtures
```

**Acceptance Criteria:**
- [ ] 20+ realistic fixtures covering common scenarios
- [ ] Organized by category
- [ ] Type-safe fixture access
- [ ] All fixtures use StreamBuilder

### Phase 3: MSW Integration (2-3 hours)

**Goal**: Hook up MSW to use fixtures

**Tasks:**
1. Create MSW handlers for `/api/claude/stream`
2. Implement fixture selection logic
3. Add environment variable toggle
4. Initialize MSW in dev mode only

**Files Modified/Created:**
```typescript
// lib/mocks/handlers.ts
import { http, HttpResponse } from 'msw'
import { fixtures } from '@/lib/fixtures'

// Default fixture (can be overridden)
let currentFixture = fixtures.simple.greeting

export const handlers = [
  http.post('/api/claude/stream', async ({ request }) => {
    const body = await request.json()

    // Use fixture to generate SSE stream
    const sseStream = currentFixture.toSSE()

    return new HttpResponse(sseStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  })
]

// Helper to change fixture at runtime
export function setFixture(fixture: StreamBuilder) {
  currentFixture = fixture
}
```

```typescript
// lib/mocks/browser.ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

// Only start in development with mock mode enabled
if (
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_MOCK_API === 'true'
) {
  worker.start({
    onUnhandledRequest: 'bypass' // Don't mock other requests
  })
}
```

```typescript
// app/layout.tsx (root layout)
import { useEffect } from 'react'

export default function RootLayout({ children }) {
  useEffect(() => {
    // Initialize MSW in development
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_MOCK_API === 'true'
    ) {
      import('@/lib/mocks/browser')
    }
  }, [])

  return <html>{children}</html>
}
```

**Acceptance Criteria:**
- [ ] MSW intercepts `/api/claude/stream` when `NEXT_PUBLIC_MOCK_API=true`
- [ ] Real API used when `NEXT_PUBLIC_MOCK_API=false`
- [ ] Fixture responses render correctly in UI
- [ ] No API costs when using mock mode

### Phase 4: Developer Experience (2-3 hours)

**Goal**: Make it easy to switch fixtures and debug

**Tasks:**
1. Create dev toolbar for fixture selection
2. Add keyboard shortcuts
3. Create fixture browser component
4. Add console logging for mock mode

**Files Created:**
```
apps/web/components/dev/
├── FixtureBrowser.tsx        # UI to select fixtures
├── DevToolbar.tsx           # Dev mode indicator + controls
└── MockModeIndicator.tsx    # Shows when mocking is active
```

**DevToolbar Example:**

```typescript
// components/dev/DevToolbar.tsx
'use client'

import { useState } from 'react'
import { fixtures } from '@/lib/fixtures'
import { setFixture } from '@/lib/mocks/handlers'

export function DevToolbar() {
  const [isOpen, setIsOpen] = useState(false)
  const isMockMode = process.env.NEXT_PUBLIC_MOCK_API === 'true'

  if (!isMockMode) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Mock Mode Indicator */}
      <div className="bg-yellow-500 text-black px-3 py-1 rounded-t text-sm font-mono">
        🎭 MOCK MODE
      </div>

      {/* Fixture Selector */}
      {isOpen && (
        <div className="bg-white border border-gray-300 rounded-b shadow-lg p-4 max-h-96 overflow-auto">
          <h3 className="font-bold mb-2">Select Fixture:</h3>

          {/* Simple Responses */}
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-600">Simple</div>
            {Object.entries(fixtures.simple).map(([key, fixture]) => (
              <button
                key={key}
                onClick={() => setFixture(fixture)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Tool Usage */}
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-600">Tools</div>
            {Object.entries(fixtures.tools).map(([key, fixture]) => (
              <button
                key={key}
                onClick={() => setFixture(fixture)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Errors */}
          <div>
            <div className="text-sm font-semibold text-gray-600">Errors</div>
            {Object.entries(fixtures.errors).map(([key, fixture]) => (
              <button
                key={key}
                onClick={() => setFixture(fixture)}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-red-600"
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-800 text-white px-3 py-2 text-sm font-mono"
      >
        {isOpen ? '▼ Hide Fixtures' : '▲ Show Fixtures'}
      </button>
    </div>
  )
}
```

**Keyboard Shortcuts:**

```typescript
// lib/mocks/keyboard-shortcuts.ts
import { fixtures } from '@/lib/fixtures'
import { setFixture } from './handlers'

if (process.env.NEXT_PUBLIC_MOCK_API === 'true') {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+1-9 to quickly select fixtures
    if (e.ctrlKey && e.shiftKey && e.key >= '1' && e.key <= '9') {
      const fixtureIndex = parseInt(e.key) - 1
      const allFixtures = Object.values(fixtures).flatMap(cat => Object.values(cat))

      if (allFixtures[fixtureIndex]) {
        setFixture(allFixtures[fixtureIndex])
        console.log(`Switched to fixture ${fixtureIndex + 1}`)
      }
    }
  })
}
```

**Acceptance Criteria:**
- [ ] Dev toolbar visible in mock mode
- [ ] Can select fixtures via UI
- [ ] Keyboard shortcuts work
- [ ] Console shows which fixture is active

### Phase 5: Documentation & Testing (1-2 hours)

**Goal**: Document the system and verify it works

**Tasks:**
1. Update testing guide
2. Add fixture system documentation
3. Create example usage guide
4. Test all fixtures work

**Documentation:**

```markdown
# docs/development/FIXTURE_SYSTEM.md

## Using Fixtures in Development

### Quick Start

1. Enable mock mode:
   ```bash
   # .env.local
   NEXT_PUBLIC_MOCK_API=true
   ```

2. Start dev server:
   ```bash
   bun run dev
   ```

3. See mock mode indicator in bottom-right corner

4. Click to select different fixtures

### Adding New Fixtures

1. Create fixture in `lib/fixtures/categories/`
2. Add to appropriate category or create new one
3. Export from `lib/fixtures/index.ts`
4. Fixture automatically available in toolbar

### Keyboard Shortcuts

- `Ctrl+Shift+1-9`: Quick-select fixtures
- `Ctrl+Shift+M`: Toggle mock mode on/off
```

**Acceptance Criteria:**
- [ ] Documentation complete
- [ ] All fixtures tested manually
- [ ] Example usage in docs
- [ ] Team can successfully use the system

---

## Code Structure

### Final Directory Layout

```
apps/web/
├── lib/
│   ├── test-utils/               # Shared testing utilities
│   │   ├── stream-builder.ts    # SSE stream builder (was in E2E)
│   │   ├── stream-handlers.ts   # Convenience handlers
│   │   └── index.ts
│   ├── fixtures/                 # Fixture library
│   │   ├── index.ts             # Registry + exports
│   │   ├── types.ts             # Fixture types
│   │   └── categories/
│   │       ├── simple-responses.ts
│   │       ├── tool-usage.ts
│   │       ├── errors.ts
│   │       ├── streaming.ts
│   │       └── edge-cases.ts
│   └── mocks/                    # MSW setup
│       ├── browser.ts           # MSW worker setup
│       ├── handlers.ts          # Request handlers
│       └── keyboard-shortcuts.ts
├── components/dev/               # Dev-only components
│   ├── DevToolbar.tsx
│   ├── FixtureBrowser.tsx
│   └── MockModeIndicator.tsx
└── tests/
    └── e2e/                      # E2E tests (now import from lib/)
        ├── setup.ts
        ├── helpers.ts
        └── *.spec.ts
```

### Import Examples

```typescript
// In E2E tests (backward compatible)
import { StreamBuilder, handlers } from '@/lib/test-utils'

// In local dev components
import { fixtures } from '@/lib/fixtures'
import { setFixture } from '@/lib/mocks/handlers'

// In MSW handlers
import { http } from 'msw'
import { fixtures } from '@/lib/fixtures'
```

---

## Developer Experience

### How It Feels

#### Before (Current State)

```
Developer: *makes UI change*
Developer: *refreshes page*
Developer: *types message*
Developer: *waits 3 seconds*
Claude API: *returns response*
Developer: "Hmm, not quite right"
Developer: *makes another change*
Developer: *repeats 20 times*
Result: $1 in API costs, 10 minutes wasted waiting
```

#### After (With Fixtures)

```
Developer: *enables NEXT_PUBLIC_MOCK_API=true*
Developer: *makes UI change*
Developer: *refreshes page*
Developer: *selects "fileRead" fixture from toolbar*
Developer: *types message*
Developer: *instant response (<100ms)*
Developer: "Perfect! Now let me test error case"
Developer: *selects "apiError" fixture*
Developer: *types message*
Developer: *instant error response*
Developer: *iterates 20 times in 2 minutes*
Result: $0 in API costs, 2 minutes total
```

### Workflows Enabled

**1. UI Development**
```
1. Enable mock mode
2. Select appropriate fixture
3. Iterate on UI styling/layout
4. No API costs, instant feedback
```

**2. Error Handling**
```
1. Select error fixture
2. Verify error UI displays correctly
3. Test different error types
4. No need to trigger real errors
```

**3. Tool Usage Testing**
```
1. Select tool fixture (fileRead, fileWrite, etc.)
2. Verify tool input/output rendering
3. Test different tool combinations
4. No real file operations needed
```

**4. Performance Testing**
```
1. Select streaming fixture with long response
2. Verify streaming UI works smoothly
3. Test loading states
4. No waiting for real API
```

---

## Migration Path

### For E2E Tests

**Before:**
```typescript
// tests/e2e/chat.spec.ts
import { handlers } from './lib/handlers'

test('send message', async ({ page }) => {
  await page.route('**/api/claude/stream', handlers.text('Hello!'))
})
```

**After:**
```typescript
// tests/e2e/chat.spec.ts
import { handlers } from '@/lib/test-utils'

test('send message', async ({ page }) => {
  await page.route('**/api/claude/stream', handlers.text('Hello!'))
})
```

**Change**: Just update import path. Everything else stays the same.

### For Local Development

**Before:**
```bash
# Always uses real API
bun run dev
# Every interaction costs money
```

**After:**
```bash
# Option 1: Use real API (default)
bun run dev

# Option 2: Use fixtures (free)
NEXT_PUBLIC_MOCK_API=true bun run dev

# Or add to .env.local permanently:
echo "NEXT_PUBLIC_MOCK_API=true" >> apps/web/.env.local
bun run dev
```

---

## Testing the Fixture System

### Manual Testing Checklist

- [ ] Mock mode indicator appears when `NEXT_PUBLIC_MOCK_API=true`
- [ ] Can send message and get fixture response
- [ ] Can switch fixtures via toolbar
- [ ] Different fixtures render correctly
- [ ] Error fixtures show error UI
- [ ] Tool fixtures show tool usage
- [ ] Real API still works when mock mode disabled
- [ ] E2E tests pass after migration
- [ ] No API calls made in mock mode (check network tab)

### Automated Testing

```typescript
// lib/fixtures/__tests__/fixtures.test.ts
import { describe, expect, it } from 'vitest'
import { fixtures } from '../index'

describe('Fixture Library', () => {
  it('should have all required categories', () => {
    expect(fixtures.simple).toBeDefined()
    expect(fixtures.tools).toBeDefined()
    expect(fixtures.errors).toBeDefined()
  })

  it('should generate valid SSE streams', () => {
    const sse = fixtures.simple.greeting.toSSE()
    expect(sse).toContain('event: bridge_start')
    expect(sse).toContain('event: bridge_message')
    expect(sse).toContain('event: bridge_complete')
  })

  it('should have realistic content', () => {
    const sse = fixtures.simple.greeting.toSSE()
    expect(sse).toContain('Hello')
  })
})
```

---

## Cost Savings Analysis

### Current State (Without Fixtures)

```
Assumptions:
- 5 developers
- Each tests feature 20 times/day
- Average API call cost: $0.03
- 20 working days/month

Cost per developer per month:
20 tests/day × 20 days × $0.03 = $12/month

Total team cost:
5 developers × $12 = $60/month = $720/year

Plus: Wasted time waiting for API responses
20 tests × 3 seconds × 5 devs × 20 days = 100 minutes/day
= 2,000 minutes/month = 33 hours/month of waiting
```

### With Fixtures

```
Cost per developer per month: $0
Total team cost: $0/year

Time saved:
~33 hours/month of waiting time eliminated
Faster iteration = better products
```

**ROI**:
- Saves $720/year in API costs
- Saves ~400 hours/year of developer waiting time
- Enables offline development
- Faster feature iteration

**Implementation cost**: ~12-15 hours one-time

**Payback period**: ~2 weeks

---

## Future Enhancements (Post-MVP)

### Phase 6: Recording System (Optional)

Add ability to record real API responses and save as fixtures.

```typescript
// lib/mocks/recorder.ts
export async function recordFixture(name: string) {
  // Intercept real API call
  // Save response to fixture file
  // Auto-generate StreamBuilder code
}
```

**Usage:**
```typescript
// In dev mode, press Ctrl+Shift+R to start recording
// Make API call
// Response automatically saved as fixture
```

### Phase 7: Fixture Variations (Optional)

Allow parameterized fixtures for different scenarios.

```typescript
// lib/fixtures/generators.ts
export function generateFileReadFixture(path: string, content: string) {
  return new StreamBuilder()
    .start()
    .tool('Read', { file_path: path }, content)
    .text(`I read ${path}`)
    .complete()
}

// Usage
const customFixture = generateFileReadFixture('/custom/path.ts', 'const x = 1')
```

### Phase 8: Fixture Marketplace (Optional)

Share fixtures across team/organization.

```typescript
// fixtures.config.ts
export default {
  remote: 'https://fixtures.yourcompany.com',
  sync: true
}

// Auto-download latest fixtures on dev server start
```

---

## Summary

### What This Achieves

1. **Zero-cost development** - No API charges for local dev
2. **Fast iteration** - Instant responses instead of 3-5s wait
3. **Comprehensive testing** - Easy to test edge cases and errors
4. **Offline development** - Work without internet
5. **Reusable infrastructure** - E2E and dev use same fixtures
6. **Type-safe** - Full TypeScript support
7. **Easy to use** - Visual toolbar, keyboard shortcuts
8. **Team-friendly** - Shared fixture library

### Implementation Timeline

- **Phase 1 (Foundation)**: 2-3 hours
- **Phase 2 (Fixtures)**: 3-4 hours
- **Phase 3 (MSW)**: 2-3 hours
- **Phase 4 (Dev UX)**: 2-3 hours
- **Phase 5 (Docs)**: 1-2 hours

**Total**: 10-15 hours for complete system

### Success Criteria

- [ ] Developers can enable mock mode with one env var
- [ ] 20+ realistic fixtures covering common scenarios
- [ ] Zero API costs in mock mode
- [ ] <100ms response time for fixtures
- [ ] Visual fixture selector in dev toolbar
- [ ] E2E tests continue working
- [ ] Documentation complete
- [ ] Team trained on usage

---

## Questions for Discussion

1. **Fixture scope**: Start with 20 fixtures or aim for 50+?
2. **Recording**: Worth implementing or manually create fixtures?
3. **Default mode**: Mock by default or real API by default?
4. **Fixture organization**: Current categories sufficient or need more?
5. **Dev toolbar**: Always visible or keyboard toggle?

## Next Steps

1. Review this plan with team
2. Get approval on architecture
3. Start with Phase 1 (Foundation)
4. Iterate based on developer feedback

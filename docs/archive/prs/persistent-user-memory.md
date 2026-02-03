# RFC: Persistent User Memory Across Sessions

**Status:** Draft
**RFC ID:** RFC-2026-003
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

Claude remembers user preferences, past decisions, and context across all sessions. "They like minimal designs." "They always want dark mode." "Their brand color is #FF5733." No more repeating yourself.

## Problem

Every new session starts fresh. Users have to re-explain their preferences, brand guidelines, and past decisions. This feels like talking to someone with amnesia. OpenClaw's persistent memory is one of its most-loved features.

**User frustration:** "I told you last week I want everything in dark mode. Why are you suggesting light backgrounds again?"

## User Stories

1. **Preference recall:** User said "I prefer minimal designs" 2 weeks ago → Claude remembers and applies this to new suggestions
2. **Brand consistency:** User set brand colors once → Every new page uses them automatically
3. **Context continuity:** User discussed blog strategy last month → Can reference it naturally: "Remember our blog plan?"
4. **Explicit memory:** User says "Remember that I hate popups" → Stored and respected forever

## What Gets Remembered

| Category | Examples | Storage |
|----------|----------|---------|
| **Preferences** | Design style, color preferences, tone of voice | Extracted from conversations |
| **Brand info** | Colors, fonts, logo, company name | Explicit or extracted |
| **Decisions** | "We decided to use Stripe" | Extracted from conversations |
| **Facts** | "My business is a bakery in Amsterdam" | Explicit or extracted |
| **Dislikes** | "I hate carousels", "No popups" | Explicit statements |

## Technical Approach

### Memory Architecture

```
User says something
        ↓
   Memory Extraction (runs after each conversation)
        ↓
   Store in user_memories table
        ↓
   On new session: inject relevant memories into system prompt
```

### Memory Extraction

After each conversation (or periodically), extract memories:

```typescript
const extractionPrompt = `
Review this conversation and extract any user preferences,
decisions, or facts worth remembering long-term.

Return JSON:
{
  "memories": [
    {
      "type": "preference" | "decision" | "fact" | "dislike",
      "content": "User prefers minimal designs",
      "confidence": 0.9,
      "source": "explicit" | "inferred"
    }
  ]
}

Only extract things that should persist across sessions.
Don't extract temporary context or task-specific details.
`
```

### Memory Injection

On new session, retrieve and inject relevant memories:

```typescript
const memories = await getUserMemories(userId, workspaceId)

const systemPromptAddition = `
## What you know about this user

${memories.map(m => `- ${m.content}`).join('\n')}

Apply these preferences naturally. Don't mention that you "remember"
unless the user asks.
`
```

### Semantic Search (Phase 2)

For users with many memories, use embeddings to find relevant ones:

```typescript
// Instead of injecting ALL memories, find relevant ones
const relevantMemories = await searchMemories({
  userId,
  query: currentUserMessage,
  limit: 10
})
```

## Database Schema

```sql
-- User memories table
CREATE TABLE user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  workspace_id UUID REFERENCES domains(id),  -- NULL = applies to all workspaces

  type TEXT NOT NULL,  -- 'preference', 'decision', 'fact', 'dislike', 'brand'
  content TEXT NOT NULL,  -- "User prefers minimal designs"

  source TEXT NOT NULL,  -- 'explicit', 'inferred', 'extracted'
  confidence FLOAT DEFAULT 1.0,

  -- For semantic search (Phase 2)
  embedding VECTOR(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Memories can be invalidated/superseded
  is_active BOOLEAN DEFAULT TRUE,
  superseded_by UUID REFERENCES user_memories(id)
);

CREATE INDEX idx_user_memories_lookup ON user_memories(user_id, workspace_id, is_active);
CREATE INDEX idx_user_memories_embedding ON user_memories USING ivfflat (embedding vector_cosine_ops);
```

## User Controls

Users should be able to manage their memories:

1. **View memories:** Dashboard page showing what Claude remembers
2. **Delete memories:** Remove incorrect or outdated memories
3. **Add memories:** Explicitly tell Claude to remember something
4. **Export memories:** Download as JSON for portability

### UI Mockup

```
┌─────────────────────────────────────────────────┐
│ What Claude Remembers About You                 │
├─────────────────────────────────────────────────┤
│ 🎨 Preferences                                  │
│   • Prefers minimal, clean designs        [×]   │
│   • Likes dark mode                        [×]   │
│   • Wants professional tone               [×]   │
│                                                 │
│ 🏢 Your Business                                │
│   • Bakery called "Sweet Morning"          [×]   │
│   • Located in Amsterdam                   [×]   │
│   • Brand color: #FF5733                   [×]   │
│                                                 │
│ ❌ Things You Dislike                           │
│   • No popups or modals                    [×]   │
│   • No autoplay videos                     [×]   │
│                                                 │
│ [+ Add Memory]                    [Export All]  │
└─────────────────────────────────────────────────┘
```

## Privacy & Security

1. **User owns their data:** Can delete anytime
2. **Workspace isolation:** Memories can be workspace-specific
3. **No sharing:** Memories never shared between users
4. **Encryption:** Sensitive memories encrypted at rest
5. **Retention:** Option to auto-expire memories after N months

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Explicit memories ("Remember X") + basic injection | 2-3 days |
| Phase 2 | Automatic extraction from conversations | 3-4 days |
| Phase 3 | Semantic search for relevant memories | 2-3 days |
| Phase 4 | Memory management UI | 2-3 days |
| Total | Full memory system | ~2 weeks |

## Success Metrics

- % of users with at least 1 memory stored
- Reduction in repeated preference statements
- User satisfaction with "Claude knows me" feeling
- Memory accuracy (user corrections/deletions)

## Open Questions

1. How many memories before we need semantic search?
2. Should memories expire or persist forever by default?
3. How to handle conflicting memories? (User said X, then said not-X)
4. Should memories sync across workspaces or stay isolated?

## References

- [OpenClaw Memory System](https://docs.openclaw.ai/concepts/memory)
- OpenClaw's `src/memory/manager.ts` - 76K lines of memory management
- Our existing `use_this_to_remember.db` - agent memory, not user memory

# RFC: Vector Memory Search (Semantic Recall)

**Status:** Draft
**RFC ID:** RFC-2026-012
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

Add semantic search to user memories and conversation history. Instead of keyword matching, find relevant information based on meaning. "What did we discuss about pricing?" finds context even if "pricing" wasn't the exact word used.

## Problem

Our current `use_this_to_remember.db` uses simple keyword matching. This fails when:
- User asks about "costs" but we stored it as "pricing"
- User asks about "the blue design" but we stored "navy color scheme"
- User asks about a concept discussed weeks ago with different words

OpenClaw's memory system uses embeddings for semantic search - finding relevant memories based on meaning, not just keywords.

## User Stories

1. **Semantic recall:** "What did we decide about the header?" → Finds discussion about "navigation bar layout" from 2 weeks ago
2. **Cross-reference:** "Remember that restaurant I mentioned?" → Finds "bakery in Amsterdam" if that's what matches
3. **Fuzzy matching:** "Find emails about money stuff" → Matches "invoice", "payment", "billing" discussions
4. **Conversation history:** Search past sessions for relevant context without exact keywords

## Technical Approach

### Architecture

```
User query: "What did we discuss about pricing?"
        ↓
    Embed query (OpenAI/local)
        ↓
    Vector similarity search in SQLite
        ↓
    Return top N most similar memories
        ↓
    Inject into Claude's context
```

### 1. Embedding Provider

```typescript
// packages/shared/src/memory/embeddings.ts

export interface EmbeddingProvider {
  id: string
  model: string
  embed: (text: string) => Promise<number[]>
  embedBatch: (texts: string[]) => Promise<number[][]>
}

// OpenAI embeddings (remote, high quality)
export async function createOpenAIEmbeddingProvider(
  apiKey: string
): Promise<EmbeddingProvider> {
  return {
    id: 'openai',
    model: 'text-embedding-3-small',

    async embed(text: string): Promise<number[]> {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      })

      const data = await response.json()
      return data.data[0].embedding
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      })

      const data = await response.json()
      return data.data.map((d: any) => d.embedding)
    },
  }
}

// Local embeddings (free, private, requires setup)
export async function createLocalEmbeddingProvider(): Promise<EmbeddingProvider> {
  // Use node-llama-cpp or similar for local embeddings
  // Fallback option when no API key available
  throw new Error('Local embeddings not yet implemented')
}
```

### 2. Vector Storage with SQLite

Using `sqlite-vec` extension for vector similarity search:

```typescript
// packages/shared/src/memory/vector-store.ts

import Database from 'better-sqlite3'

const VECTOR_DIMS = 1536  // OpenAI text-embedding-3-small

export class VectorStore {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.loadExtension('sqlite-vec')
    this.initialize()
  }

  private initialize() {
    // Create virtual table for vector search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_vectors USING vec0(
        id TEXT PRIMARY KEY,
        embedding FLOAT[${VECTOR_DIMS}]
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_memories_user
        ON memories(user_id, workspace_id);
    `)
  }

  async addMemory(memory: {
    id: string
    userId: string
    workspaceId?: string
    type: string
    content: string
    source: string
    embedding: number[]
  }) {
    const { id, userId, workspaceId, type, content, source, embedding } = memory

    // Insert memory
    this.db.prepare(`
      INSERT INTO memories (id, user_id, workspace_id, type, content, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, workspaceId, type, content, source)

    // Insert embedding
    this.db.prepare(`
      INSERT INTO memory_vectors (id, embedding)
      VALUES (?, ?)
    `).run(id, new Float32Array(embedding))
  }

  async search(params: {
    userId: string
    workspaceId?: string
    queryEmbedding: number[]
    limit?: number
  }): Promise<Array<{ id: string; content: string; similarity: number }>> {
    const { userId, workspaceId, queryEmbedding, limit = 10 } = params

    // Vector similarity search with user filtering
    const results = this.db.prepare(`
      SELECT
        m.id,
        m.content,
        vec_distance_cosine(v.embedding, ?) as distance
      FROM memory_vectors v
      JOIN memories m ON v.id = m.id
      WHERE m.user_id = ?
        AND (m.workspace_id = ? OR m.workspace_id IS NULL)
      ORDER BY distance ASC
      LIMIT ?
    `).all(
      new Float32Array(queryEmbedding),
      userId,
      workspaceId,
      limit
    )

    return results.map((r: any) => ({
      id: r.id,
      content: r.content,
      similarity: 1 - r.distance,  // Convert distance to similarity
    }))
  }
}
```

### 3. Memory Manager

```typescript
// packages/shared/src/memory/manager.ts

export class MemoryManager {
  private vectorStore: VectorStore
  private embeddingProvider: EmbeddingProvider

  constructor(dbPath: string, embeddingProvider: EmbeddingProvider) {
    this.vectorStore = new VectorStore(dbPath)
    this.embeddingProvider = embeddingProvider
  }

  async addMemory(params: {
    userId: string
    workspaceId?: string
    type: 'preference' | 'fact' | 'decision' | 'context'
    content: string
    source: 'explicit' | 'extracted' | 'inferred'
  }) {
    const { userId, workspaceId, type, content, source } = params
    const id = crypto.randomUUID()

    // Generate embedding
    const embedding = await this.embeddingProvider.embed(content)

    // Store with vector
    await this.vectorStore.addMemory({
      id,
      userId,
      workspaceId,
      type,
      content,
      source,
      embedding,
    })

    return id
  }

  async searchMemories(params: {
    userId: string
    workspaceId?: string
    query: string
    limit?: number
  }) {
    // Embed the query
    const queryEmbedding = await this.embeddingProvider.embed(params.query)

    // Search by similarity
    return this.vectorStore.search({
      userId: params.userId,
      workspaceId: params.workspaceId,
      queryEmbedding,
      limit: params.limit,
    })
  }

  async getRelevantContext(params: {
    userId: string
    workspaceId?: string
    currentMessage: string
    maxTokens?: number
  }): Promise<string> {
    const memories = await this.searchMemories({
      userId: params.userId,
      workspaceId: params.workspaceId,
      query: params.currentMessage,
      limit: 10,
    })

    // Filter by relevance threshold
    const relevant = memories.filter(m => m.similarity > 0.7)

    if (relevant.length === 0) {
      return ''
    }

    // Format for Claude
    return `
## Relevant context from memory

${relevant.map(m => `- ${m.content}`).join('\n')}
`.trim()
  }
}
```

### 4. Integration with Chat

```typescript
// In Claude streaming endpoint
async function streamClaude(req, res, message, userId, workspaceId) {
  const memoryManager = getMemoryManager()

  // Search for relevant memories
  const context = await memoryManager.getRelevantContext({
    userId,
    workspaceId,
    currentMessage: message,
  })

  // Include in system prompt or user message
  const enhancedMessage = context
    ? `${context}\n\n---\n\nUser message: ${message}`
    : message

  const response = await claude.chat({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: enhancedMessage }],
    stream: true,
  })

  // ... stream response
}
```

### 5. Memory Extraction from Conversations

After each conversation, extract and store learnings:

```typescript
async function extractMemoriesFromConversation(
  userId: string,
  workspaceId: string,
  messages: Message[]
) {
  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')

  const response = await claude.chat({
    model: 'claude-3-5-haiku-20241022',  // Fast, cheap
    messages: [{
      role: 'user',
      content: `
Extract any facts, preferences, or decisions from this conversation
that would be useful to remember for future sessions.

Conversation:
${conversationText}

Return JSON array:
[
  { "type": "preference|fact|decision", "content": "..." },
  ...
]

Only include things that are:
- Likely to be relevant in future sessions
- Not temporary or task-specific
- Clear preferences or decisions (not just discussion)

Return empty array if nothing worth remembering.
      `
    }],
  })

  const extracted = JSON.parse(response.content)

  for (const memory of extracted) {
    await memoryManager.addMemory({
      userId,
      workspaceId,
      type: memory.type,
      content: memory.content,
      source: 'extracted',
    })
  }
}
```

## Hybrid Search

Combine vector search with keyword search for best results:

```typescript
async function hybridSearch(params: {
  userId: string
  query: string
  limit: number
}): Promise<SearchResult[]> {
  // Vector search (semantic)
  const vectorResults = await vectorStore.search({
    queryEmbedding: await embed(params.query),
    limit: params.limit * 2,
  })

  // Keyword search (exact matches)
  const keywordResults = await keywordStore.search({
    query: params.query,
    limit: params.limit * 2,
  })

  // Merge and rank
  const merged = mergeResults(vectorResults, keywordResults)

  // Re-rank using reciprocal rank fusion
  return rerankRRF(merged).slice(0, params.limit)
}

function rerankRRF(results: SearchResult[]): SearchResult[] {
  const k = 60  // RRF constant
  const scores = new Map<string, number>()

  for (let i = 0; i < results.length; i++) {
    const id = results[i].id
    const rank = i + 1
    const current = scores.get(id) || 0
    scores.set(id, current + 1 / (k + rank))
  }

  return results
    .sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0))
}
```

## Database Schema (Full)

```sql
-- Main memories table
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  type TEXT NOT NULL,  -- 'preference', 'fact', 'decision', 'context'
  content TEXT NOT NULL,
  source TEXT NOT NULL,  -- 'explicit', 'extracted', 'inferred'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Vector index (using sqlite-vec)
CREATE VIRTUAL TABLE memory_vectors USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[1536]
);

-- Full-text search for keyword matching
CREATE VIRTUAL TABLE memories_fts USING fts5(
  id,
  content,
  content='memories',
  content_rowid='rowid'
);

-- Keep FTS in sync
CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(id, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
  DELETE FROM memories_fts WHERE id = old.id;
END;

CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
  DELETE FROM memories_fts WHERE id = old.id;
  INSERT INTO memories_fts(id, content) VALUES (new.id, new.content);
END;

-- Indexes
CREATE INDEX idx_memories_user ON memories(user_id);
CREATE INDEX idx_memories_workspace ON memories(workspace_id);
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_active ON memories(is_active);
```

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | OpenAI embedding provider | 1 day |
| Phase 2 | SQLite vector store with sqlite-vec | 2 days |
| Phase 3 | Memory manager + basic search | 2 days |
| Phase 4 | Integration with chat context | 1 day |
| Phase 5 | Memory extraction from conversations | 2 days |
| Phase 6 | Hybrid search (vector + keyword) | 1-2 days |
| Total | Full vector memory | ~2 weeks |

## Cost Considerations

| Component | Cost |
|-----------|------|
| OpenAI embeddings | ~$0.02 per 1M tokens |
| Storage | Minimal (SQLite) |
| Per memory | ~$0.00002 (500 tokens avg) |
| Per search | ~$0.00001 (100 tokens avg) |

For a user with 1000 memories and 100 searches/day: ~$0.05/month

## Success Metrics

- Relevance of retrieved memories (user feedback)
- Reduction in "I already told you..." frustrations
- Memory recall accuracy
- Search latency (<100ms target)

## References

- [OpenClaw memory/manager.ts](https://github.com/openclaw/openclaw) - 76K lines
- [OpenAI embeddings](https://platform.openai.com/docs/guides/embeddings)
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [RAG patterns](https://www.pinecone.io/learn/retrieval-augmented-generation/)

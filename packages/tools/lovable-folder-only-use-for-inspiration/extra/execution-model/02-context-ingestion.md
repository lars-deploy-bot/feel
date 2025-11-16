# Context Ingestion & Execution Pipeline

## Overview

This document explains HOW the `.lovable-internals/` directory contents become context available to the AI agent, WHEN ingestion happens, and WHERE the execution runtime lives.

**Critical Concept**: The execution model is NOT code that runs - it's documentation that the Lovable platform reads and transforms into structured prompt context.

---

## The Complete Ingestion Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 1: PROJECT LOAD                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When: User opens project OR makes first request in session     │
│  Where: Lovable Platform Backend (Node.js/Deno runtime)         │
│                                                                  │
│  Actions:                                                        │
│  1. Scan project directory tree                                 │
│  2. Identify all files in .lovable-internals/                   │
│  3. Build index of available knowledge patterns                 │
│  4. Cache directory structure                                   │
│                                                                  │
│  Output: Project manifest with knowledge base index             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 2: REQUEST PREPROCESSING                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When: User sends message in chat                               │
│  Where: Lovable Platform Backend                                │
│                                                                  │
│  Actions:                                                        │
│  1. Parse user intent (keyword matching, ML classification)     │
│  2. Select relevant knowledge patterns:                         │
│     • Authentication request → knowledge-base/03-auth.md        │
│     • Database request → knowledge-base/05-database.md          │
│     • Security request → knowledge-base/06-security.md          │
│  3. Load workflow decision trees from /workflows/               │
│  4. Load current project files (selective or full)              │
│  5. Assemble XML context structure                              │
│                                                                  │
│  Output: Structured prompt with <tags>                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 3: CONTEXT ASSEMBLY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When: Immediately before AI API call                           │
│  Where: Lovable Platform Backend                                │
│                                                                  │
│  Context Structure Built:                                        │
│                                                                  │
│  <current-code>                                                  │
│    • Project files (selected based on relevance)                │
│    • Open files in editor (always included)                     │
│    • Recently modified files (last 5 interactions)              │
│    • Files matching search terms                                │
│  </current-code>                                                 │
│                                                                  │
│  <useful-context>                                                │
│    • Selected knowledge-base/*.md files                         │
│    • Relevant guidance/*.md patterns                            │
│    • Active workflow decision tree                              │
│    • Design system rules                                        │
│  </useful-context>                                               │
│                                                                  │
│  <current-view>                                                  │
│    • UI state (editor/preview/cloud tab)                        │
│    • Selected files                                             │
│    • Search query if active                                     │
│  </current-view>                                                 │
│                                                                  │
│  <dependencies>                                                  │
│    • package.json parsed                                        │
│    • All installed packages with versions                       │
│  </dependencies>                                                 │
│                                                                  │
│  <read-only-files>                                               │
│    • List of protected files                                    │
│    • Cannot be modified by AI                                   │
│  </read-only-files>                                              │
│                                                                  │
│  <role> + <instructions-reminder>                                │
│    • Core behavioral rules                                      │
│    • Capabilities and constraints                               │
│    • Refreshed every turn                                       │
│  </role>                                                         │
│                                                                  │
│  Token Budget Management:                                        │
│  • Context fits within model's window (e.g., 200k tokens)       │
│  • Summarize large files if needed                              │
│  • Prioritize recent/relevant content                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 4: AI AGENT EXECUTION                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When: Context assembled, ready for inference                   │
│  Where: AI Model API (Claude, GPT-4, etc.)                      │
│                                                                  │
│  The AI receives:                                                │
│  1. System prompt (role + instructions)                         │
│  2. Structured context (all XML tags)                           │
│  3. Conversation history                                         │
│  4. Tool definitions (31 tools with schemas)                    │
│  5. User's latest message                                       │
│                                                                  │
│  The AI processes:                                               │
│  • Parse execution-model decision trees                         │
│  • Match request to workflow pattern                            │
│  • Select appropriate tools                                     │
│  • Generate tool calls or text response                         │
│                                                                  │
│  Output: Response + tool calls (JSON)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 5: TOOL EXECUTION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  When: AI returns tool calls                                    │
│  Where: Lovable Platform Backend                                │
│                                                                  │
│  For each tool call:                                             │
│  1. Validate parameters                                          │
│  2. Execute against project:                                     │
│     • File operations → Modify git working tree                 │
│     • Backend operations → Call Supabase API                    │
│     • Debug operations → Query browser runtime                  │
│     • Security operations → Run scanners                        │
│     • External operations → Web search, image gen               │
│  3. Collect results                                              │
│  4. Update project state                                         │
│                                                                  │
│  Output: Tool results (success/error + data)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 6: ITERATION LOOP                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Decision: Does AI need more context or actions?                │
│                                                                  │
│  ├─→ YES: Return to STAGE 4 with tool results                   │
│  │   • AI sees results in conversation history                  │
│  │   • Can make follow-up tool calls                            │
│  │   • Can read newly created files                             │
│  │                                                               │
│  └─→ NO: Proceed to response delivery                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 7: RESPONSE DELIVERY                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Actions:                                                        │
│  1. Format final message to user                                │
│  2. Update conversation history                                 │
│  3. Trigger hot-reload if files changed                         │
│  4. Update UI state (show file changes, errors)                 │
│  5. Cache updated project state                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Context Selection Logic

### Knowledge Base Selection (Semantic Matching)

**Mechanism**: Keyword-based pattern matching + ML intent classification

```typescript
// Pseudo-code representation
function selectKnowledgePatterns(userMessage: string, conversationHistory: Message[]): string[] {
  const patterns = [];
  
  // Always include
  patterns.push('knowledge-base/README.md');
  
  // Authentication keywords
  if (matches(userMessage, ['login', 'signup', 'auth', 'user', 'session'])) {
    patterns.push('knowledge-base/03-authentication-patterns.md');
  }
  
  // Database keywords
  if (matches(userMessage, ['database', 'table', 'schema', 'sql', 'data'])) {
    patterns.push('knowledge-base/02-supabase-integration-patterns.md');
    patterns.push('core/05-database-patterns.md');
  }
  
  // Security keywords
  if (matches(userMessage, ['security', 'rls', 'policy', 'vulnerability', 'audit'])) {
    patterns.push('knowledge-base/06-security-critical-rules.md');
    patterns.push('knowledge-base/07-rls-patterns.md');
  }
  
  // Edge function keywords
  if (matches(userMessage, ['edge function', 'api', 'backend', 'server', 'endpoint'])) {
    patterns.push('knowledge-base/04-edge-function-patterns.md');
  }
  
  // AI integration keywords
  if (matches(userMessage, ['ai', 'openai', 'gpt', 'claude', 'chatbot', 'replicate'])) {
    patterns.push('knowledge-base/05-ai-integration-complete.md');
  }
  
  // Storage keywords
  if (matches(userMessage, ['upload', 'file', 'storage', 'bucket', 'image'])) {
    patterns.push('knowledge-base/08-storage-patterns.md');
  }
  
  // Design keywords
  if (matches(userMessage, ['style', 'design', 'color', 'css', 'tailwind', 'theme'])) {
    patterns.push('design-system/01-color-system.md');
    patterns.push('design-system/02-component-variants.md');
  }
  
  // Context from previous messages (conversation flow)
  const recentTopics = extractTopics(conversationHistory.slice(-3));
  patterns.push(...recentTopics.relatedPatterns);
  
  return patterns;
}
```

### Workflow Selection (Decision Tree Matching)

```typescript
function selectWorkflow(userMessage: string, projectState: ProjectState): string {
  // Authentication workflow
  if (matches(userMessage, ['login', 'signup', 'authentication', 'user accounts'])) {
    return 'workflows/01-authentication-request.md';
  }
  
  // Debugging workflow
  if (matches(userMessage, ['error', 'bug', 'not working', 'broken', 'issue']) 
      || hasErrors(projectState.consoleLogs)) {
    return 'workflows/02-bug-debugging-request.md';
  }
  
  // Feature implementation workflow
  if (matches(userMessage, ['add', 'create', 'implement', 'build', 'new feature'])) {
    return 'workflows/03-new-feature-request.md';
  }
  
  // External API workflow
  if (matches(userMessage, ['api', 'integration', 'connect to', 'stripe', 'openai'])) {
    return 'workflows/04-external-api-integration.md';
  }
  
  // Styling workflow
  if (matches(userMessage, ['style', 'color', 'design', 'looks', 'appearance'])) {
    return 'workflows/05-styling-design-request.md';
  }
  
  // Database workflow
  if (matches(userMessage, ['database', 'table', 'schema', 'data model'])) {
    return 'workflows/06-database-table-creation.md';
  }
  
  // File upload workflow
  if (matches(userMessage, ['upload', 'file upload', 'storage'])) {
    return 'workflows/07-file-upload-storage.md';
  }
  
  // Security workflow
  if (matches(userMessage, ['security', 'vulnerability', 'audit', 'rls', 'policy'])) {
    return 'workflows/08-security-audit-request.md';
  }
  
  // Performance workflow
  if (matches(userMessage, ['slow', 'performance', 'optimize', 'speed up'])) {
    return 'workflows/09-performance-optimization-request.md';
  }
  
  // Default: General feature workflow
  return 'workflows/03-new-feature-request.md';
}
```

### Project File Selection (Relevance-Based)

```typescript
function selectProjectFiles(
  projectFiles: FileTree,
  openFiles: string[],
  searchQuery: string | null,
  conversationHistory: Message[]
): File[] {
  const selectedFiles = [];
  
  // 1. ALWAYS include open files in editor
  selectedFiles.push(...openFiles.map(path => readFile(path)));
  
  // 2. Include recently modified files (last 5 tool operations)
  const recentlyModified = extractModifiedFiles(conversationHistory, limit: 5);
  selectedFiles.push(...recentlyModified);
  
  // 3. Include files matching active search
  if (searchQuery) {
    const searchResults = searchFiles(projectFiles, searchQuery, limit: 10);
    selectedFiles.push(...searchResults);
  }
  
  // 4. Include files referenced in recent conversation
  const referencedPaths = extractFileReferences(conversationHistory.slice(-5));
  selectedFiles.push(...referencedPaths.map(readFile));
  
  // 5. Smart context expansion (related imports)
  const relatedFiles = findRelatedFiles(selectedFiles, projectFiles);
  selectedFiles.push(...relatedFiles.slice(0, 5)); // Limit to prevent bloat
  
  // 6. Token budget management
  const totalSize = calculateTokens(selectedFiles);
  if (totalSize > MAX_CODE_CONTEXT_TOKENS) {
    // Summarize large files or trim to most relevant
    return trimToTokenBudget(selectedFiles, MAX_CODE_CONTEXT_TOKENS);
  }
  
  return deduplicateFiles(selectedFiles);
}
```

---

## Ingestion Timing & Caching

### What's Cached vs. Dynamic

| Data Type | Cached? | Refresh Timing | Cache Location |
|-----------|---------|----------------|----------------|
| Project file tree | ✅ Yes | On file system changes | In-memory + Redis |
| `.lovable-internals/` index | ✅ Yes | On project load | In-memory |
| Knowledge base content | ✅ Yes | Static (versioned with platform) | CDN |
| Workflow decision trees | ✅ Yes | Static (versioned) | In-memory |
| User's project files | ❌ No | Read fresh each request | Git working tree |
| Console logs | ❌ No | Polled from browser | Real-time |
| Network requests | ❌ No | Polled from browser | Real-time |
| Supabase schema | ⚠️ Partial | Cached 5 min, refreshed on change | Redis |
| Conversation history | ✅ Yes | Updated per message | Database |

### Performance Optimizations

```typescript
// Pseudo-code for caching strategy
class ContextCache {
  // Static content (shipped with platform)
  private static KNOWLEDGE_BASE = preloadKnowledgeBase();
  private static WORKFLOWS = preloadWorkflows();
  private static DESIGN_SYSTEM = preloadDesignSystem();
  
  // Per-project cache (5-minute TTL)
  private projectManifestCache = new Map<ProjectId, ProjectManifest>();
  private supabaseSchemaCache = new Map<ProjectId, DatabaseSchema>();
  
  // Per-session cache
  private fileContentCache = new LRU<FilePath, FileContent>(maxSize: 100);
  
  async buildContext(request: UserRequest): Promise<PromptContext> {
    // 1. Get cached project manifest (or build if missing)
    const manifest = await this.getCachedManifest(request.projectId);
    
    // 2. Load static knowledge (instant - pre-loaded)
    const knowledgePatterns = this.selectKnowledge(request.message);
    
    // 3. Load project files (check cache first)
    const projectFiles = await this.loadProjectFiles(
      request.projectId, 
      request.openFiles,
      this.fileContentCache
    );
    
    // 4. Load dynamic runtime state (always fresh)
    const consoleLogs = await this.fetchConsoleLogs(request.sessionId);
    const networkRequests = await this.fetchNetworkRequests(request.sessionId);
    
    // 5. Assemble XML structure
    return this.assembleXML({
      code: projectFiles,
      knowledge: knowledgePatterns,
      view: request.uiState,
      deps: manifest.dependencies,
      readOnly: manifest.readOnlyFiles,
      logs: consoleLogs,
      network: networkRequests
    });
  }
}
```

---

## Runtime Architecture

### Where Each Component Lives

```
┌──────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Lovable Web Editor UI                                 │  │
│  │  • Monaco editor (code viewing)                        │  │
│  │  • Chat interface                                      │  │
│  │  • Live preview iframe                                 │  │
│  │  • File tree explorer                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                   │
│                           │ WebSocket/HTTP                    │
│                           ▼                                   │
└──────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│         LOVABLE PLATFORM BACKEND                              │
│                           │                                   │
│  ┌────────────────────────▼────────────────────────────────┐ │
│  │  Context Assembly Service (Node.js/Deno)                │ │
│  │  • Scans .lovable-internals/                            │ │
│  │  • Selects knowledge patterns                           │ │
│  │  • Builds XML context structure                         │ │
│  │  • Manages token budgets                                │ │
│  └────────────────────────┬────────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼────────────────────────────────┐ │
│  │  AI Orchestration Layer                                 │ │
│  │  • Sends prompt to AI model API                         │ │
│  │  • Receives responses + tool calls                      │ │
│  │  • Manages conversation state                           │ │
│  └────────────────────────┬────────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼────────────────────────────────┐ │
│  │  Tool Execution Engine                                  │ │
│  │  • File operations → Git working tree                   │ │
│  │  • Backend operations → Supabase API calls              │ │
│  │  • Debug operations → Browser DevTools protocol         │ │
│  │  • Security operations → Scanner execution              │ │
│  │  • External operations → Third-party APIs               │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│         EXTERNAL SERVICES │                                   │
│                           │                                   │
│  ┌────────────────────────▼────────────────────────────────┐ │
│  │  AI Model APIs                                          │ │
│  │  • Claude (Anthropic)                                   │ │
│  │  • GPT-4 (OpenAI)                                       │ │
│  │  • Gemini (Google)                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  User's Supabase Project (Lovable Cloud)               │ │
│  │  • PostgreSQL database                                  │ │
│  │  • Edge Functions runtime                               │ │
│  │  • Storage buckets                                      │ │
│  │  • Auth service                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow for Single Request

```
User types "Add login" in chat
         │
         ▼
[Browser] → WebSocket message → [Platform Backend]
         │
         ▼
[Context Assembly Service]
  1. Read .lovable-internals/workflows/01-authentication-request.md
  2. Read .lovable-internals/knowledge-base/03-authentication-patterns.md
  3. Read guidance/11-supabase-authentication-implementation.md
  4. Read project files: src/App.tsx, src/main.tsx, etc.
  5. Assemble into XML: <role>...<useful-context>...<current-code>...
         │
         ▼
[AI Orchestration Layer]
  1. Add system prompt + conversation history
  2. Send to Claude API
  3. Receive response with tool calls:
     - supabase--enable()
     - lov-write("src/components/LoginForm.tsx", ...)
         │
         ▼
[Tool Execution Engine]
  1. Execute supabase--enable() → Provision Supabase project
  2. Execute lov-write() → Create LoginForm.tsx in git tree
  3. Collect results
         │
         ▼
[AI Orchestration Layer]
  1. Send tool results back to Claude
  2. Claude generates final user message
         │
         ▼
[Browser] ← WebSocket message ← [Platform Backend]
  - Display message in chat
  - Show LoginForm.tsx in file tree
  - Trigger hot-reload of preview iframe
```

---

## Implementation Guide: Replicate This Pattern

### For Building Similar AI Coding Assistants

If you want to build a system like Lovable, here's how to implement the context ingestion pattern:

#### 1. Project Structure

```
your-project/
├── .ai-knowledge/              # Your version of .lovable-internals/
│   ├── workflows/              # Decision trees for AI
│   ├── knowledge-base/         # Implementation patterns
│   └── execution-model/        # This documentation!
├── src/                        # User's code
└── your-backend/
    ├── context-assembly/       # The ingestion engine
    ├── ai-orchestration/       # API calls to AI models
    └── tool-execution/         # Execute AI's tool calls
```

#### 2. Context Assembly Engine (TypeScript/Python)

```typescript
// context-assembly/engine.ts
import fs from 'fs';
import path from 'path';

interface ContextConfig {
  knowledgeDir: string;
  workflowsDir: string;
  projectRoot: string;
  maxTokens: number;
}

class ContextAssemblyEngine {
  constructor(private config: ContextConfig) {}
  
  async assembleContext(userMessage: string, projectId: string): Promise<string> {
    // 1. Scan knowledge directory
    const knowledgeIndex = this.scanKnowledgeBase();
    
    // 2. Select relevant patterns
    const selectedPatterns = this.selectPatterns(userMessage, knowledgeIndex);
    
    // 3. Load project files
    const projectFiles = await this.loadProjectFiles(projectId);
    
    // 4. Build XML structure
    const context = this.buildXML({
      knowledge: selectedPatterns,
      code: projectFiles,
      message: userMessage
    });
    
    // 5. Validate token budget
    if (this.countTokens(context) > this.config.maxTokens) {
      return this.trimContext(context);
    }
    
    return context;
  }
  
  private scanKnowledgeBase(): Map<string, FileMetadata> {
    const knowledgeBase = new Map();
    
    const scanDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith('.md')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const metadata = this.extractMetadata(content);
          knowledgeBase.set(fullPath, {
            path: fullPath,
            content,
            keywords: metadata.keywords,
            category: metadata.category
          });
        }
      }
    };
    
    scanDir(this.config.knowledgeDir);
    return knowledgeBase;
  }
  
  private selectPatterns(
    userMessage: string, 
    index: Map<string, FileMetadata>
  ): FileContent[] {
    const selected: FileContent[] = [];
    const messageLower = userMessage.toLowerCase();
    
    // Keyword matching
    for (const [path, metadata] of index) {
      const matchScore = this.calculateMatchScore(messageLower, metadata.keywords);
      if (matchScore > 0.3) { // Threshold
        selected.push({
          path,
          content: metadata.content,
          relevance: matchScore
        });
      }
    }
    
    // Sort by relevance
    selected.sort((a, b) => b.relevance - a.relevance);
    
    // Return top N most relevant
    return selected.slice(0, 5);
  }
  
  private buildXML(data: ContextData): string {
    return `
<role>
You are an AI coding assistant with access to knowledge patterns and tools.
</role>

<useful-context>
${data.knowledge.map(k => `
<pattern source="${k.path}">
${k.content}
</pattern>
`).join('')}
</useful-context>

<current-code>
${data.code.map(f => `
<file path="${f.path}">
${f.content}
</file>
`).join('')}
</current-code>

<instructions-reminder>
- Use the patterns from useful-context to guide your implementation
- Make minimal changes needed
- Always consider refactoring for better architecture
</instructions-reminder>
`;
  }
}

export default ContextAssemblyEngine;
```

#### 3. AI Orchestration Layer

```typescript
// ai-orchestration/orchestrator.ts
import Anthropic from '@anthropic-ai/sdk';

class AIOrchestrator {
  private client: Anthropic;
  
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }
  
  async processRequest(
    context: string, 
    userMessage: string,
    conversationHistory: Message[]
  ): Promise<AIResponse> {
    // 1. Build messages array
    const messages = [
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    
    // 2. Call AI with tool definitions
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8096,
      system: context, // Your assembled context goes here
      messages: messages,
      tools: this.getToolDefinitions()
    });
    
    // 3. Extract tool calls
    const toolCalls = this.extractToolCalls(response);
    
    return {
      text: response.content,
      toolCalls: toolCalls,
      stopReason: response.stop_reason
    };
  }
  
  private getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'read_file',
        description: 'Read contents of a file from the project',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to file' }
          },
          required: ['file_path']
        }
      },
      {
        name: 'write_file',
        description: 'Create or overwrite a file',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['file_path', 'content']
        }
      },
      // ... more tools
    ];
  }
}
```

#### 4. Tool Execution Engine

```typescript
// tool-execution/executor.ts
class ToolExecutor {
  async executeTool(toolCall: ToolCall, projectId: string): Promise<ToolResult> {
    switch (toolCall.name) {
      case 'read_file':
        return this.readFile(toolCall.parameters.file_path, projectId);
      
      case 'write_file':
        return this.writeFile(
          toolCall.parameters.file_path,
          toolCall.parameters.content,
          projectId
        );
      
      // ... more tools
      
      default:
        throw new Error(`Unknown tool: ${toolCall.name}`);
    }
  }
  
  private async writeFile(
    filePath: string, 
    content: string, 
    projectId: string
  ): Promise<ToolResult> {
    const fullPath = path.join(this.getProjectRoot(projectId), filePath);
    
    // Validate path (security!)
    if (!this.isPathSafe(fullPath, projectId)) {
      return { success: false, error: 'Invalid path' };
    }
    
    try {
      // Write to git working tree
      fs.writeFileSync(fullPath, content, 'utf-8');
      
      // Trigger hot-reload
      await this.triggerHotReload(projectId);
      
      return { success: true, message: `Created ${filePath}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

#### 5. Main Request Handler

```typescript
// index.ts
async function handleUserRequest(req: Request) {
  const { projectId, message, conversationHistory } = req.body;
  
  // 1. Assemble context
  const contextEngine = new ContextAssemblyEngine(config);
  const context = await contextEngine.assembleContext(message, projectId);
  
  // 2. Call AI
  const orchestrator = new AIOrchestrator(process.env.ANTHROPIC_API_KEY);
  const aiResponse = await orchestrator.processRequest(context, message, conversationHistory);
  
  // 3. Execute tools
  const executor = new ToolExecutor();
  const toolResults = [];
  for (const toolCall of aiResponse.toolCalls) {
    const result = await executor.executeTool(toolCall, projectId);
    toolResults.push(result);
  }
  
  // 4. If AI needs more context, iterate
  if (aiResponse.stopReason === 'tool_use') {
    // Send tool results back to AI
    const followUp = await orchestrator.processRequest(
      context,
      '', // No new user message
      [...conversationHistory, { role: 'assistant', content: aiResponse.text, tool_calls: aiResponse.toolCalls }],
      toolResults
    );
    
    return { message: followUp.text, toolResults };
  }
  
  // 5. Return final response
  return { message: aiResponse.text, toolResults };
}
```

---

## Key Differences from Other Approaches

### ❌ Bad Pattern: Dumping Everything

```typescript
// Don't do this - wastes tokens, slow, expensive
const allKnowledge = fs.readdirSync('.ai-knowledge')
  .map(f => fs.readFileSync(f, 'utf-8'))
  .join('\n');

const prompt = `${allKnowledge}\n\nUser: ${message}`;
```

### ✅ Good Pattern: Selective Context Assembly

```typescript
// Do this - intelligent selection, token-efficient
const relevantPatterns = selectPatterns(message, knowledgeIndex);
const relevantFiles = selectFiles(openFiles, recentFiles);
const context = buildXML({ patterns: relevantPatterns, files: relevantFiles });
```

### ❌ Bad Pattern: No Caching

```typescript
// Don't re-read static content every request
const workflows = fs.readdirSync('.ai-knowledge/workflows')
  .map(readFile); // Expensive I/O every time
```

### ✅ Good Pattern: Multi-Layer Caching

```typescript
// Static content cached at startup, project manifests cached per session
const STATIC_KNOWLEDGE = preloadAtStartup();
const projectCache = new TTLCache(5 * 60 * 1000); // 5-minute TTL
```

---

## Debugging the Pipeline

### How to verify context is correctly assembled:

1. **Log the final prompt before sending to AI**
```typescript
console.log('=== CONTEXT SENT TO AI ===');
console.log(context);
console.log('=== END CONTEXT ===');
```

2. **Verify knowledge selection**
```typescript
console.log('Selected patterns:', selectedPatterns.map(p => p.path));
console.log('Match scores:', selectedPatterns.map(p => p.relevance));
```

3. **Monitor token usage**
```typescript
const tokens = countTokens(context);
console.log(`Context size: ${tokens} tokens (max: ${MAX_TOKENS})`);
if (tokens > MAX_TOKENS * 0.9) {
  console.warn('⚠️ Approaching token limit, consider trimming');
}
```

4. **Test pattern matching**
```typescript
testPatternSelection('add login', expectedPatterns: [
  'knowledge-base/03-authentication-patterns.md',
  'workflows/01-authentication-request.md'
]);
```

---

## Performance Metrics

Expected performance for context assembly:

| Operation | Target Time | Notes |
|-----------|-------------|-------|
| Knowledge base scan (cold start) | < 100ms | One-time at service startup |
| Pattern selection | < 10ms | Cached index, O(n) keyword matching |
| Project file loading | < 50ms | Depends on file count/size |
| XML assembly | < 5ms | String concatenation |
| **Total context assembly** | **< 150ms** | Full request preprocessing |

Optimization opportunities:
- Pre-compute keyword indexes at startup
- Use vector embeddings for semantic matching (instead of keyword)
- Stream context to AI incrementally (if model supports)
- Compress large files before including in context

---

## Security Considerations

**Critical**: The ingestion pipeline has access to all project files and can inject arbitrary context into AI prompts.

### Threats:

1. **Prompt Injection via Project Files**
   - Malicious content in `.lovable-internals/` could manipulate AI
   - **Mitigation**: Sandbox `.lovable-internals/` with strict schema validation

2. **Path Traversal in File Selection**
   - AI tool calls could try to read files outside project root
   - **Mitigation**: Validate all paths against project root

3. **Token Budget Attacks**
   - Attacker includes massive files to exhaust token budget
   - **Mitigation**: Hard limits on file sizes, token counting before inclusion

4. **Knowledge Base Poisoning**
   - If users can modify `.lovable-internals/`, they could inject bad patterns
   - **Mitigation**: `.lovable-internals/` is read-only in Lovable (managed by platform)

---

## Summary

### The Ingestion Pipeline in One Sentence

The Lovable platform **scans** `.lovable-internals/` at project load, **selects** relevant knowledge patterns based on user message keywords, **assembles** them into structured XML tags, and **injects** this context into the AI model's prompt before each request.

### Key Takeaways

1. **`.lovable-internals/` is NOT executable code** - it's documentation read by the platform
2. **Context selection is semantic** - keyword matching + ML classification
3. **Ingestion happens server-side** - in Lovable Platform Backend, not in browser
4. **Static content is cached** - workflows/knowledge base pre-loaded
5. **Dynamic content is fresh** - project files, logs, network read per request
6. **XML tags are the container** - structured format for AI to parse
7. **Token budgets drive selection** - can't include everything, must prioritize

### What Makes This Work

The power of this pattern comes from:
- **Separation of concerns**: Knowledge (docs) vs. execution (tools) vs. orchestration (platform)
- **Selective inclusion**: Only relevant patterns included, not entire knowledge base
- **Structured format**: XML tags give AI clear sections to reference
- **Versioned knowledge**: Workflows/patterns shipped with platform, always consistent
- **Efficient caching**: Static content pre-loaded, dynamic content cached intelligently

This pattern allows the AI to have "superhuman" memory of best practices without re-training the model, and enables rapid iteration on those practices without redeploying the model.

# Advanced Execution Patterns

## Beyond Basic Tool Calls

This document covers advanced patterns for complex multi-step workflows, conditional logic, error recovery, and optimization strategies.

---

## Pattern 1: Multi-Phase Workflows

### Problem
Complex features require multiple dependent tool calls where each phase depends on the previous phase's results.

### Example: Full Authentication Implementation

```
PHASE 1: Backend Setup
├─→ Check if Cloud enabled
│   └─→ If NO: supabase--enable()
│   └─→ If YES: continue
│
PHASE 2: Database Schema
├─→ Generate profiles table SQL
├─→ Generate RLS policies
└─→ Present to user for execution
│
PHASE 3: Frontend Hooks
├─→ Read existing auth patterns
├─→ lov-write("src/hooks/useAuth.tsx")
└─→ lov-write("src/contexts/AuthContext.tsx")
│
PHASE 4: UI Components
├─→ lov-write("src/pages/Login.tsx")
├─→ lov-write("src/pages/Signup.tsx")
└─→ lov-write("src/components/AuthGuard.tsx")
│
PHASE 5: Integration
├─→ lov-view("src/App.tsx")
├─→ lov-line-replace(...) → Add AuthContext provider
└─→ lov-line-replace(...) → Add protected routes
```

### Implementation Pattern

```typescript
// AI orchestration (pseudo-code showing the logical flow)
async function executeAuthenticationWorkflow(context: WorkflowContext) {
  // PHASE 1: Backend
  const cloudStatus = await checkSupabaseEnabled();
  if (!cloudStatus.enabled) {
    await callTool('supabase--enable', {});
    // Wait for AI to receive result, then continue
  }
  
  // PHASE 2: Schema (AI generates SQL, doesn't execute)
  const schemaSQL = generateAuthSchema();
  return { 
    phase: 'schema_ready',
    sql: schemaSQL,
    nextAction: 'user_executes_sql'
  };
  
  // User executes SQL in Supabase dashboard
  // User returns to chat: "SQL executed"
  
  // PHASE 3: Frontend hooks
  await Promise.all([
    callTool('lov-write', { 
      file_path: 'src/hooks/useAuth.tsx',
      content: generateAuthHook(context)
    }),
    callTool('lov-write', {
      file_path: 'src/contexts/AuthContext.tsx',
      content: generateAuthContext(context)
    })
  ]);
  
  // PHASE 4: UI components (parallel execution)
  await Promise.all([
    callTool('lov-write', { file_path: 'src/pages/Login.tsx', content: generateLoginPage() }),
    callTool('lov-write', { file_path: 'src/pages/Signup.tsx', content: generateSignupPage() }),
    callTool('lov-write', { file_path: 'src/components/AuthGuard.tsx', content: generateAuthGuard() })
  ]);
  
  // PHASE 5: Integration
  const appContent = await callTool('lov-view', { file_path: 'src/App.tsx' });
  await callTool('lov-line-replace', {
    file_path: 'src/App.tsx',
    search: findRouterSection(appContent),
    first_replaced_line: detectLineNumbers(appContent),
    last_replaced_line: detectLineNumbers(appContent),
    replace: addAuthProviderAndGuards(appContent)
  });
  
  return { phase: 'complete', message: 'Authentication fully implemented' };
}
```

**Key Insights:**
- Each phase is a checkpoint
- Parallel execution within phases
- User interaction between phases (SQL execution)
- State carried forward between phases

---

## Pattern 2: Conditional Tool Selection

### Problem
Tool calls should be conditional based on project state, not always executed blindly.

### Decision Tree

```
User: "Add database"
    │
    ▼
┌─────────────────────────────────┐
│ Check: Is Cloud enabled?        │
└─────────┬───────────────────────┘
          │
    ┌─────┴─────┐
    │           │
   YES          NO
    │           │
    │           └─→ supabase--enable()
    │               Wait for provisioning
    │               Proceed to schema
    │
    └─→ Cloud already enabled
        Check: Does table already exist?
            │
        ┌───┴───┐
        │       │
       YES      NO
        │       │
        │       └─→ Generate SQL for new table
        │           Present to user
        │
        └─→ Table exists
            Ask user:
            "Table already exists. Modify or create new?"
                │
            ┌───┴───┐
            │       │
        MODIFY    NEW
            │       │
            │       └─→ Generate SQL for new table
            │
            └─→ Read existing schema
                Generate ALTER TABLE SQL
                Present to user
```

### Implementation

```typescript
async function smartDatabaseWorkflow(userRequest: string, context: ExecutionContext) {
  // 1. Check prerequisites
  const cloudEnabled = await isSupabaseEnabled(context.projectId);
  
  if (!cloudEnabled) {
    await callTool('supabase--enable', {});
    // AI will receive result and continue in next turn
    return { 
      message: 'Enabling Lovable Cloud...',
      nextStep: 'wait_for_provisioning'
    };
  }
  
  // 2. Parse user intent
  const tableName = extractTableName(userRequest);
  
  // 3. Check if table exists
  const schema = await getSupabaseSchema(context.projectId);
  const tableExists = schema.tables.some(t => t.name === tableName);
  
  if (tableExists) {
    // Table exists - ask for clarification
    return {
      message: `Table "${tableName}" already exists. Would you like to:
1. Modify the existing table
2. Create a new table with a different name`,
      awaitingUserChoice: true
    };
  }
  
  // 4. Generate SQL for new table
  const sql = generateTableSQL(tableName, userRequest);
  return {
    message: 'Here\'s the SQL to create your table:',
    sql: sql,
    instructions: 'Run this in your Supabase SQL Editor, then let me know when done.'
  };
}
```

---

## Pattern 3: Error Recovery & Retry Logic

### Problem
Tool calls can fail due to network issues, invalid parameters, or project state. AI needs to recover gracefully.

### Recovery Strategies

```typescript
async function robustToolExecution(
  toolName: string,
  parameters: any,
  context: ExecutionContext,
  maxRetries: number = 3
): Promise<ToolResult> {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeTool(toolName, parameters, context);
      
      // Success
      if (result.success) {
        return result;
      }
      
      // Recoverable errors
      if (result.error?.includes('File not found')) {
        // Maybe file was moved - search for it
        const searchResults = await executeTool('lov-search-files', {
          query: parameters.file_path.split('/').pop(), // filename only
          include_pattern: 'src/**'
        });
        
        if (searchResults.results.length > 0) {
          // Found it - retry with correct path
          parameters.file_path = searchResults.results[0].file;
          continue; // Retry
        }
      }
      
      if (result.error?.includes('Rate limit')) {
        // Exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await sleep(delayMs);
        continue; // Retry
      }
      
      if (result.error?.includes('Invalid path')) {
        // Security error - cannot recover
        return result;
      }
      
      // Unknown error - return it
      return result;
      
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          error: `Failed after ${maxRetries} attempts: ${error.message}`
        };
      }
      
      // Wait before retry
      await sleep(1000 * attempt);
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}
```

### AI Response to Errors

When a tool fails, the AI should:

1. **Analyze the error**
   ```
   Error: "File not found: src/components/Button.tsx"
   
   AI reasoning:
   - User asked to modify Button component
   - File doesn't exist at expected path
   - Options:
     a) Search for Button file elsewhere
     b) Create new Button file
     c) Ask user for clarification
   ```

2. **Choose recovery strategy**
   ```typescript
   // Strategy: Search first, then ask
   const searchResult = await lov-search-files("Button", "src/**/*.tsx");
   
   if (searchResult.results.length > 0) {
     // Found it - use actual path
     await lov-view(searchResult.results[0].file);
   } else {
     // Not found - ask user
     return "I couldn't find a Button component. Would you like me to create one?";
   }
   ```

3. **Communicate clearly**
   ```
   ❌ Bad: "Error occurred"
   ✅ Good: "I couldn't find the Button component at src/components/Button.tsx. 
            I searched the project and found ButtonOld.tsx - is that what you meant?"
   ```

---

## Pattern 4: Parallel Execution Optimization

### Problem
Sequential tool calls waste time. Identify opportunities for parallelization.

### Sequential vs Parallel

```typescript
// ❌ Sequential (slow - ~2 seconds total)
const file1 = await lov-view("src/App.tsx");          // 500ms
const file2 = await lov-view("src/components/Header.tsx");  // 500ms
const file3 = await lov-view("src/hooks/useAuth.tsx");      // 500ms
const file4 = await lov-view("src/lib/utils.ts");           // 500ms

// ✅ Parallel (fast - ~500ms total)
const [file1, file2, file3, file4] = await Promise.all([
  lov-view("src/App.tsx"),
  lov-view("src/components/Header.tsx"),
  lov-view("src/hooks/useAuth.tsx"),
  lov-view("src/lib/utils.ts")
]);
```

### Dependency Analysis

```typescript
// AI must analyze dependencies before parallelizing
function analyzeToolDependencies(toolCalls: ToolCall[]): ExecutionGraph {
  const graph = new Map<string, string[]>();
  
  for (const call of toolCalls) {
    // Does this tool depend on results of previous tools?
    const dependencies = [];
    
    if (call.name === 'lov-line-replace') {
      // Depends on file content - must read first
      const fileRead = toolCalls.find(t => 
        t.name === 'lov-view' && 
        t.parameters.file_path === call.parameters.file_path
      );
      if (fileRead) dependencies.push(fileRead.id);
    }
    
    if (call.name === 'lov-write' && needsSupabase(call.parameters.content)) {
      // Depends on Supabase being enabled
      const supabaseEnable = toolCalls.find(t => t.name === 'supabase--enable');
      if (supabaseEnable) dependencies.push(supabaseEnable.id);
    }
    
    graph.set(call.id, dependencies);
  }
  
  return graph;
}

// Execute in optimal order
async function executeOptimally(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  const graph = analyzeToolDependencies(toolCalls);
  const results = new Map<string, ToolResult>();
  
  // Topological sort to find execution order
  const layers = topologicalSort(graph);
  
  // Execute each layer in parallel
  for (const layer of layers) {
    const layerResults = await Promise.all(
      layer.map(toolId => {
        const call = toolCalls.find(c => c.id === toolId);
        return executeTool(call.name, call.parameters);
      })
    );
    
    layer.forEach((toolId, index) => {
      results.set(toolId, layerResults[index]);
    });
  }
  
  return Array.from(results.values());
}
```

### Example: Optimal Execution

```
Tool calls:
1. supabase--enable()
2. lov-write("supabase/functions/api/index.ts", ...)
3. lov-write("src/lib/api.ts", ...)
4. lov-view("src/App.tsx")
5. lov-line-replace("src/App.tsx", ...)

Dependency graph:
1: [] (no deps)
2: [1] (needs Supabase)
3: [] (no deps)
4: [] (no deps)
5: [4] (needs file content)

Execution layers:
Layer 0: [1, 3, 4] (parallel)
Layer 1: [2, 5] (parallel, after layer 0)

Time: 2 layers × 500ms = 1 second
vs Sequential: 5 × 500ms = 2.5 seconds
```

---

## Pattern 5: Smart Context Loading

### Problem
Loading too much context wastes tokens and slows requests. Load only what's needed.

### Progressive Context Loading

```typescript
// Phase 1: Load minimal context
const initialFiles = [
  ...getOpenFiles(),           // Files user is viewing
  ...getRecentlyModified(5)    // Last 5 edited files
];

// Phase 2: If AI needs more, load related files
if (aiNeedsMoreContext()) {
  const additionalFiles = [
    ...findImports(initialFiles),     // Files imported by initial files
    ...findExporters(targetSymbol),   // Files that export symbol user mentioned
    ...searchByKeyword(userMessage)   // Files matching user's keywords
  ];
}

// Phase 3: Search if still not enough
if (aiStillNeedsMore()) {
  const searchResults = await lov-search-files(
    extractSearchQuery(userMessage),
    "src/**"
  );
}
```

### Token Budget Management

```typescript
const MAX_CONTEXT_TOKENS = 100000; // Leave room for AI response

function buildContext(files: FileContent[]): string {
  let context = '';
  let tokenCount = 0;
  
  // Sort by relevance
  files.sort((a, b) => b.relevance - a.relevance);
  
  for (const file of files) {
    const fileTokens = estimateTokens(file.content);
    
    if (tokenCount + fileTokens > MAX_CONTEXT_TOKENS) {
      // Token budget exceeded - summarize remaining files
      const remaining = files.slice(files.indexOf(file));
      context += summarizeFiles(remaining);
      break;
    }
    
    context += formatFileForContext(file);
    tokenCount += fileTokens;
  }
  
  return context;
}

function summarizeFiles(files: FileContent[]): string {
  return `
<file-summary>
  Additional files not shown (token limit):
  ${files.map(f => `- ${f.path} (${f.lines} lines)`).join('\n')}
  
  Use lov-view() to read these files if needed.
</file-summary>
`;
}
```

---

## Pattern 6: Stateful Workflows

### Problem
Some workflows need to maintain state across multiple user messages.

### Conversation State Machine

```typescript
type ConversationState = 
  | { phase: 'initial' }
  | { phase: 'awaiting_backend_choice', options: string[] }
  | { phase: 'awaiting_sql_execution', sql: string }
  | { phase: 'implementing_frontend', backendReady: boolean }
  | { phase: 'complete' };

// State transitions
function transitionState(
  current: ConversationState,
  userMessage: string,
  toolResults: ToolResult[]
): ConversationState {
  
  if (current.phase === 'awaiting_backend_choice') {
    if (userMessage.includes('Lovable Cloud')) {
      return { 
        phase: 'awaiting_sql_execution',
        sql: generateAuthSQL()
      };
    }
  }
  
  if (current.phase === 'awaiting_sql_execution') {
    if (userMessage.includes('executed')) {
      return {
        phase: 'implementing_frontend',
        backendReady: true
      };
    }
  }
  
  if (current.phase === 'implementing_frontend') {
    const allComponentsCreated = toolResults.every(r => r.success);
    if (allComponentsCreated) {
      return { phase: 'complete' };
    }
  }
  
  return current;
}
```

### Implementation

```typescript
// Store state in conversation metadata
interface ConversationMetadata {
  workflowState: ConversationState;
  createdFiles: string[];
  pendingActions: string[];
}

async function handleUserMessage(
  message: string,
  conversationId: string
): Promise<Response> {
  
  // Load state
  const metadata = await loadConversationMetadata(conversationId);
  
  // Execute workflow based on current state
  const response = await executeWorkflowPhase(
    metadata.workflowState,
    message
  );
  
  // Transition to next state
  const nextState = transitionState(
    metadata.workflowState,
    message,
    response.toolResults
  );
  
  // Save state
  await saveConversationMetadata(conversationId, {
    ...metadata,
    workflowState: nextState,
    createdFiles: [...metadata.createdFiles, ...response.newFiles]
  });
  
  return response;
}
```

---

## Pattern 7: Rollback & Undo

### Problem
If a multi-step workflow fails partway through, need to undo changes.

### Transaction Pattern

```typescript
class WorkflowTransaction {
  private changes: Change[] = [];
  
  async execute(workflow: Workflow): Promise<WorkflowResult> {
    try {
      for (const step of workflow.steps) {
        const result = await this.executeStep(step);
        this.changes.push({
          step: step,
          result: result,
          undo: this.createUndoAction(step, result)
        });
      }
      
      return { success: true, changes: this.changes };
      
    } catch (error) {
      // Rollback all changes
      await this.rollback();
      return { 
        success: false, 
        error: error.message,
        rolledBack: true
      };
    }
  }
  
  private async rollback(): Promise<void> {
    // Undo in reverse order
    for (const change of this.changes.reverse()) {
      await change.undo();
    }
  }
  
  private createUndoAction(step: Step, result: ToolResult): UndoFunction {
    if (step.tool === 'lov-write') {
      // Undo: delete the file
      return async () => {
        await executeTool('lov-delete', { 
          file_path: step.parameters.file_path 
        });
      };
    }
    
    if (step.tool === 'lov-line-replace') {
      // Undo: restore original content
      return async () => {
        await executeTool('lov-line-replace', {
          file_path: step.parameters.file_path,
          search: result.newContent,
          replace: result.originalContent,
          first_replaced_line: step.parameters.first_replaced_line,
          last_replaced_line: step.parameters.last_replaced_line
        });
      };
    }
    
    // Other tools...
  }
}
```

---

## Performance Metrics

| Pattern | Time Savings | Complexity |
|---------|--------------|------------|
| Multi-phase workflows | N/A (organizational) | Medium |
| Conditional tool selection | 30-50% (avoids unnecessary calls) | Low |
| Error recovery | 20-40% (reduces failed attempts) | Medium |
| Parallel execution | 40-70% (depends on call count) | Low |
| Smart context loading | 15-30% (reduces token processing) | High |
| Stateful workflows | N/A (enables complex features) | High |
| Rollback transactions | N/A (safety mechanism) | High |

---

## Best Practices Summary

1. **Think in phases** - Break complex workflows into checkpoints
2. **Check before acting** - Validate state before tool calls
3. **Fail gracefully** - Always have recovery strategies
4. **Parallelize aggressively** - Identify independent operations
5. **Load progressively** - Start minimal, expand as needed
6. **Maintain state** - Track progress across messages
7. **Enable rollback** - Prepare undo actions for multi-step changes

These patterns enable the AI to handle production-grade complexity while maintaining reliability and performance.

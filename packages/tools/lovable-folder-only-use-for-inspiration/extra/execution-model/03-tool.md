# Tool Implementation Guide

## How Tools Work in the Lovable Execution Model

This guide explains HOW to implement tools that the AI agent can call, using the Lovable architecture as a reference.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  AI Model (Claude/GPT-4)                                    │
│  • Reads tool definitions from API request                  │
│  • Decides which tools to call based on context             │
│  • Returns JSON with tool calls: {name, parameters}         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Tool calls (JSON)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Platform Backend (Lovable/Your System)                     │
│  • Receives tool calls from AI response                     │
│  • Validates parameters                                     │
│  • Routes to appropriate executor                           │
│  • Executes against real systems (filesystem, APIs, etc.)   │
│  • Returns results to AI                                    │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight**: Tools are NOT part of the AI model - they're API specifications that the model knows about, and your backend implements.

---

## Tool Definition Schema

Every tool needs:
1. **Name** - Unique identifier (kebab-case)
2. **Description** - What the tool does (for AI to understand when to use it)
3. **Input Schema** - JSON Schema for parameters
4. **Implementation** - Backend function that executes the tool

### Example: File Reading Tool

```typescript
// 1. Tool Definition (sent to AI in API request)
const toolDefinition = {
  name: 'lov-view',
  description: 'Read file contents with optional line range. Use this when you need to see code that is not already in <current-code> or <useful-context>.',
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to file relative to project root, or virtual filesystem path (e.g., "src/App.tsx", "user-uploads://image.png")',
        example: 'src/components/Header.tsx'
      },
      lines: {
        type: 'string',
        description: 'Optional line ranges to read (e.g., "1-100, 200-300"). Defaults to first 500 lines.',
        example: '1-100, 200-300'
      }
    },
    required: ['file_path']
  }
};

// 2. Tool Implementation (backend function)
async function executeLovView(
  parameters: { file_path: string; lines?: string },
  context: ExecutionContext
): Promise<ToolResult> {
  // Validate parameters
  if (!parameters.file_path) {
    return { error: 'file_path is required' };
  }
  
  // Resolve path (handle virtual filesystems)
  const resolvedPath = resolvePath(parameters.file_path, context.projectId);
  
  // Security check
  if (!isPathSafe(resolvedPath, context.projectRoot)) {
    return { error: 'Access denied: path outside project root' };
  }
  
  // Check file exists
  if (!fs.existsSync(resolvedPath)) {
    return { error: `File not found: ${parameters.file_path}` };
  }
  
  // Read file
  const content = fs.readFileSync(resolvedPath, 'utf-8');
  
  // Apply line range if specified
  if (parameters.lines) {
    const filteredContent = filterLines(content, parameters.lines);
    return { 
      content: filteredContent,
      message: `Read ${parameters.file_path} (lines ${parameters.lines})`
    };
  }
  
  // Default: first 500 lines
  const lines = content.split('\n').slice(0, 500).join('\n');
  return { 
    content: lines,
    message: `Read ${parameters.file_path} (first 500 lines)`
  };
}

// 3. Tool Registration (map name → implementation)
const TOOL_REGISTRY = {
  'lov-view': executeLovView,
  'lov-write': executeLovWrite,
  'lov-search-files': executeLovSearchFiles,
  // ... all 31 tools
};
```

---

## Complete Tool Implementation Pattern

### 1. Define Tool Schema

Tools are defined in **OpenAPI / JSON Schema** format, compatible with Claude's tool use API:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, PropertySchema>;
    required?: string[];
  };
}

interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  example?: any;
  enum?: any[];
  items?: PropertySchema; // For arrays
  properties?: Record<string, PropertySchema>; // For objects
}
```

### 2. Implement Executor Function

```typescript
type ToolExecutor = (
  parameters: Record<string, any>,
  context: ExecutionContext
) => Promise<ToolResult>;

interface ExecutionContext {
  projectId: string;
  projectRoot: string;
  userId: string;
  conversationId: string;
  sessionId: string;
  // ... other context
}

interface ToolResult {
  success?: boolean;
  error?: string;
  message?: string;
  data?: any;
  // Tool-specific fields
}
```

### 3. Register Tool

```typescript
class ToolRegistry {
  private tools = new Map<string, ToolExecutor>();
  
  register(name: string, executor: ToolExecutor) {
    this.tools.set(name, executor);
  }
  
  async execute(
    name: string, 
    parameters: any, 
    context: ExecutionContext
  ): Promise<ToolResult> {
    const executor = this.tools.get(name);
    if (!executor) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    return await executor(parameters, context);
  }
  
  getDefinitions(): ToolDefinition[] {
    // Return array of all tool definitions for AI API
    return Array.from(this.tools.keys()).map(name => 
      this.getDefinition(name)
    );
  }
}
```

---

## Implementation Examples for Each Tool Category

### File Operations

```typescript
// lov-write: Create or overwrite file
async function executeLovWrite(params: { file_path: string; content: string }, ctx: ExecutionContext) {
  const fullPath = path.join(ctx.projectRoot, params.file_path);
  
  // Validate
  if (!isPathSafe(fullPath, ctx.projectRoot)) {
    return { error: 'Invalid path' };
  }
  
  // Check read-only files
  if (isReadOnly(params.file_path)) {
    return { error: `Cannot modify read-only file: ${params.file_path}` };
  }
  
  // Write file
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, params.content, 'utf-8');
  
  // Trigger hot-reload
  await triggerHotReload(ctx.projectId);
  
  return { 
    success: true, 
    message: `Created/updated ${params.file_path}` 
  };
}

// lov-line-replace: Modify specific lines
async function executeLovLineReplace(
  params: { 
    file_path: string; 
    search: string; 
    first_replaced_line: number; 
    last_replaced_line: number; 
    replace: string 
  }, 
  ctx: ExecutionContext
) {
  const fullPath = path.join(ctx.projectRoot, params.file_path);
  
  // Read file
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  
  // Validate line numbers
  if (params.first_replaced_line < 1 || params.last_replaced_line > lines.length) {
    return { error: 'Line numbers out of range' };
  }
  
  // Extract section to verify
  const sectionToReplace = lines
    .slice(params.first_replaced_line - 1, params.last_replaced_line)
    .join('\n');
  
  // Verify search pattern matches (handle ellipsis)
  if (!matchesWithEllipsis(sectionToReplace, params.search)) {
    return { error: 'Search pattern does not match specified lines' };
  }
  
  // Replace lines
  const newLines = [
    ...lines.slice(0, params.first_replaced_line - 1),
    ...params.replace.split('\n'),
    ...lines.slice(params.last_replaced_line)
  ];
  
  // Write back
  fs.writeFileSync(fullPath, newLines.join('\n'), 'utf-8');
  
  return { 
    success: true, 
    message: `Modified lines ${params.first_replaced_line}-${params.last_replaced_line} in ${params.file_path}` 
  };
}

// lov-search-files: Regex search
async function executeLovSearchFiles(
  params: { query: string; include_pattern: string; exclude_pattern?: string },
  ctx: ExecutionContext
) {
  const results: SearchResult[] = [];
  
  // Find matching files
  const files = glob.sync(params.include_pattern, {
    cwd: ctx.projectRoot,
    ignore: params.exclude_pattern ? [params.exclude_pattern] : []
  });
  
  // Search each file
  const regex = new RegExp(params.query, 'gi');
  for (const file of files) {
    const content = fs.readFileSync(path.join(ctx.projectRoot, file), 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      if (regex.test(line)) {
        results.push({
          file,
          line: index + 1,
          content: line,
          match: line.match(regex)?.[0]
        });
      }
    });
  }
  
  return { 
    success: true, 
    results, 
    message: `Found ${results.length} matches in ${files.length} files` 
  };
}
```

### Backend Operations

```typescript
// supabase--enable: Enable Lovable Cloud
async function executeSupabaseEnable(params: {}, ctx: ExecutionContext) {
  // Check if already enabled
  const project = await getProject(ctx.projectId);
  if (project.supabaseProjectId) {
    return { 
      error: 'Lovable Cloud already enabled for this project',
      projectId: project.supabaseProjectId 
    };
  }
  
  // Create Supabase project via API
  const supabaseProject = await createSupabaseProject({
    name: `${project.name}-backend`,
    region: 'us-west-1',
    plan: 'free'
  });
  
  // Link to Lovable project
  await linkSupabaseProject(ctx.projectId, supabaseProject.id);
  
  // Add secrets to project
  await addSecrets(ctx.projectId, {
    SUPABASE_URL: supabaseProject.url,
    SUPABASE_ANON_KEY: supabaseProject.anonKey
  });
  
  return {
    success: true,
    message: 'Lovable Cloud enabled',
    projectId: supabaseProject.id,
    url: supabaseProject.url
  };
}

// secrets--add_secret: Add environment variables
async function executeSecretsAddSecret(params: { secret_names: string[] }, ctx: ExecutionContext) {
  // Trigger UI prompt for user to enter secret values
  const userInput = await promptUserForSecrets(
    ctx.sessionId, 
    params.secret_names,
    'Please enter values for the following secrets:'
  );
  
  // User canceled
  if (!userInput) {
    return { error: 'Secret addition canceled by user' };
  }
  
  // Store encrypted secrets
  for (const name of params.secret_names) {
    await storeEncryptedSecret(ctx.projectId, name, userInput[name]);
  }
  
  // Deploy to Supabase edge functions
  await deploySecretsToSupabase(ctx.projectId, params.secret_names);
  
  return {
    success: true,
    message: `Added secrets: ${params.secret_names.join(', ')}`
  };
}
```

### Debugging Tools

```typescript
// lov-read-console-logs: Get browser console output
async function executeLovReadConsoleLogs(params: { search?: string }, ctx: ExecutionContext) {
  // Query browser DevTools protocol
  const logs = await queryBrowserLogs(ctx.sessionId);
  
  // Filter if search query provided
  const filteredLogs = params.search
    ? logs.filter(log => log.message.includes(params.search))
    : logs;
  
  // Format for display
  const formatted = filteredLogs.map(log => 
    `[${log.level}] ${log.timestamp}: ${log.message}\n${log.stackTrace || ''}`
  ).join('\n---\n');
  
  return {
    success: true,
    logs: filteredLogs,
    formatted,
    message: `Retrieved ${filteredLogs.length} console logs`
  };
}

// project_debug--sandbox-screenshot: Capture UI
async function executeProjectDebugSandboxScreenshot(params: { path: string }, ctx: ExecutionContext) {
  // Get sandbox iframe URL
  const sandboxUrl = getSandboxUrl(ctx.projectId, params.path);
  
  // Take screenshot using headless browser
  const screenshot = await captureScreenshot(sandboxUrl);
  
  // Save to temporary storage
  const screenshotPath = `tmp://screenshots/${ctx.sessionId}/${Date.now()}.png`;
  await saveToVirtualFS(screenshotPath, screenshot);
  
  return {
    success: true,
    path: screenshotPath,
    url: sandboxUrl,
    message: `Screenshot saved to ${screenshotPath}`
  };
}
```

### Security Tools

```typescript
// security--run_security_scan: Comprehensive audit
async function executeSecurityRunSecurityScan(params: {}, ctx: ExecutionContext) {
  // Get Supabase project info
  const project = await getLinkedSupabaseProject(ctx.projectId);
  if (!project) {
    return { error: 'Lovable Cloud not enabled' };
  }
  
  // Run scanners
  const [rlsFindings, authFindings, storageFindings, codeFindings] = await Promise.all([
    scanRLSPolicies(project.id),
    scanAuthConfig(project.id),
    scanStorageBuckets(project.id),
    scanProjectCode(ctx.projectRoot)
  ]);
  
  // Aggregate findings
  const allFindings = [
    ...rlsFindings,
    ...authFindings,
    ...storageFindings,
    ...codeFindings
  ];
  
  // Store scan results
  await storeScanResults(ctx.projectId, {
    timestamp: new Date(),
    findings: allFindings,
    summary: {
      critical: allFindings.filter(f => f.level === 'error').length,
      warnings: allFindings.filter(f => f.level === 'warn').length,
      info: allFindings.filter(f => f.level === 'info').length
    }
  });
  
  return {
    success: true,
    findings: allFindings,
    message: `Scan complete: ${allFindings.length} findings`
  };
}
```

### External APIs

```typescript
// websearch--web_search: Google search
async function executeWebsearchWebSearch(
  params: { query: string; numResults?: number; category?: string },
  ctx: ExecutionContext
) {
  // Call external search API
  const results = await searchWeb({
    query: params.query,
    limit: params.numResults || 5,
    category: params.category
  });
  
  // Extract text content for each result
  const enrichedResults = await Promise.all(
    results.map(async (result) => ({
      ...result,
      content: await extractTextContent(result.url)
    }))
  );
  
  return {
    success: true,
    results: enrichedResults,
    message: `Found ${enrichedResults.length} results for "${params.query}"`
  };
}

// imagegen--generate_image: AI image generation
async function executeImagegenGenerateImage(
  params: { prompt: string; target_path: string; width?: number; height?: number; model?: string },
  ctx: ExecutionContext
) {
  // Default dimensions
  const width = params.width || 1024;
  const height = params.height || 1024;
  const model = params.model || 'flux.schnell';
  
  // Validate dimensions
  if (width < 512 || width > 1920 || width % 32 !== 0) {
    return { error: 'Width must be 512-1920 and multiple of 32' };
  }
  
  // Call image generation API
  const imageData = await generateImage({
    prompt: params.prompt,
    width,
    height,
    model
  });
  
  // Save to project
  const fullPath = path.join(ctx.projectRoot, params.target_path);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, imageData);
  
  return {
    success: true,
    path: params.target_path,
    message: `Generated image saved to ${params.target_path}`
  };
}
```

---

## Tool Execution Flow

### End-to-End Example: "Read a file"

```
1. User asks: "Check the Header component for errors"
         │
         ▼
2. Platform assembles context with:
   - <current-code> (doesn't include Header.tsx)
   - <useful-context> (debugging patterns)
   - Tool definitions (including lov-view)
         │
         ▼
3. Platform sends to Claude API:
   POST https://api.anthropic.com/v1/messages
   {
     "model": "claude-3-5-sonnet-20241022",
     "system": "<role>...</role><useful-context>...</useful-context>...",
     "messages": [
       { "role": "user", "content": "Check the Header component for errors" }
     ],
     "tools": [
       {
         "name": "lov-view",
         "description": "Read file contents...",
         "input_schema": { ... }
       },
       ...
     ]
   }
         │
         ▼
4. Claude decides to use lov-view and responds:
   {
     "content": [
       { "type": "text", "text": "I'll read the Header component to check for errors." },
       { 
         "type": "tool_use",
         "id": "toolu_123",
         "name": "lov-view",
         "input": { "file_path": "src/components/Header.tsx" }
       }
     ],
     "stop_reason": "tool_use"
   }
         │
         ▼
5. Platform receives response, extracts tool call:
   toolCall = {
     name: "lov-view",
     parameters: { file_path: "src/components/Header.tsx" }
   }
         │
         ▼
6. Platform executes tool:
   result = await TOOL_REGISTRY['lov-view'](
     { file_path: "src/components/Header.tsx" },
     executionContext
   );
   
   result = {
     content: "import React from 'react';\n\nexport const Header = () => {\n  return <h1>Hello</h1>\n}",
     message: "Read src/components/Header.tsx"
   }
         │
         ▼
7. Platform sends tool result back to Claude:
   POST https://api.anthropic.com/v1/messages
   {
     "messages": [
       { "role": "user", "content": "Check the Header component..." },
       { "role": "assistant", "content": [...previous response with tool_use...] },
       { 
         "role": "user", 
         "content": [
           {
             "type": "tool_result",
             "tool_use_id": "toolu_123",
             "content": "import React from 'react';\n\nexport const Header..."
           }
         ]
       }
     ],
     "tools": [...]
   }
         │
         ▼
8. Claude analyzes the code and responds:
   {
     "content": [
       { "type": "text", "text": "I've checked the Header component. It looks good - no errors found. The component is a simple functional component that renders a header." }
     ],
     "stop_reason": "end_turn"
   }
         │
         ▼
9. Platform delivers final message to user:
   "I've checked the Header component. It looks good - no errors found..."
```

---

## Parallel Tool Execution

AI can request multiple tools simultaneously. Platform should execute in parallel when no dependencies exist.

```typescript
// Claude returns multiple tool calls
const response = {
  content: [
    { type: "text", text: "I'll read both files to compare them." },
    { type: "tool_use", id: "tool_1", name: "lov-view", input: { file_path: "src/A.tsx" } },
    { type: "tool_use", id: "tool_2", name: "lov-view", input: { file_path: "src/B.tsx" } }
  ],
  stop_reason: "tool_use"
};

// Platform executes in parallel
const results = await Promise.all([
  executeTool("lov-view", { file_path: "src/A.tsx" }, context),
  executeTool("lov-view", { file_path: "src/B.tsx" }, context)
]);

// Send both results back to Claude
const toolResults = [
  { type: "tool_result", tool_use_id: "tool_1", content: results[0].content },
  { type: "tool_result", tool_use_id: "tool_2", content: results[1].content }
];
```

---

## Error Handling

```typescript
async function executeTool(
  name: string, 
  parameters: any, 
  context: ExecutionContext
): Promise<ToolResult> {
  try {
    // Validate tool exists
    if (!TOOL_REGISTRY.has(name)) {
      return { 
        error: `Unknown tool: ${name}`,
        success: false 
      };
    }
    
    // Validate parameters (JSON Schema validation)
    const schema = getToolSchema(name);
    const validation = validate(parameters, schema);
    if (!validation.valid) {
      return { 
        error: `Invalid parameters: ${validation.errors.join(', ')}`,
        success: false 
      };
    }
    
    // Execute with timeout
    const executor = TOOL_REGISTRY.get(name);
    const result = await withTimeout(
      executor(parameters, context),
      30000 // 30 second timeout
    );
    
    return result;
    
  } catch (error) {
    // Log error for debugging
    console.error(`Tool execution failed: ${name}`, error);
    
    // Return user-friendly error
    return {
      error: `Tool execution failed: ${error.message}`,
      success: false
    };
  }
}
```

---

## Testing Tools

```typescript
// Unit test for a tool
describe('lov-view tool', () => {
  it('should read file contents', async () => {
    const context = createTestContext({
      projectRoot: '/tmp/test-project'
    });
    
    // Create test file
    fs.writeFileSync('/tmp/test-project/test.txt', 'Hello World');
    
    // Execute tool
    const result = await executeLovView(
      { file_path: 'test.txt' },
      context
    );
    
    expect(result.success).toBe(true);
    expect(result.content).toContain('Hello World');
  });
  
  it('should reject paths outside project root', async () => {
    const context = createTestContext({
      projectRoot: '/tmp/test-project'
    });
    
    const result = await executeLovView(
      { file_path: '../../etc/passwd' },
      context
    );
    
    expect(result.error).toContain('Access denied');
  });
});

// Integration test: Full AI conversation with tools
describe('AI tool integration', () => {
  it('should handle multi-turn conversation with tool use', async () => {
    const messages = [
      { role: 'user', content: 'Read src/App.tsx' }
    ];
    
    // First turn: AI requests tool
    const response1 = await callAI(messages, tools);
    expect(response1.stop_reason).toBe('tool_use');
    expect(response1.tool_calls[0].name).toBe('lov-view');
    
    // Execute tools
    const toolResults = await executeTools(response1.tool_calls);
    
    // Second turn: AI responds with tool results
    messages.push({ role: 'assistant', content: response1.content });
    messages.push({ role: 'user', content: toolResults });
    
    const response2 = await callAI(messages, tools);
    expect(response2.stop_reason).toBe('end_turn');
    expect(response2.text).toContain('App.tsx');
  });
});
```

---

## Best Practices

### 1. Tool Design
- ✅ Clear, descriptive names (kebab-case)
- ✅ Comprehensive descriptions (AI needs to understand when to use)
- ✅ Well-defined parameters with examples
- ✅ Single responsibility (one tool = one action)
- ❌ Don't create "god tools" that do many things

### 2. Parameter Validation
- ✅ Validate all inputs before execution
- ✅ Use JSON Schema for type checking
- ✅ Provide clear error messages
- ❌ Don't trust AI to always provide correct parameters

### 3. Security
- ✅ Validate file paths (prevent traversal)
- ✅ Check permissions before operations
- ✅ Sanitize user inputs
- ✅ Rate limit expensive operations
- ❌ Never execute user-provided code directly

### 4. Performance
- ✅ Support parallel execution when possible
- ✅ Cache results when appropriate
- ✅ Set timeouts for long-running operations
- ❌ Don't block on I/O sequentially

### 5. Error Handling
- ✅ Return structured errors, not exceptions
- ✅ Log errors for debugging
- ✅ Provide actionable error messages
- ❌ Don't expose internal system details in errors

---

## Summary

**Tools = AI agent's hands**

- **Defined** as JSON schemas in API requests to AI
- **Executed** by your backend when AI requests them
- **Results** sent back to AI to continue conversation
- **Parallel** execution when no dependencies
- **Validated** for security and correctness
- **Tested** with unit and integration tests

The power of the Lovable architecture comes from having 31 well-designed tools that cover all necessary operations (files, backend, debugging, security, external APIs), combined with intelligent context selection that tells the AI WHEN to use each tool.

# Implementation: System Prompt Changes & Workflow Tool

## Overview

This document outlines how to adopt Lovable's pattern of **on-demand knowledge discovery** for our system:
1. **System Prompt Changes**: Keep prompt minimal, reference tools for knowledge discovery
2. **Workflow Tool**: Create tool to discover and retrieve workflow decision trees

## 1. System Prompt Changes

### Current State

Our system prompt is ~200 tokens and includes:
- Identity and role (design consultant + software engineer)
- Behavioral rules (proactive investigation, no emojis, read CLAUDE.md)
- Stripe integration instructions
- Context parameters (projectId, userId, workspaceFolder)

**Problem**: If we add all knowledge to the prompt, it will bloat quickly.

### Solution: Reference Tools Instead

**Add ONE line** to the system prompt that points to discovery tools:

```typescript
// In apps/web/features/chat/lib/systemPrompt.ts

let prompt = `Today's date is ${currentDate} (DD Month YYYY format). You are a design consultant AND software engineer working for the user as your client. You are a designer that loves spatial design and loves to hear about your clients and learn what they like. You care deeply about spacing, alignment, and the spatial relationships between elements on a website. Your design philosophy is inspired by Dieter Rams - clean, functional, and minimal - but you are mostly reliant on the client's needs and preferences. The workspace is the current working directory where the project files are located. You are here to help with coding and design tasks as their professional consultant. As a professional, you should proactively investigate, analyze, and gather information before asking the client questions - do substantial work first to understand the context and current state. Keep all communication focused on design and user experience - never get technical or discuss implementation details with the client. IMPORTANT: Always read the CLAUDE.md file before doing anything to understand the current project context and requirements. Remember that when a client contacts you, it almost ALWAYS has to do with a specific page they are currently viewing - ask them which page they're on if it's not clear. CRITICAL: NEVER use emojis in any response, code, comments, or communication. This is an absolute prohibition. STRIPE INTEGRATION: If you have access to Stripe MCP tools and the user's request involves payments, subscriptions, customers, invoices, or any payment-related functionality, you MUST use the available Stripe tools. Do not try to implement payment features manually - always use the Stripe MCP tools when they are available.

KNOWLEDGE DISCOVERY: For execution patterns, workflow decision trees, tool usage guidelines, and knowledge base content, use the discovery tools:
- Use \`find_guide\` or \`get_guide\` to retrieve guides and workflows by topic
- Use \`list_guides\` to browse available categories (workflows, guides, patterns)
- Use \`search_tools\` to discover available tools and their usage patterns
- Use \`get_workflow\` to retrieve specific workflow decision trees for request types`

  // ... rest of prompt
```

### Why This Works

1. **Minimal Token Cost**: One paragraph (~50 tokens) instead of thousands
2. **On-Demand Loading**: AI retrieves knowledge only when needed
3. **Progressive Disclosure**: Tools support detail levels (minimal → standard → full)
4. **Maintainable**: Knowledge lives in files, not in code

### Implementation Steps

1. **Update system prompt** (above)
2. **Ensure tools are registered** (`find_guide`, `get_guide`, `list_guides`, `search_tools`)
3. **Create workflow tool** (see Section 2)
4. **Test**: Verify AI uses tools to discover knowledge instead of relying on prompt

## 2. Workflow Tool

### Purpose

Create a tool that allows AI to discover and retrieve workflow decision trees. Workflows are step-by-step guides for handling specific request types (bug debugging, new features, API integration, etc.).

### Tool Design

**Tool Name**: `get_workflow`

**Categories**:
- `bug-debugging` - Debugging workflows
- `new-feature` - Feature implementation workflows
- `api-integration` - External API integration workflows
- `styling` - Design/styling workflows
- `database` - Database/table creation workflows
- `file-upload` - File upload workflows
- `security` - Security audit workflows
- `performance` - Performance optimization workflows

**Schema**:
```typescript
{
  workflow_type: z.string().describe("Type of workflow (bug-debugging, new-feature, api-integration, styling, database, file-upload, security, performance)"),
  detail_level: z.enum(["minimal", "standard", "full"]).optional().describe("Detail level: 'minimal' (overview), 'standard' (decision tree), 'full' (complete with examples). Default: 'standard'")
}
```

### Implementation

**File**: `packages/tools/src/tools/workflows/get-workflow.ts`

```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { readFile } from "fs/promises"
import { join } from "path"
import { readdir } from "fs/promises"

export type GetWorkflowParams = {
  workflow_type: string
  detail_level?: "minimal" | "standard" | "full"
}

export type GetWorkflowResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

// Map workflow types to file names
const WORKFLOW_MAP: Record<string, string> = {
  "bug-debugging": "02-bug-debugging-request.md",
  "new-feature": "03-new-feature-request.md",
  "api-integration": "04-external-api-integration.md",
  "styling": "05-styling-design-request.md",
  "database": "06-database-table-creation.md",
  "file-upload": "07-file-upload.md",
  "security": "08-security-audit-vulnerability.md",
  "performance": "09-performance-optimization.md",
}

export async function getWorkflow(
  params: GetWorkflowParams,
  workflowsBasePath: string,
): Promise<GetWorkflowResult> {
  try {
    const { workflow_type, detail_level = "standard" } = params

    // Find workflow file
    const fileName = WORKFLOW_MAP[workflow_type]
    if (!fileName) {
      // List available workflows
      const files = await readdir(workflowsBasePath)
      const workflowFiles = files.filter(f => f.endsWith(".md") && f !== "architecture.md")
      const availableTypes = Object.entries(WORKFLOW_MAP)
        .filter(([_, file]) => workflowFiles.includes(file))
        .map(([type]) => type)

      return {
        content: [
          {
            type: "text" as const,
            text: `# Workflow Not Found\n\n**Requested:** "${workflow_type}"\n\n**Available workflows:**\n${availableTypes.map(t => `- ${t}`).join("\n")}\n\nUse one of these workflow types.`,
          },
        ],
        isError: false,
      }
    }

    const filePath = join(workflowsBasePath, fileName)
    const content = await readFile(filePath, "utf-8")

    // Format based on detail level
    let output = `# Workflow: ${workflow_type}\n\n`

    if (detail_level === "minimal") {
      // Extract just the scenario and high-level steps
      const scenarioMatch = content.match(/## Scenario\n\n(.*?)(?=\n##|$)/s)
      const scenario = scenarioMatch ? scenarioMatch[1].trim() : "No scenario found"

      output += `**Scenario:** ${scenario}\n\n`
      output += `Use \`get_workflow({ workflow_type: "${workflow_type}", detail_level: "standard" })\` for full decision tree.`
    } else if (detail_level === "standard") {
      // Full workflow content
      output += content
    } else {
      // Full content + examples
      output += content
      output += `\n\n---\n\n**Usage Examples:**\n`
      output += `- User: "The button isn't working" → Use bug-debugging workflow\n`
      output += `- User: "Add a login page" → Use new-feature workflow\n`
      output += `- User: "Integrate Stripe payments" → Use api-integration workflow\n`
    }

    return {
      content: [
        {
          type: "text" as const,
          text: output,
        },
      ],
      isError: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to retrieve workflow\n\nError: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const getWorkflowParamsSchema = {
  workflow_type: z
    .string()
    .describe(
      "Type of workflow: bug-debugging, new-feature, api-integration, styling, database, file-upload, security, performance",
    ),
  detail_level: z
    .enum(["minimal", "standard", "full"])
    .optional()
    .describe(
      "Detail level: 'minimal' (overview), 'standard' (decision tree), 'full' (complete with examples). Default: 'standard'",
    ),
}

export const getWorkflowTool = tool(
  "get_workflow",
  "Retrieves workflow decision trees for handling specific request types. Use this to understand step-by-step processes for bug debugging, feature implementation, API integration, etc.",
  getWorkflowParamsSchema,
  async (args) => {
    // Use source location, not dist - works in both dev and production
    const packageRoot = join(__dirname, "../../..")
    const workflowsBasePath = join(packageRoot, "lovable-folder-only-use-for-inspiration", "workflows")

    return getWorkflow(args, workflowsBasePath)
  },
)
```

### Register Tool

**File**: `packages/tools/src/mcp-server.ts`

```typescript
import { getWorkflowTool } from "./tools/workflows/get-workflow.js"

export const toolsInternalMcp = createSdkMcpServer({
  name: "alive-tools",
  version: "1.0.0",
  tools: [
    searchToolsTool,
    debugWorkspaceTool,
    getAliveSuperTemplateTool,
    readServerLogsTool,
    generatePersonaTool,
    getWorkflowTool, // Add this
  ],
})
```

### Update Tool Registry

**File**: `packages/tools/src/tools/meta/tool-registry.ts`

```typescript
export const TOOL_REGISTRY: ToolMetadata[] = [
  // ... existing tools
  
  {
    name: "get_workflow",
    category: "documentation",
    description: "Retrieves workflow decision trees for handling specific request types (bug debugging, new features, API integration, etc.)",
    contextCost: "medium",
    enabled: true,
    parameters: [
      {
        name: "workflow_type",
        type: "string",
        required: true,
        description: "Type of workflow: bug-debugging, new-feature, api-integration, styling, database, file-upload, security, performance",
      },
      {
        name: "detail_level",
        type: "string",
        required: false,
        description: "Detail level: 'minimal' (overview), 'standard' (decision tree), 'full' (complete with examples). Default: 'standard'",
      },
    ],
  },
]
```

### Update Allowed Tools

**File**: `apps/web/app/api/claude/stream/route.ts`

```typescript
allowedTools: [
  "Write",
  "Edit",
  "Read",
  "Glob",
  "Grep",
  "mcp__alive-tools__search_tools",
  "mcp__alive-tools__get_workflow", // Add this
  "mcp__alive-tools__find_guide",
  "mcp__alive-tools__get_guide",
  // ... other tools
]
```

Also update `apps/web/scripts/run-agent.mjs`:

```javascript
allowedTools: [
  "Write",
  "Edit",
  "Read",
  "Glob",
  "Grep",
  "mcp__alive-tools__search_tools",
  "mcp__alive-tools__get_workflow", // Add this
  // ... other tools
]
```

### Usage Pattern

**AI discovers workflow when needed:**

```
User: "The button isn't working"

AI thinks:
1. This is a bug report
2. I should check if there's a workflow for this
3. Call: get_workflow({ workflow_type: "bug-debugging", detail_level: "standard" })
4. Follow the decision tree from the workflow
5. Execute tools in sequence: read logs → check network → take screenshot → fix
```

**Progressive disclosure:**

```
// First, get overview
get_workflow({ workflow_type: "bug-debugging", detail_level: "minimal" })
→ Returns: Scenario + brief steps

// Then, get full decision tree
get_workflow({ workflow_type: "bug-debugging", detail_level: "standard" })
→ Returns: Complete workflow with decision tree

// Finally, get examples
get_workflow({ workflow_type: "bug-debugging", detail_level: "full" })
→ Returns: Workflow + usage examples
```

## Benefits

1. **System Prompt Stays Minimal**: ~250 tokens instead of thousands
2. **Knowledge On-Demand**: AI retrieves workflows only when needed
3. **Progressive Disclosure**: Can get overview first, then details
4. **Maintainable**: Workflows live in markdown files, easy to update
5. **Discoverable**: AI can list available workflows and choose appropriate one

## Testing

1. **Test workflow discovery**:
   ```typescript
   // Should list available workflows
   get_workflow({ workflow_type: "invalid-type" })
   ```

2. **Test detail levels**:
   ```typescript
   // Minimal: overview only
   get_workflow({ workflow_type: "bug-debugging", detail_level: "minimal" })
   
   // Standard: full workflow
   get_workflow({ workflow_type: "bug-debugging", detail_level: "standard" })
   
   // Full: workflow + examples
   get_workflow({ workflow_type: "bug-debugging", detail_level: "full" })
   ```

3. **Test AI usage**: Ask AI to debug something, verify it uses `get_workflow` tool

## Next Steps

1. ✅ Create `get-workflow.ts` tool
2. ✅ Register in MCP server
3. ✅ Add to tool registry
4. ✅ Update allowed tools (parent + child)
5. ✅ Update system prompt with knowledge discovery reference
6. ✅ Test workflow retrieval
7. ✅ Test AI uses workflow tool appropriately

## Future Enhancements

1. **List Workflows Tool**: `list_workflows()` - Browse all available workflows
2. **Search Workflows**: Extend `find_guide` to search workflows too
3. **Workflow Categories**: Organize workflows by category (debugging, features, integrations)
4. **Custom Workflows**: Allow workspace-specific workflows in `workspace/.alive/workflows/`


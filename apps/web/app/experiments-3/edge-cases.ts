/**
 * Isolated edge case scenarios for testing the chat renderer.
 *
 * Each scenario is small (3–12 messages) and targets one specific behavior.
 */

import type { UIMessage } from "@/features/chat/lib/message-parser"

const SESSION = "mock-edge-cases"
let _seq = 0
function ts() {
  return new Date(Date.now() - 600000 + _seq++ * 500).toISOString()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function userMsg(id: string, text: string): UIMessage {
  return { id, type: "user", content: text, timestamp: new Date(ts()) }
}

function assistantText(id: string, text: string, parentToolUseId: string | null = null): UIMessage {
  return {
    id,
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-opus-4-6",
        id: `msg_${id}`,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      },
      parent_tool_use_id: parentToolUseId,
      uuid: `uuid-${id}`,
      session_id: SESSION,
    },
  }
}

function assistantToolUse(
  id: string,
  tools: Array<{ toolId: string; name: string; input: Record<string, unknown> }>,
  parentToolUseId: string | null = null,
  textPrefix?: string,
): UIMessage {
  const content: Array<Record<string, unknown>> = []
  if (textPrefix) content.push({ type: "text", text: textPrefix })
  for (const t of tools) {
    content.push({ type: "tool_use", id: t.toolId, name: t.name, input: t.input })
  }
  return {
    id,
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-opus-4-6",
        id: `msg_${id}`,
        type: "message",
        role: "assistant",
        content,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 30 },
      },
      parent_tool_use_id: parentToolUseId,
      uuid: `uuid-${id}`,
      session_id: SESSION,
    },
  }
}

function toolResult(
  id: string,
  results: Array<{ toolUseId: string; toolName: string; content: string; isError?: boolean }>,
  parentToolUseId: string | null = null,
): UIMessage {
  return {
    id,
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: results.map(r => ({
          type: "tool_result",
          tool_use_id: r.toolUseId,
          content: r.content,
          tool_name: r.toolName,
          tool_input: {},
          ...(r.isError ? { is_error: true } : {}),
        })),
      },
      parent_tool_use_id: parentToolUseId,
      uuid: `uuid-${id}`,
      session_id: SESSION,
    },
  }
}

// ===========================================================================
// 1. Error tool result — Read fails with permission error
// ===========================================================================
export const EDGE_ERROR_RESULT: UIMessage[] = [
  userMsg("err-1", "Read the secret config file"),
  assistantToolUse("err-2", [{ toolId: "toolu_err_read1", name: "Read", input: { file_path: "/etc/shadow" } }]),
  toolResult("err-3", [
    {
      toolUseId: "toolu_err_read1",
      toolName: "Read",
      content: "Error: Path traversal detected — /etc/shadow is outside the workspace boundary.",
      isError: true,
    },
  ]),
  assistantText(
    "err-4",
    "I can't read that file — it's outside your workspace. I can only access files within your project directory.",
  ),
]

// ===========================================================================
// 2. Below grouping threshold — exactly 2 consecutive Reads (no collapse)
// ===========================================================================
export const EDGE_BELOW_THRESHOLD: UIMessage[] = [
  userMsg("bt-1", "Check the two config files"),
  assistantToolUse("bt-2", [{ toolId: "toolu_bt_r1", name: "Read", input: { file_path: "config/app.ts" } }]),
  toolResult("bt-3", [{ toolUseId: "toolu_bt_r1", toolName: "Read", content: "export const config = { port: 3000 }" }]),
  assistantToolUse("bt-4", [{ toolId: "toolu_bt_r2", name: "Read", input: { file_path: "config/db.ts" } }]),
  toolResult("bt-5", [
    { toolUseId: "toolu_bt_r2", toolName: "Read", content: "export const db = { host: 'localhost', port: 5432 }" },
  ]),
  assistantText("bt-6", "Both configs look good. The app runs on port 3000 and connects to Postgres on 5432."),
]

// ===========================================================================
// 3. At grouping threshold — exactly 3 consecutive Reads (collapses)
// ===========================================================================
export const EDGE_AT_THRESHOLD: UIMessage[] = [
  userMsg("at-1", "Read the three auth files"),
  assistantToolUse("at-2", [{ toolId: "toolu_at_r1", name: "Read", input: { file_path: "auth/login.ts" } }]),
  toolResult("at-3", [
    { toolUseId: "toolu_at_r1", toolName: "Read", content: "export function login() { /* JWT */ }" },
  ]),
  assistantToolUse("at-4", [{ toolId: "toolu_at_r2", name: "Read", input: { file_path: "auth/session.ts" } }]),
  toolResult("at-5", [
    { toolUseId: "toolu_at_r2", toolName: "Read", content: "export function getSession() { /* cookie */ }" },
  ]),
  assistantToolUse("at-6", [{ toolId: "toolu_at_r3", name: "Glob", input: { pattern: "auth/**/*.test.ts" } }]),
  toolResult("at-7", [
    {
      toolUseId: "toolu_at_r3",
      toolName: "Glob",
      content: "auth/__tests__/login.test.ts\nauth/__tests__/session.test.ts",
    },
  ]),
  assistantText("at-8", "Found 3 auth files: login, session, and 2 test files."),
]

// ===========================================================================
// 4. Broken grouping — Read, Edit, Read (Edit breaks the consecutive run)
// ===========================================================================
export const EDGE_BROKEN_GROUP: UIMessage[] = [
  userMsg("bg-1", "Fix the typo in config then verify the other files"),
  assistantToolUse("bg-2", [{ toolId: "toolu_bg_r1", name: "Read", input: { file_path: "config/app.ts" } }]),
  toolResult("bg-3", [
    {
      toolUseId: "toolu_bg_r1",
      toolName: "Read",
      content: "export const config = { prot: 3000 } // typo: prot → port",
    },
  ]),
  assistantToolUse("bg-4", [
    {
      toolId: "toolu_bg_e1",
      name: "Edit",
      input: { file_path: "config/app.ts", old_string: "prot:", new_string: "port:" },
    },
  ]),
  toolResult("bg-5", [{ toolUseId: "toolu_bg_e1", toolName: "Edit", content: "OK" }]),
  assistantToolUse("bg-6", [{ toolId: "toolu_bg_r2", name: "Read", input: { file_path: "config/db.ts" } }]),
  toolResult("bg-7", [
    { toolUseId: "toolu_bg_r2", toolName: "Read", content: "export const db = { host: 'localhost' }" },
  ]),
  assistantToolUse("bg-8", [{ toolId: "toolu_bg_r3", name: "Read", input: { file_path: "config/redis.ts" } }]),
  toolResult("bg-9", [
    { toolUseId: "toolu_bg_r3", toolName: "Read", content: "export const redis = { url: 'redis://localhost:6379' }" },
  ]),
  assistantText("bg-10", "Fixed the typo and verified the other config files look correct."),
]

// ===========================================================================
// 5. Write + Bash — mutation tools that are NOT exploration
// ===========================================================================
export const EDGE_WRITE_BASH: UIMessage[] = [
  userMsg("wb-1", "Create a new util file and run the tests"),
  assistantToolUse("wb-2", [
    {
      toolId: "toolu_wb_w1",
      name: "Write",
      input: {
        file_path: "lib/utils/format.ts",
        content: "export function formatDate(d: Date) { return d.toISOString().split('T')[0] }",
      },
    },
  ]),
  toolResult("wb-3", [{ toolUseId: "toolu_wb_w1", toolName: "Write", content: "OK" }]),
  assistantToolUse("wb-4", [
    { toolId: "toolu_wb_b1", name: "Bash", input: { command: "bun run test lib/utils/format.test.ts" } },
  ]),
  toolResult("wb-5", [
    {
      toolUseId: "toolu_wb_b1",
      toolName: "Bash",
      content: "✓ formatDate returns YYYY-MM-DD\n✓ formatDate handles midnight UTC\n\n2 tests passed (12ms)",
    },
  ]),
  assistantText("wb-6", "Created `lib/utils/format.ts` and all tests pass."),
]

// ===========================================================================
// 6. Multi-tool result — one SDK message with 3 tool_result blocks
// ===========================================================================
export const EDGE_MULTI_RESULT: UIMessage[] = [
  userMsg("mr-1", "Read these three files at once"),
  assistantToolUse(
    "mr-2",
    [
      { toolId: "toolu_mr_r1", name: "Read", input: { file_path: "package.json" } },
      { toolId: "toolu_mr_r2", name: "Grep", input: { pattern: "TODO", path: "src/" } },
      { toolId: "toolu_mr_r3", name: "Glob", input: { pattern: "src/**/*.test.ts" } },
    ],
    null,
    "Let me check multiple things at once.",
  ),
  toolResult("mr-3", [
    { toolUseId: "toolu_mr_r1", toolName: "Read", content: '{ "name": "my-app", "version": "1.0.0" }' },
    {
      toolUseId: "toolu_mr_r2",
      toolName: "Grep",
      content: "src/api.ts:12: // TODO: add rate limiting\nsrc/auth.ts:45: // TODO: refresh token logic",
    },
    {
      toolUseId: "toolu_mr_r3",
      toolName: "Glob",
      content: "src/__tests__/api.test.ts\nsrc/__tests__/auth.test.ts\nsrc/__tests__/utils.test.ts",
    },
  ]),
  assistantText("mr-4", "Found 2 TODOs and 3 test files. The project is at v1.0.0."),
]

// ===========================================================================
// 7. Empty assistant text — should be filtered out by shouldRenderMessage
// ===========================================================================
export const EDGE_EMPTY_TEXT: UIMessage[] = [
  userMsg("et-1", "What's in the readme?"),
  // Assistant sends empty text then immediately tool_use (common SDK pattern)
  assistantToolUse("et-2", [{ toolId: "toolu_et_r1", name: "Read", input: { file_path: "README.md" } }]),
  toolResult("et-3", [
    { toolUseId: "toolu_et_r1", toolName: "Read", content: "# My Project\n\nA sample project for testing." },
  ]),
  // Another empty-text-before-tool pattern
  {
    id: "et-4",
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-opus-4-6",
        id: "msg_et-4",
        type: "message",
        role: "assistant",
        content: [
          { type: "text", text: "" },
          { type: "text", text: "   " },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 5 },
      },
      parent_tool_use_id: null,
      uuid: "uuid-et-4",
      session_id: SESSION,
    },
  },
  assistantText("et-5", "The README is a basic project description. Want me to flesh it out?"),
]

// ===========================================================================
// 8. Group + trailing Task — exploration group followed by Task "completed"
// ===========================================================================
export const EDGE_GROUP_TRAILING_TASK: UIMessage[] = [
  userMsg("gtt-1", "Explore the codebase structure"),
  assistantToolUse(
    "gtt-2",
    [
      {
        toolId: "toolu_gtt_t1",
        name: "Task",
        input: { subagent_type: "Explore", description: "Map codebase", prompt: "Read key files" },
      },
    ],
    null,
    "I'll use a subagent to explore.",
  ),
  // Subagent does 4 reads
  assistantToolUse(
    "gtt-3",
    [{ toolId: "toolu_gtt_r1", name: "Glob", input: { pattern: "src/**/*.ts" } }],
    "toolu_gtt_t1",
  ),
  toolResult(
    "gtt-4",
    [{ toolUseId: "toolu_gtt_r1", toolName: "Glob", content: "src/index.ts\nsrc/api.ts\nsrc/auth.ts\nsrc/db.ts" }],
    "toolu_gtt_t1",
  ),
  assistantToolUse(
    "gtt-5",
    [{ toolId: "toolu_gtt_r2", name: "Read", input: { file_path: "src/index.ts" } }],
    "toolu_gtt_t1",
  ),
  toolResult(
    "gtt-6",
    [{ toolUseId: "toolu_gtt_r2", toolName: "Read", content: "import { app } from './api'\napp.listen(3000)" }],
    "toolu_gtt_t1",
  ),
  assistantToolUse(
    "gtt-7",
    [{ toolId: "toolu_gtt_r3", name: "Read", input: { file_path: "src/api.ts" } }],
    "toolu_gtt_t1",
  ),
  toolResult(
    "gtt-8",
    [
      {
        toolUseId: "toolu_gtt_r3",
        toolName: "Read",
        content: "export const app = new Hono()\napp.get('/health', (c) => c.json({ ok: true }))",
      },
    ],
    "toolu_gtt_t1",
  ),
  assistantToolUse(
    "gtt-9",
    [{ toolId: "toolu_gtt_r4", name: "Read", input: { file_path: "src/auth.ts" } }],
    "toolu_gtt_t1",
  ),
  toolResult(
    "gtt-10",
    [
      {
        toolUseId: "toolu_gtt_r4",
        toolName: "Read",
        content: "export function verifyToken(token: string) { return jwt.verify(token, SECRET) }",
      },
    ],
    "toolu_gtt_t1",
  ),
  assistantText(
    "gtt-11",
    "The codebase has 4 TypeScript files: entry point, API routes, auth, and database.",
    "toolu_gtt_t1",
  ),
  // Task completed (main agent)
  toolResult("gtt-12", [
    { toolUseId: "toolu_gtt_t1", toolName: "Task", content: "Explored 4 files: index.ts, api.ts, auth.ts, db.ts" },
  ]),
  assistantText("gtt-13", "The subagent found 4 core files. The app is a Hono server with JWT auth."),
]

// ===========================================================================
// 9. Markdown in assistant text — headers, code blocks, lists
// ===========================================================================
export const EDGE_MARKDOWN: UIMessage[] = [
  userMsg("md-1", "Explain the project structure"),
  assistantText(
    "md-2",
    `## Project Structure

The codebase follows a clean architecture pattern:

### Key Directories

- \`src/\` — Application source code
- \`tests/\` — Test files (mirrors \`src/\` structure)
- \`docs/\` — Documentation

### Example Config

\`\`\`typescript
export const config = {
  port: 3000,
  db: {
    host: 'localhost',
    port: 5432,
  },
}
\`\`\`

> **Note:** All configuration is validated at startup using Zod schemas.

The entry point is \`src/index.ts\`, which:
1. Loads environment variables
2. Validates config
3. Starts the HTTP server`,
  ),
]

// ===========================================================================
// 10. Long exploration group (6 reads) then text — tests scroll behavior
// ===========================================================================
export const EDGE_LONG_GROUP: UIMessage[] = (() => {
  const msgs: UIMessage[] = [userMsg("lg-1", "Read all the API route files")]
  const files = ["users.ts", "auth.ts", "posts.ts", "comments.ts", "files.ts", "health.ts"]

  for (let i = 0; i < files.length; i++) {
    const toolId = `toolu_lg_r${i + 1}`
    msgs.push(
      assistantToolUse(`lg-${2 + i * 2}`, [{ toolId, name: "Read", input: { file_path: `src/routes/${files[i]}` } }]),
    )
    msgs.push(
      toolResult(`lg-${3 + i * 2}`, [
        {
          toolUseId: toolId,
          toolName: "Read",
          content: `export default function ${files[i].replace(".ts", "")}Router() { /* ${20 + i * 5} lines */ }`,
        },
      ]),
    )
  }
  msgs.push(
    assistantText(
      `lg-${2 + files.length * 2}`,
      `Read all ${files.length} route files. Total: ~${files.reduce((s, _, i) => s + 20 + i * 5, 0)} lines of route handlers.`,
    ),
  )
  return msgs
})()

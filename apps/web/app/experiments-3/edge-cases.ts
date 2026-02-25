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
  results: Array<{
    toolUseId: string
    toolName: string
    content: string
    isError?: boolean
    toolInput?: Record<string, unknown>
  }>,
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
          tool_input: r.toolInput ?? {},
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
// 10. Error group — 4 Reads where 2 fail (errors inside a collapsed group)
// ===========================================================================
export const EDGE_ERROR_GROUP: UIMessage[] = (() => {
  const msgs: UIMessage[] = [userMsg("eg-1", "Read the config files and check permissions")]

  const files = [
    { path: "config/app.ts", content: "export const config = { port: 3000 }", error: false },
    {
      path: "/etc/shadow",
      content: "Error: Path traversal detected — /etc/shadow is outside the workspace boundary.",
      error: true,
    },
    { path: "config/db.ts", content: "export const db = { host: 'localhost', port: 5432 }", error: false },
    {
      path: "/root/.ssh/id_rsa",
      content: "Error: Path traversal detected — /root/.ssh/id_rsa is outside the workspace boundary.",
      error: true,
    },
  ]

  for (let i = 0; i < files.length; i++) {
    const toolId = `toolu_eg_r${i + 1}`
    msgs.push(assistantToolUse(`eg-${2 + i * 2}`, [{ toolId, name: "Read", input: { file_path: files[i].path } }]))
    msgs.push(
      toolResult(`eg-${3 + i * 2}`, [
        { toolUseId: toolId, toolName: "Read", content: files[i].content, isError: files[i].error },
      ]),
    )
  }
  msgs.push(
    assistantText(
      `eg-${2 + files.length * 2}`,
      "Two config files read successfully. The other two paths were blocked — they're outside the workspace.",
    ),
  )
  return msgs
})()

// ===========================================================================
// 11. All errors — 3 consecutive Reads that all fail
// ===========================================================================
export const EDGE_ALL_ERRORS: UIMessage[] = [
  userMsg("ae-1", "Read these system files"),
  assistantToolUse("ae-2", [{ toolId: "toolu_ae_r1", name: "Read", input: { file_path: "/etc/passwd" } }]),
  toolResult("ae-3", [
    {
      toolUseId: "toolu_ae_r1",
      toolName: "Read",
      content: "Error: Path traversal detected — /etc/passwd is outside the workspace boundary.",
      isError: true,
    },
  ]),
  assistantToolUse("ae-4", [{ toolId: "toolu_ae_r2", name: "Read", input: { file_path: "/etc/shadow" } }]),
  toolResult("ae-5", [
    {
      toolUseId: "toolu_ae_r2",
      toolName: "Read",
      content: "Error: Path traversal detected — /etc/shadow is outside the workspace boundary.",
      isError: true,
    },
  ]),
  assistantToolUse("ae-6", [{ toolId: "toolu_ae_r3", name: "Read", input: { file_path: "/var/log/syslog" } }]),
  toolResult("ae-7", [
    {
      toolUseId: "toolu_ae_r3",
      toolName: "Read",
      content: "Error: Path traversal detected — /var/log/syslog is outside the workspace boundary.",
      isError: true,
    },
  ]),
  assistantText(
    "ae-8",
    "All three paths are outside the workspace. I can only access files within your project directory.",
  ),
]

// ===========================================================================
// 12. Server errors — network, auth, billing, max turns, session corrupt
// ===========================================================================

function errorResult(id: string, result: string): UIMessage {
  return {
    id,
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: { type: "result", is_error: true, result },
  }
}

function sdkResult(id: string, subtype: string): UIMessage {
  return {
    id,
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "result",
      subtype,
      is_error: true,
      result: "",
      duration_ms: 4200,
      duration_api_ms: 3800,
    },
  }
}

/** Network offline — amber styling, retry button */
export const EDGE_NETWORK_ERROR: UIMessage[] = [
  userMsg("ne-1", "What's in the project readme?"),
  assistantToolUse("ne-2", [{ toolId: "toolu_ne_r1", name: "Read", input: { file_path: "README.md" } }]),
  toolResult("ne-3", [{ toolUseId: "toolu_ne_r1", toolName: "Read", content: "# My Project\n\nA modern web app." }]),
  assistantText("ne-4", "The readme describes a modern web app. Let me check the"),
  errorResult("ne-5", "Failed to fetch"),
]

/** Auth expired — Anthropic OAuth token died mid-conversation */
export const EDGE_AUTH_ERROR: UIMessage[] = [
  userMsg("auth-1", "Refactor the auth module"),
  assistantText("auth-2", "I'll start by reading the current auth implementation."),
  errorResult(
    "auth-3",
    JSON.stringify({
      error: "API_AUTH_FAILED",
      message: "API authentication failed. The API key may be expired or invalid.",
      details: {
        message: "OAuth token has expired. Please obtain a new token or refresh your existing token.",
        apiRequestId: "req_011CUp5WQxZAVPq6593o1spz",
      },
    }),
  ),
]

/** Billing — ran out of credits */
export const EDGE_BILLING_ERROR: UIMessage[] = [
  userMsg("bill-1", "Build me a dashboard"),
  assistantText("bill-2", "I'll design a clean dashboard with"),
  errorResult(
    "bill-3",
    JSON.stringify({
      error: "INSUFFICIENT_CREDITS",
      message: "You don't have enough credits to make this request.",
      details: { balance: 0 },
    }),
  ),
]

/** Max turns — conversation too long */
export const EDGE_MAX_TURNS: UIMessage[] = [
  userMsg("mt-1", "Continue working on the refactor"),
  assistantText("mt-2", "Let me pick up where we left off."),
  sdkResult("mt-3", "error_max_turns"),
]

/** Session corrupt — tool call interrupted */
export const EDGE_SESSION_CORRUPT: UIMessage[] = [
  userMsg("sc-1", "Deploy the site"),
  assistantToolUse("sc-2", [{ toolId: "toolu_sc_b1", name: "Bash", input: { command: "bun run build" } }]),
  errorResult(
    "sc-3",
    JSON.stringify({
      error: "SESSION_CORRUPT",
      message:
        "This conversation's session got interrupted during a tool call and can't be resumed. You can continue in a new tab with your conversation history.",
    }),
  ),
]

/** Overloaded — 529 from Anthropic */
export const EDGE_OVERLOADED: UIMessage[] = [
  userMsg("ol-1", "Explain this error"),
  errorResult("ol-2", "HTTP 529: API is temporarily overloaded. Please try again in a moment."),
]

// ===========================================================================
// 14. WebFetch — user asks about external docs
// ===========================================================================
export const EDGE_WEBFETCH: UIMessage[] = [
  userMsg("wf-1", "Can you check the Hono docs for how middleware works?"),
  assistantToolUse("wf-2", [
    {
      toolId: "toolu_wf_f1",
      name: "WebFetch",
      input: { url: "https://hono.dev/docs/guides/middleware", prompt: "How does middleware work in Hono?" },
    },
  ]),
  toolResult("wf-3", [
    {
      toolUseId: "toolu_wf_f1",
      toolName: "WebFetch",
      toolInput: { url: "https://hono.dev/docs/guides/middleware", prompt: "How does middleware work in Hono?" },
      content:
        "Hono middleware runs before and after route handlers using `app.use()`. Built-in middleware includes cors(), logger(), secureHeaders(), and compress(). Custom middleware is created with `createMiddleware<AppEnv>()` where you call `await next()` to proceed to the next handler. Middleware can modify the context, short-circuit the response, or add headers. Order matters — middleware runs in the order registered.",
    },
  ]),
  assistantText(
    "wf-4",
    "Hono middleware uses `app.use()` and runs in registration order. There's built-in middleware for CORS, logging, and security headers. For custom middleware, use `createMiddleware()` and call `await next()` to continue the chain.",
  ),
]

// ===========================================================================
// 15. WebSearch — user asks about something current
// ===========================================================================
export const EDGE_WEBSEARCH: UIMessage[] = [
  userMsg("ws-1", "Is there a way to do server components with Hono?"),
  assistantToolUse("ws-2", [
    { toolId: "toolu_ws_s1", name: "WebSearch", input: { query: "hono server components react RSC 2026" } },
  ]),
  toolResult("ws-3", [
    {
      toolUseId: "toolu_ws_s1",
      toolName: "WebSearch",
      toolInput: { query: "hono server components react RSC 2026" },
      content:
        "Hono introduced experimental React Server Components support in v4.7 via `@hono/react-renderer`. It provides a lightweight RSC implementation that works with Hono's middleware system. The `createRenderer()` function wraps your routes with a React tree. Unlike Next.js, Hono's RSC is opt-in per route and doesn't require a build step for simple cases. Client components use the standard `'use client'` directive.",
    },
  ]),
  assistantText(
    "ws-4",
    "Yes — Hono added experimental RSC support in v4.7 via `@hono/react-renderer`. It's lightweight and opt-in per route, unlike Next.js which requires RSC everywhere. You use `createRenderer()` to wrap routes with a React tree.",
  ),
]

// ===========================================================================
// 16. Edit — user asks to fix something specific
// ===========================================================================
export const EDGE_EDIT: UIMessage[] = [
  userMsg("ed-1", "The pricing section still says $9/month, it should be $12"),
  assistantToolUse("ed-2", [
    {
      toolId: "toolu_ed_e1",
      name: "Edit",
      input: { file_path: "user/pages/pricing.tsx", old_string: "$9/month", new_string: "$12/month" },
    },
  ]),
  toolResult("ed-3", [
    {
      toolUseId: "toolu_ed_e1",
      toolName: "Edit",
      toolInput: { file_path: "user/pages/pricing.tsx" },
      content: JSON.stringify({ file_path: "user/pages/pricing.tsx", replacements: 1 }),
    },
  ]),
  assistantText("ed-4", "Updated the pricing from $9/month to $12/month in `pricing.tsx`."),
]

// ===========================================================================
// 17. Glob — user exploring their project structure
// ===========================================================================
export const EDGE_GLOB: UIMessage[] = [
  userMsg("gl-1", "What pages does my site have?"),
  assistantToolUse("gl-2", [{ toolId: "toolu_gl_g1", name: "Glob", input: { pattern: "user/pages/**/*.tsx" } }]),
  toolResult("gl-3", [
    {
      toolUseId: "toolu_gl_g1",
      toolName: "Glob",
      toolInput: { pattern: "user/pages/**/*.tsx" },
      content: JSON.stringify({
        matches: [
          "user/pages/index.tsx",
          "user/pages/about.tsx",
          "user/pages/pricing.tsx",
          "user/pages/contact.tsx",
          "user/pages/blog/index.tsx",
          "user/pages/blog/[slug].tsx",
        ],
        count: 6,
      }),
    },
  ]),
  assistantText(
    "gl-4",
    "Your site has 6 pages: a homepage, about, pricing, contact, and a blog with a dynamic slug route.",
  ),
]

// ===========================================================================
// 18. Grep — user looking for something in their code
// ===========================================================================
export const EDGE_GREP: UIMessage[] = [
  userMsg("gr-1", "Where do I handle form submissions?"),
  assistantToolUse("gr-2", [
    { toolId: "toolu_gr_g1", name: "Grep", input: { pattern: "onSubmit|handleSubmit", path: "user/" } },
  ]),
  toolResult("gr-3", [
    {
      toolUseId: "toolu_gr_g1",
      toolName: "Grep",
      toolInput: { pattern: "onSubmit|handleSubmit", path: "user/" },
      content: JSON.stringify({
        files: ["user/pages/contact.tsx", "user/components/NewsletterForm.tsx"],
        count: 2,
      }),
    },
  ]),
  assistantText(
    "gr-4",
    "Form submissions are handled in two places: `contact.tsx` (contact form) and `NewsletterForm.tsx` (email signup).",
  ),
]

// ===========================================================================
// 19. Bash — user wants to install a package
// ===========================================================================
export const EDGE_BASH: UIMessage[] = [
  userMsg("ba-1", "Add the Resend package so I can send emails"),
  assistantToolUse("ba-2", [{ toolId: "toolu_ba_b1", name: "Bash", input: { command: "bun add resend" } }]),
  toolResult("ba-3", [
    {
      toolUseId: "toolu_ba_b1",
      toolName: "Bash",
      toolInput: { command: "bun add resend" },
      content: JSON.stringify({
        output: "bun add v1.2.22\n\ninstalled resend@4.1.0\n\n1 package installed [312ms]",
        exitCode: 0,
      }),
    },
  ]),
  assistantText(
    "ba-4",
    "Installed `resend@4.1.0`. I can now set up an email sending function — do you have a Resend API key?",
  ),
]

// ===========================================================================
// 20. AskUserQuestion — clarifying what to build
// ===========================================================================
export const EDGE_ASK_USER: UIMessage[] = [
  userMsg("aq-1", "I need a contact form on the site"),
  assistantToolUse("aq-2", [
    {
      toolId: "toolu_aq_q1",
      name: "AskUserQuestion",
      input: {
        questions: [
          {
            question: "What should happen when someone submits the contact form?",
            header: "Form action",
            options: [
              {
                label: "Send email (Recommended)",
                description: "Forward submissions to your email address using Resend",
              },
              { label: "Save to database", description: "Store submissions in a database table for later review" },
              { label: "Slack notification", description: "Post a message to a Slack channel with the form data" },
            ],
            multiSelect: false,
          },
        ],
      },
    },
  ]),
  toolResult("aq-3", [
    {
      toolUseId: "toolu_aq_q1",
      toolName: "AskUserQuestion",
      content: JSON.stringify({
        answers: { "What should happen when someone submits the contact form?": "Send email (Recommended)" },
      }),
    },
  ]),
  assistantText(
    "aq-4",
    "I'll build the contact form with email forwarding via Resend. I'll need your email address and Resend API key to set it up.",
  ),
]

// ===========================================================================
// 21. MCP tool — browser screenshot of the site
// ===========================================================================
export const EDGE_MCP_BROWSER: UIMessage[] = [
  userMsg("mb-1", "Show me how the homepage looks right now"),
  assistantToolUse("mb-2", [
    {
      toolId: "toolu_mb_b1",
      name: "mcp__alive-workspace__browser",
      input: { action: "screenshot", url: "http://localhost:3352" },
    },
  ]),
  toolResult("mb-3", [
    {
      toolUseId: "toolu_mb_b1",
      toolName: "mcp__alive-workspace__browser",
      content: JSON.stringify({
        success: true,
        message: "Screenshot captured (1280x720)",
        path: "/tmp/screenshot-001.png",
      }),
    },
  ]),
  assistantText(
    "mb-4",
    "Here's the homepage. The hero section and navigation are rendering correctly. The pricing cards have some spacing issues on mobile — want me to fix that?",
  ),
]

// ===========================================================================
// 22. Task subagent — exploring codebase structure
// ===========================================================================
export const EDGE_TASK: UIMessage[] = [
  userMsg("tk-1", "Can you check how the routing works in this project?"),
  assistantToolUse(
    "tk-2",
    [
      {
        toolId: "toolu_tk_t1",
        name: "Task",
        input: {
          subagent_type: "Explore",
          description: "Explore routing",
          prompt: "Read the routing setup and summarize how pages are served",
        },
      },
    ],
    null,
    "Let me explore your routing setup.",
  ),
  assistantToolUse(
    "tk-3",
    [{ toolId: "toolu_tk_r1", name: "Read", input: { file_path: "user/index.ts" } }],
    "toolu_tk_t1",
  ),
  toolResult(
    "tk-4",
    [
      {
        toolUseId: "toolu_tk_r1",
        toolName: "Read",
        toolInput: { file_path: "user/index.ts" },
        content:
          "     1→import { Hono } from 'hono'\n     2→import { serveStatic } from 'hono/bun'\n     3→import { renderer } from './renderer'\n     4→\n     5→const app = new Hono()\n     6→app.use(renderer())\n     7→app.use('/public/*', serveStatic({ root: './' }))\n     8→\n     9→app.get('/', c => c.render(<Home />))\n    10→app.get('/about', c => c.render(<About />))\n    11→app.get('/pricing', c => c.render(<Pricing />))\n    12→\n    13→export default app",
      },
    ],
    "toolu_tk_t1",
  ),
  assistantText(
    "tk-5",
    "It's a Hono app with server-side rendering and three routes: home, about, and pricing.",
    "toolu_tk_t1",
  ),
  toolResult("tk-6", [
    {
      toolUseId: "toolu_tk_t1",
      toolName: "Task",
      content: JSON.stringify({
        result:
          "Hono server at user/index.ts with 3 routes (/, /about, /pricing). Uses SSR via a custom renderer and serves static files from /public.",
      }),
    },
  ]),
  assistantText(
    "tk-7",
    "Your site uses Hono with server-side rendering. There are 3 routes defined in `user/index.ts`: homepage, about, and pricing. Static files are served from the `public/` directory.",
  ),
]

// ===========================================================================
// 13. Long exploration group (6 reads) then text — tests scroll behavior
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

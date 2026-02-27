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
  userMsg("err-1", "can you check whats in the .env file on the server? i think the API key is wrong"),
  assistantToolUse("err-2", [{ toolId: "toolu_err_read1", name: "Read", input: { file_path: "/etc/environment" } }]),
  toolResult("err-3", [
    {
      toolUseId: "toolu_err_read1",
      toolName: "Read",
      content: "Error: Path traversal detected — /etc/environment is outside the workspace boundary.",
      isError: true,
    },
  ]),
  assistantText(
    "err-4",
    "I can only access files within your project directory. I can check `user-env.json` in your workspace instead — that's where your site's environment variables are stored.",
  ),
]

// ===========================================================================
// 2. Below grouping threshold — exactly 2 consecutive Reads (no collapse)
// ===========================================================================
export const EDGE_BELOW_THRESHOLD: UIMessage[] = [
  userMsg("bt-1", "the contact form sends to the wrong email, can you check?"),
  assistantToolUse("bt-2", [{ toolId: "toolu_bt_r1", name: "Read", input: { file_path: "user/index.ts" } }]),
  toolResult("bt-3", [
    {
      toolUseId: "toolu_bt_r1",
      toolName: "Read",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: mock code content
      content:
        "     1\timport { Hono } from 'hono'\n     2\timport { sendEmail } from './lib/email'\n     3\t\n     4\tconst app = new Hono()\n     5\t\n     6\tapp.post('/contact', async (c) => {\n     7\t  const { name, email, message } = await c.req.json()\n     8\t  await sendEmail({ to: 'old@example.com', subject: `Contact: ${name}`, body: message })\n     9\t  return c.json({ ok: true })\n    10\t})",
    },
  ]),
  assistantToolUse("bt-4", [{ toolId: "toolu_bt_r2", name: "Read", input: { file_path: "user/lib/email.ts" } }]),
  toolResult("bt-5", [
    {
      toolUseId: "toolu_bt_r2",
      toolName: "Read",
      content:
        "     1\timport { Resend } from 'resend'\n     2\t\n     3\tconst resend = new Resend(process.env.RESEND_API_KEY)\n     4\t\n     5\texport async function sendEmail({ to, subject, body }: { to: string; subject: string; body: string }) {\n     6\t  return resend.emails.send({ from: 'noreply@example.com', to, subject, html: body })\n     7\t}",
    },
  ]),
  assistantText(
    "bt-6",
    "Found it — the contact form sends to `old@example.com` (line 8 in `index.ts`). What email should it go to instead?",
  ),
]

// ===========================================================================
// 3. At grouping threshold — exactly 3 consecutive Reads (collapses)
// ===========================================================================
export const EDGE_AT_THRESHOLD: UIMessage[] = [
  userMsg("at-1", "the hero section looks broken on mobile, text is overflowing"),
  assistantToolUse("at-2", [{ toolId: "toolu_at_r1", name: "Read", input: { file_path: "user/pages/index.tsx" } }]),
  toolResult("at-3", [
    {
      toolUseId: "toolu_at_r1",
      toolName: "Read",
      content:
        '     1\texport function Hero() {\n     2\t  return (\n     3\t    <section className="h-screen flex items-center px-20">\n     4\t      <h1 className="text-7xl font-bold max-w-4xl">\n     5\t        We build digital experiences that matter\n     6\t      </h1>\n     7\t    </section>\n     8\t  )\n     9\t}',
    },
  ]),
  assistantToolUse("at-4", [{ toolId: "toolu_at_r2", name: "Read", input: { file_path: "user/styles.css" } }]),
  toolResult("at-5", [
    {
      toolUseId: "toolu_at_r2",
      toolName: "Read",
      content:
        "     1\t@tailwind base;\n     2\t@tailwind components;\n     3\t@tailwind utilities;\n     4\t\n     5\tbody { font-family: 'Inter', sans-serif; }",
    },
  ]),
  assistantToolUse("at-6", [{ toolId: "toolu_at_r3", name: "Glob", input: { pattern: "user/**/*.{tsx,css}" } }]),
  toolResult("at-7", [
    {
      toolUseId: "toolu_at_r3",
      toolName: "Glob",
      content: "user/pages/index.tsx\nuser/pages/about.tsx\nuser/pages/contact.tsx\nuser/styles.css",
    },
  ]),
  assistantText(
    "at-8",
    "The issue is the hero section uses `px-20` (80px padding) and `text-7xl` with no responsive breakpoints. On mobile screens, the padding eats up most of the width and the text has no room. I'll add responsive classes.",
  ),
]

// ===========================================================================
// 4. Broken grouping — Read, Edit, Read (Edit breaks the consecutive run)
// ===========================================================================
export const EDGE_BROKEN_GROUP: UIMessage[] = [
  userMsg("bg-1", "change the footer copyright to 2026 and make sure the other pages still look ok"),
  assistantToolUse("bg-2", [
    { toolId: "toolu_bg_r1", name: "Read", input: { file_path: "user/components/Footer.tsx" } },
  ]),
  toolResult("bg-3", [
    {
      toolUseId: "toolu_bg_r1",
      toolName: "Read",
      content:
        '     1\texport function Footer() {\n     2\t  return (\n     3\t    <footer className="border-t py-8 text-center text-sm text-gray-500">\n     4\t      <p>&copy; 2024 Bright Studio. All rights reserved.</p>\n     5\t    </footer>\n     6\t  )\n     7\t}',
    },
  ]),
  assistantToolUse("bg-4", [
    {
      toolId: "toolu_bg_e1",
      name: "Edit",
      input: {
        file_path: "user/components/Footer.tsx",
        old_string: "&copy; 2024 Bright Studio",
        new_string: "&copy; 2026 Bright Studio",
      },
    },
  ]),
  toolResult("bg-5", [
    {
      toolUseId: "toolu_bg_e1",
      toolName: "Edit",
      toolInput: { file_path: "user/components/Footer.tsx" },
      content: JSON.stringify({ file_path: "user/components/Footer.tsx", replacements: 1 }),
    },
  ]),
  assistantToolUse("bg-6", [{ toolId: "toolu_bg_r2", name: "Read", input: { file_path: "user/pages/about.tsx" } }]),
  toolResult("bg-7", [
    {
      toolUseId: "toolu_bg_r2",
      toolName: "Read",
      content:
        "     1\timport { Footer } from '../components/Footer'\n     2\t\n     3\texport function About() {\n     4\t  return (\n     5\t    <main>\n     6\t      <h1>About Us</h1>\n     7\t      <p>We are a creative studio based in Amsterdam.</p>\n     8\t      <Footer />\n     9\t    </main>\n    10\t  )\n    11\t}",
    },
  ]),
  assistantToolUse("bg-8", [{ toolId: "toolu_bg_r3", name: "Read", input: { file_path: "user/pages/contact.tsx" } }]),
  toolResult("bg-9", [
    {
      toolUseId: "toolu_bg_r3",
      toolName: "Read",
      content:
        "     1\timport { Footer } from '../components/Footer'\n     2\t\n     3\texport function Contact() {\n     4\t  return (\n     5\t    <main>\n     6\t      <h1>Contact</h1>\n     7\t      <form>...</form>\n     8\t      <Footer />\n     9\t    </main>\n    10\t  )\n    11\t}",
    },
  ]),
  assistantText(
    "bg-10",
    "Updated the copyright year to 2026. Both the About and Contact pages import the same Footer component, so they'll pick up the change automatically.",
  ),
]

// ===========================================================================
// 5. Write + Bash — mutation tools that are NOT exploration
// ===========================================================================
export const EDGE_WRITE_BASH: UIMessage[] = [
  userMsg("wb-1", "add a sitemap.xml so google can find my pages"),
  assistantToolUse("wb-2", [
    {
      toolId: "toolu_wb_w1",
      name: "Write",
      input: {
        file_path: "user/public/sitemap.xml",
        content:
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://brightstudio.com/</loc></url>\n  <url><loc>https://brightstudio.com/about</loc></url>\n  <url><loc>https://brightstudio.com/pricing</loc></url>\n  <url><loc>https://brightstudio.com/contact</loc></url>\n</urlset>',
      },
    },
  ]),
  toolResult("wb-3", [
    {
      toolUseId: "toolu_wb_w1",
      toolName: "Write",
      toolInput: { file_path: "user/public/sitemap.xml" },
      content: JSON.stringify({ bytes_written: 342, file_path: "user/public/sitemap.xml" }),
    },
  ]),
  assistantToolUse("wb-4", [
    { toolId: "toolu_wb_b1", name: "Bash", input: { command: "curl -s http://localhost:3352/sitemap.xml | head -5" } },
  ]),
  toolResult("wb-5", [
    {
      toolUseId: "toolu_wb_b1",
      toolName: "Bash",
      toolInput: { command: "curl -s http://localhost:3352/sitemap.xml | head -5" },
      content: JSON.stringify({
        output:
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://brightstudio.com/</loc></url>\n  <url><loc>https://brightstudio.com/about</loc></url>\n  <url><loc>https://brightstudio.com/pricing</loc></url>',
        exitCode: 0,
      }),
    },
  ]),
  assistantText("wb-6", "Created `sitemap.xml` with all 4 pages and verified it's accessible at `/sitemap.xml`."),
]

// ===========================================================================
// 6. Multi-tool result — one SDK message with 3 tool_result blocks
// ===========================================================================
export const EDGE_MULTI_RESULT: UIMessage[] = [
  userMsg("mr-1", "i want to add a blog to my site, what do i have so far?"),
  assistantToolUse(
    "mr-2",
    [
      { toolId: "toolu_mr_r1", name: "Read", input: { file_path: "user/package.json" } },
      { toolId: "toolu_mr_r2", name: "Grep", input: { pattern: "blog|article|post", path: "user/" } },
      { toolId: "toolu_mr_r3", name: "Glob", input: { pattern: "user/**/*.{tsx,ts,md}" } },
    ],
    null,
    "Let me check your current setup and see if there's any blog-related code already.",
  ),
  toolResult("mr-3", [
    {
      toolUseId: "toolu_mr_r1",
      toolName: "Read",
      content:
        '     1\t{\n     2\t  "name": "brightstudio",\n     3\t  "dependencies": {\n     4\t    "hono": "^4.7.2",\n     5\t    "vite": "^6.0.0"\n     6\t  }\n     7\t}',
    },
    {
      toolUseId: "toolu_mr_r2",
      toolName: "Grep",
      toolInput: { pattern: "blog|article|post", path: "user/" },
      content: JSON.stringify({ files: [], count: 0 }),
    },
    {
      toolUseId: "toolu_mr_r3",
      toolName: "Glob",
      toolInput: { pattern: "user/**/*.{tsx,ts,md}" },
      content:
        "user/index.ts\nuser/pages/index.tsx\nuser/pages/about.tsx\nuser/pages/pricing.tsx\nuser/pages/contact.tsx\nuser/components/Header.tsx\nuser/components/Footer.tsx",
    },
  ]),
  assistantText(
    "mr-4",
    "There's no blog code yet. You have a clean Hono + Vite setup with 4 pages and shared Header/Footer components. I can add a blog with markdown files — want me to set that up?",
  ),
]

// ===========================================================================
// 7. Empty assistant text — should be filtered out by shouldRenderMessage
// ===========================================================================
export const EDGE_EMPTY_TEXT: UIMessage[] = [
  userMsg("et-1", "whats in the package.json?"),
  // Assistant sends empty text then immediately tool_use (common SDK pattern)
  assistantToolUse("et-2", [{ toolId: "toolu_et_r1", name: "Read", input: { file_path: "user/package.json" } }]),
  toolResult("et-3", [
    {
      toolUseId: "toolu_et_r1",
      toolName: "Read",
      content:
        '     1\t{\n     2\t  "name": "brightstudio",\n     3\t  "version": "1.0.0",\n     4\t  "dependencies": {\n     5\t    "hono": "^4.7.2",\n     6\t    "vite": "^6.0.0"\n     7\t  }\n     8\t}',
    },
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
  assistantText("et-5", "You have Hono and Vite as dependencies. Pretty minimal setup — want me to add anything?"),
]

// ===========================================================================
// 8. Group + trailing Task — exploration group followed by Task "completed"
// ===========================================================================
export const EDGE_GROUP_TRAILING_TASK: UIMessage[] = [
  userMsg("gtt-1", "i inherited this site from someone else, can you figure out how it works?"),
  assistantToolUse(
    "gtt-2",
    [
      {
        toolId: "toolu_gtt_t1",
        name: "Task",
        input: {
          subagent_type: "Explore",
          description: "Map site structure",
          prompt: "Explore the project structure and summarize how the site is built",
        },
      },
    ],
    null,
    "Let me explore your project to understand the setup.",
  ),
  // Subagent does 4 reads
  assistantToolUse(
    "gtt-3",
    [{ toolId: "toolu_gtt_r1", name: "Glob", input: { pattern: "user/**/*.{ts,tsx,css}" } }],
    "toolu_gtt_t1",
  ),
  toolResult(
    "gtt-4",
    [
      {
        toolUseId: "toolu_gtt_r1",
        toolName: "Glob",
        content:
          "user/index.ts\nuser/renderer.tsx\nuser/pages/index.tsx\nuser/pages/about.tsx\nuser/pages/services.tsx\nuser/components/Nav.tsx\nuser/styles.css",
      },
    ],
    "toolu_gtt_t1",
  ),
  assistantToolUse(
    "gtt-5",
    [{ toolId: "toolu_gtt_r2", name: "Read", input: { file_path: "user/index.ts" } }],
    "toolu_gtt_t1",
  ),
  toolResult(
    "gtt-6",
    [
      {
        toolUseId: "toolu_gtt_r2",
        toolName: "Read",
        content:
          "     1\timport { Hono } from 'hono'\n     2\timport { serveStatic } from 'hono/bun'\n     3\timport { renderer } from './renderer'\n     4\t\n     5\tconst app = new Hono()\n     6\tapp.use(renderer())\n     7\tapp.use('/public/*', serveStatic({ root: './' }))\n     8\t\n     9\tapp.get('/', c => c.render(<Home />))\n    10\tapp.get('/about', c => c.render(<About />))\n    11\tapp.get('/services', c => c.render(<Services />))\n    12\t\n    13\texport default app",
      },
    ],
    "toolu_gtt_t1",
  ),
  assistantToolUse(
    "gtt-7",
    [{ toolId: "toolu_gtt_r3", name: "Read", input: { file_path: "user/renderer.tsx" } }],
    "toolu_gtt_t1",
  ),
  toolResult(
    "gtt-8",
    [
      {
        toolUseId: "toolu_gtt_r3",
        toolName: "Read",
        content:
          '     1\timport { jsxRenderer } from \'hono/jsx-renderer\'\n     2\t\n     3\texport const renderer = () => jsxRenderer(({ children }) => (\n     4\t  <html><head><link rel="stylesheet" href="/public/styles.css" /></head>\n     5\t  <body>{children}</body></html>\n     6\t))',
      },
    ],
    "toolu_gtt_t1",
  ),
  assistantToolUse(
    "gtt-9",
    [{ toolId: "toolu_gtt_r4", name: "Read", input: { file_path: "user/package.json" } }],
    "toolu_gtt_t1",
  ),
  toolResult(
    "gtt-10",
    [
      {
        toolUseId: "toolu_gtt_r4",
        toolName: "Read",
        content:
          '     1\t{\n     2\t  "name": "studio-site",\n     3\t  "dependencies": {\n     4\t    "hono": "^4.7.2",\n     5\t    "@hono/vite-dev-server": "^0.18.0",\n     6\t    "vite": "^6.0.0"\n     7\t  }\n     8\t}',
      },
    ],
    "toolu_gtt_t1",
  ),
  assistantText(
    "gtt-11",
    "It's a Hono + Vite site with server-side rendering. 3 pages (home, about, services), shared Nav component, and a JSX renderer for the HTML shell.",
    "toolu_gtt_t1",
  ),
  // Task completed (main agent)
  toolResult("gtt-12", [
    {
      toolUseId: "toolu_gtt_t1",
      toolName: "Task",
      content: JSON.stringify({
        result:
          "Hono + Vite SSR site with 3 pages (home, about, services). Uses jsxRenderer for the HTML shell, serves static files from /public. Standard Alive template structure.",
      }),
    },
  ]),
  assistantText(
    "gtt-13",
    "Your site is built with Hono (web framework) and Vite (build tool). It has 3 pages — home, about, and services — with server-side rendering. Pretty standard setup. What would you like to change?",
  ),
]

// ===========================================================================
// 9. Markdown in assistant text — headers, code blocks, lists
// ===========================================================================
export const EDGE_MARKDOWN: UIMessage[] = [
  userMsg("md-1", "how do i add a new page to my site?"),
  assistantText(
    "md-2",
    `## Adding a New Page

Your site uses Hono with file-based pages in \`user/pages/\`. Here's how to add one:

### 1. Create the page component

\`\`\`tsx
// user/pages/blog.tsx
export function Blog() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <p>Coming soon...</p>
    </main>
  )
}
\`\`\`

### 2. Register the route

Add this line in \`user/index.ts\`:

\`\`\`typescript
app.get('/blog', c => c.render(<Blog />))
\`\`\`

### 3. Add navigation link

In \`user/components/Nav.tsx\`, add:

\`\`\`tsx
<a href="/blog">Blog</a>
\`\`\`

> The dev server will hot-reload — no restart needed.

That's it. Want me to create the page for you?`,
  ),
]

// ===========================================================================
// 10. Error group — 4 Reads where 2 fail (errors inside a collapsed group)
// ===========================================================================
export const EDGE_ERROR_GROUP: UIMessage[] = (() => {
  const msgs: UIMessage[] = [userMsg("eg-1", "check if the vite config and the env files are set up correctly")]

  const files = [
    {
      path: "user/vite.config.ts",
      content:
        "     1\timport { defineConfig } from 'vite'\n     2\t\n     3\texport default defineConfig({\n     4\t  server: { port: 3352 }\n     5\t})",
      error: false,
    },
    {
      path: "/etc/environment",
      content: "Error: Path traversal detected — /etc/environment is outside the workspace boundary.",
      error: true,
    },
    {
      path: "user-env.json",
      content:
        '     1\t{\n     2\t  "RESEND_API_KEY": "re_***",\n     3\t  "SITE_URL": "https://brightstudio.com"\n     4\t}',
      error: false,
    },
    {
      path: "/var/lib/alive/server-config.json",
      content: "Error: Path traversal detected — /var/lib/alive/server-config.json is outside the workspace boundary.",
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
      "Your Vite config and environment variables look correct. The other two paths are outside your workspace — I can only access files in your project directory.",
    ),
  )
  return msgs
})()

// ===========================================================================
// 11. All errors — 3 consecutive Reads that all fail
// ===========================================================================
export const EDGE_ALL_ERRORS: UIMessage[] = [
  userMsg("ae-1", "can you check the nginx config and the caddy logs to debug why my site is 502ing?"),
  assistantToolUse("ae-2", [{ toolId: "toolu_ae_r1", name: "Read", input: { file_path: "/etc/nginx/nginx.conf" } }]),
  toolResult("ae-3", [
    {
      toolUseId: "toolu_ae_r1",
      toolName: "Read",
      content: "Error: Path traversal detected — /etc/nginx/nginx.conf is outside the workspace boundary.",
      isError: true,
    },
  ]),
  assistantToolUse("ae-4", [
    { toolId: "toolu_ae_r2", name: "Read", input: { file_path: "/var/log/caddy/access.log" } },
  ]),
  toolResult("ae-5", [
    {
      toolUseId: "toolu_ae_r2",
      toolName: "Read",
      content: "Error: Path traversal detected — /var/log/caddy/access.log is outside the workspace boundary.",
      isError: true,
    },
  ]),
  assistantToolUse("ae-6", [{ toolId: "toolu_ae_r3", name: "Read", input: { file_path: "/etc/caddy/Caddyfile" } }]),
  toolResult("ae-7", [
    {
      toolUseId: "toolu_ae_r3",
      toolName: "Read",
      content: "Error: Path traversal detected — /etc/caddy/Caddyfile is outside the workspace boundary.",
      isError: true,
    },
  ]),
  assistantText(
    "ae-8",
    "I can't access server configuration files — I'm limited to your project directory. A 502 usually means your server process crashed. Let me check your `index.ts` for errors instead.",
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
  userMsg("ne-1", "make the navigation sticky so it stays at the top when scrolling"),
  assistantToolUse("ne-2", [{ toolId: "toolu_ne_r1", name: "Read", input: { file_path: "user/components/Nav.tsx" } }]),
  toolResult("ne-3", [
    {
      toolUseId: "toolu_ne_r1",
      toolName: "Read",
      content:
        '     1\texport function Nav() {\n     2\t  return (\n     3\t    <nav className="py-4 px-6 flex justify-between">\n     4\t      <a href="/" className="font-bold">Studio</a>\n     5\t      <div className="flex gap-6">\n     6\t        <a href="/about">About</a>\n     7\t        <a href="/contact">Contact</a>\n     8\t      </div>\n     9\t    </nav>\n    10\t  )\n    11\t}',
    },
  ]),
  assistantText("ne-4", "I see the Nav component. I'll add `sticky top-0` and a backdrop blur. Let me also check the"),
  errorResult("ne-5", "Failed to fetch"),
]

/** Auth expired — Anthropic OAuth token died mid-conversation */
export const EDGE_AUTH_ERROR: UIMessage[] = [
  userMsg("auth-1", "add dark mode support to my site"),
  assistantText("auth-2", "I'll start by looking at your current styling setup to plan the dark mode implementation."),
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
  userMsg("bill-1", "redesign the pricing page with a comparison table"),
  assistantText("bill-2", "I'll create a comparison table with your three plans. Let me first check"),
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
  userMsg("mt-1", "ok keep going, also add the testimonials section we discussed"),
  assistantText("mt-2", "Let me continue with the testimonials section. I'll add it below the pricing cards."),
  sdkResult("mt-3", "error_max_turns"),
]

/** Session corrupt — tool call interrupted */
export const EDGE_SESSION_CORRUPT: UIMessage[] = [
  userMsg("sc-1", "install tailwind and set it up"),
  assistantToolUse("sc-2", [
    { toolId: "toolu_sc_b1", name: "Bash", input: { command: "cd user && bun add tailwindcss @tailwindcss/vite" } },
  ]),
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
  userMsg("ol-1", "why is my contact form not sending emails?"),
  errorResult("ol-2", "HTTP 529: API is temporarily overloaded. Please try again in a moment."),
]

// ===========================================================================
// 14. Read — user asks to see a file
// SDK Read returns: cat -n style string "     1\tcontent\n     2\t..." (plain string)
// ===========================================================================
export const EDGE_READ: UIMessage[] = [
  userMsg("rd-1", "show me the homepage code, something is wrong with the layout"),
  assistantToolUse("rd-2", [{ toolId: "toolu_rd_r1", name: "Read", input: { file_path: "user/pages/index.tsx" } }]),
  toolResult("rd-3", [
    {
      toolUseId: "toolu_rd_r1",
      toolName: "Read",
      toolInput: { file_path: "user/pages/index.tsx" },
      content:
        '     1\timport { Nav } from \'../components/Nav\'\n     2\timport { Footer } from \'../components/Footer\'\n     3\t\n     4\texport function Home() {\n     5\t  return (\n     6\t    <>\n     7\t      <Nav />\n     8\t      <section className="h-screen flex items-center justify-center px-6">\n     9\t        <div className="max-w-2xl text-center">\n    10\t          <h1 className="text-5xl font-bold mb-6">\n    11\t            Build something people want\n    12\t          </h1>\n    13\t          <p className="text-lg text-gray-600 mb-8">\n    14\t            We help startups ship faster with design and engineering.\n    15\t          </p>\n    16\t          <a href="/contact" className="bg-black text-white px-6 py-3 rounded-lg">\n    17\t            Get in touch\n    18\t          </a>\n    19\t        </div>\n    20\t      </section>\n    21\t      <Footer />\n    22\t    </>\n    23\t  )\n    24\t}',
    },
  ]),
  assistantText(
    "rd-4",
    "I see the issue — the hero section uses `h-screen` which takes the full viewport height, but the Nav is rendered above it. This pushes the Footer off-screen. You probably want `min-h-[calc(100vh-64px)]` instead, accounting for the nav height.",
  ),
]

// ===========================================================================
// 15. WebFetch — user asks about external docs
// SDK WebFetch returns: plain text summary string
// ===========================================================================
export const EDGE_WEBFETCH: UIMessage[] = [
  userMsg("wf-1", "i want to add analytics to my site, can you check how Plausible works?"),
  assistantToolUse("wf-2", [
    {
      toolId: "toolu_wf_f1",
      name: "WebFetch",
      input: {
        url: "https://plausible.io/docs",
        prompt: "How to add Plausible analytics to a website? What's the script tag?",
      },
    },
  ]),
  toolResult("wf-3", [
    {
      toolUseId: "toolu_wf_f1",
      toolName: "WebFetch",
      toolInput: {
        url: "https://plausible.io/docs",
        prompt: "How to add Plausible analytics to a website? What's the script tag?",
      },
      content:
        'To add Plausible analytics, add this script tag to your HTML <head>: `<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>`. It\'s lightweight (< 1KB), doesn\'t use cookies, and is GDPR compliant by default — no cookie banner needed. For SPAs, use the script.hash.js variant. Dashboard is at plausible.io/yourdomain.com after signup.',
    },
  ]),
  assistantText(
    "wf-4",
    "Plausible is a great choice — it's lightweight (< 1KB) and GDPR compliant, so no cookie banner needed. I just need to add one `<script>` tag to your HTML head in `renderer.tsx`. Want me to set it up?",
  ),
]

// ===========================================================================
// 15. WebSearch — user asks about something current
// ===========================================================================
export const EDGE_WEBSEARCH: UIMessage[] = [
  userMsg("ws-1", "is there a free way to send emails from my contact form? resend seems expensive"),
  assistantToolUse("ws-2", [
    {
      toolId: "toolu_ws_s1",
      name: "WebSearch",
      input: { query: "free transactional email API 2026 resend alternative" },
    },
  ]),
  toolResult("ws-3", [
    {
      toolUseId: "toolu_ws_s1",
      toolName: "WebSearch",
      toolInput: { query: "free transactional email API 2026 resend alternative" },
      content:
        "Several free transactional email options exist: Resend offers 3,000 emails/month free (their free tier). Brevo (formerly Sendinblue) gives 300 emails/day free. Mailgun has 1,000 free emails/month for 3 months. Postmark offers 100 free emails/month. For a contact form that probably gets < 100 emails/month, Resend's free tier is actually more than enough. Alternatively, you can use the Web3Forms API which is completely free and requires no backend — just a simple HTML form with an access key.",
    },
  ]),
  assistantText(
    "ws-4",
    "Actually, Resend's free tier gives you 3,000 emails/month — for a contact form that's more than enough. But if you want zero setup, Web3Forms is completely free and works with just an HTML form (no backend code). Which approach do you prefer?",
  ),
]

// ===========================================================================
// 16. Edit — user asks to fix something specific
// ===========================================================================
export const EDGE_EDIT: UIMessage[] = [
  userMsg("ed-1", "the phone number on the contact page is wrong, it should be +31 20 123 4567"),
  assistantToolUse("ed-2", [
    {
      toolId: "toolu_ed_e1",
      name: "Edit",
      input: {
        file_path: "user/pages/contact.tsx",
        old_string: "+31 6 12345678",
        new_string: "+31 20 123 4567",
      },
    },
  ]),
  toolResult("ed-3", [
    {
      toolUseId: "toolu_ed_e1",
      toolName: "Edit",
      toolInput: { file_path: "user/pages/contact.tsx" },
      content: JSON.stringify({ file_path: "user/pages/contact.tsx", replacements: 1 }),
    },
  ]),
  assistantText("ed-4", "Updated the phone number to +31 20 123 4567 on the contact page."),
]

// ===========================================================================
// 17. Glob — user exploring their project structure
// ===========================================================================
export const EDGE_GLOB: UIMessage[] = [
  userMsg("gl-1", "what images do i have? i think some are unused"),
  assistantToolUse("gl-2", [
    { toolId: "toolu_gl_g1", name: "Glob", input: { pattern: "user/public/**/*.{png,jpg,svg,webp}" } },
  ]),
  toolResult("gl-3", [
    {
      toolUseId: "toolu_gl_g1",
      toolName: "Glob",
      toolInput: { pattern: "user/public/**/*.{png,jpg,svg,webp}" },
      content: JSON.stringify({
        matches: [
          "user/public/images/hero-bg.webp",
          "user/public/images/team-photo.jpg",
          "user/public/images/logo.svg",
          "user/public/images/logo-white.svg",
          "user/public/images/old-banner.png",
          "user/public/images/screenshot-v1.png",
        ],
        count: 6,
        search_path: "user/public",
      }),
    },
  ]),
  assistantText(
    "gl-4",
    "You have 6 images. `old-banner.png` and `screenshot-v1.png` look like they might be outdated. Want me to check which ones are actually referenced in your code?",
  ),
]

// ===========================================================================
// 18. Grep — user looking for something in their code
// ===========================================================================
export const EDGE_GREP: UIMessage[] = [
  userMsg("gr-1", "where is the color #FF6B35 used? i want to change it everywhere"),
  assistantToolUse("gr-2", [
    { toolId: "toolu_gr_g1", name: "Grep", input: { pattern: "#FF6B35|ff6b35", path: "user/" } },
  ]),
  toolResult("gr-3", [
    {
      toolUseId: "toolu_gr_g1",
      toolName: "Grep",
      toolInput: { pattern: "#FF6B35|ff6b35", path: "user/" },
      content: JSON.stringify({
        files: ["user/styles.css", "user/pages/index.tsx", "user/components/Button.tsx"],
        count: 3,
      }),
    },
  ]),
  assistantText(
    "gr-4",
    "That orange (#FF6B35) is used in 3 files: `styles.css`, the homepage, and the Button component. What color do you want to change it to?",
  ),
]

// ===========================================================================
// 19. Bash — user wants to install a package
// ===========================================================================
export const EDGE_BASH: UIMessage[] = [
  userMsg("ba-1", "can you install an image optimization library? the hero image loads super slow"),
  assistantToolUse("ba-2", [{ toolId: "toolu_ba_b1", name: "Bash", input: { command: "cd user && bun add sharp" } }]),
  toolResult("ba-3", [
    {
      toolUseId: "toolu_ba_b1",
      toolName: "Bash",
      toolInput: { command: "cd user && bun add sharp" },
      content: JSON.stringify({
        output:
          "bun add v1.2.22\n\ninstalled sharp@0.33.5 with binaries:\n - sharp-linux-x64\n\n1 package installed [1.84s]",
        exitCode: 0,
      }),
    },
  ]),
  assistantText(
    "ba-4",
    "Installed `sharp` for image optimization. I can add an API route that converts your hero image to WebP and resizes it — that should cut the file size by 70-80%. Want me to set that up?",
  ),
]

// ===========================================================================
// 20. AskUserQuestion — clarifying what to build
// ===========================================================================
export const EDGE_ASK_USER: UIMessage[] = [
  userMsg("aq-1", "i want to add a booking system to my site for client meetings"),
  assistantToolUse("aq-2", [
    {
      toolId: "toolu_aq_q1",
      name: "AskUserQuestion",
      input: {
        questions: [
          {
            question: "How should the booking system work?",
            header: "Booking type",
            options: [
              {
                label: "Embed Calendly (Recommended)",
                description:
                  "Quick setup — embed a Calendly widget on your page. Handles scheduling, reminders, and calendar sync.",
              },
              {
                label: "Embed Cal.com",
                description:
                  "Open-source alternative to Calendly. Self-hostable, more customizable, free tier available.",
              },
              {
                label: "Custom built",
                description:
                  "Build a booking form from scratch with date/time picker. More work but fully custom design.",
              },
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
        answers: { "How should the booking system work?": "Embed Cal.com" },
      }),
    },
  ]),
  assistantText(
    "aq-4",
    "Good choice. I'll add a Cal.com embed to a new `/booking` page. You'll need a Cal.com account — once you have your embed URL, I'll wire it up. Want me to create the page now with a placeholder?",
  ),
]

// ===========================================================================
// 21. MCP tool — browser screenshot of the site
// ===========================================================================
export const EDGE_MCP_BROWSER: UIMessage[] = [
  userMsg("mb-1", "can you take a screenshot of my site? want to see how the changes look"),
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
    "The hero section and navigation look great with the new colors. I notice the footer text is hard to read against the dark background — the contrast ratio might be too low. Want me to lighten the text?",
  ),
]

// ===========================================================================
// 22. Task subagent — exploring codebase structure
// ===========================================================================
export const EDGE_TASK: UIMessage[] = [
  userMsg("tk-1", "my site is loading really slow, can you figure out why?"),
  assistantToolUse(
    "tk-2",
    [
      {
        toolId: "toolu_tk_t1",
        name: "Task",
        input: {
          subagent_type: "Explore",
          description: "Investigate performance",
          prompt: "Check the site structure, dependencies, and static assets to find performance bottlenecks",
        },
      },
    ],
    null,
    "Let me investigate the performance issue.",
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
          "     1\timport { Hono } from 'hono'\n     2\timport { serveStatic } from 'hono/bun'\n     3\timport { renderer } from './renderer'\n     4\t\n     5\tconst app = new Hono()\n     6\tapp.use(renderer())\n     7\tapp.use('/public/*', serveStatic({ root: './' }))\n     8\t\n     9\tapp.get('/', c => c.render(<Home />))\n    10\tapp.get('/about', c => c.render(<About />))\n    11\t\n    12\texport default app",
      },
    ],
    "toolu_tk_t1",
  ),
  assistantText(
    "tk-5",
    "The server looks fine. Let me check the static assets — large images are the most common cause of slow loading.",
    "toolu_tk_t1",
  ),
  toolResult("tk-6", [
    {
      toolUseId: "toolu_tk_t1",
      toolName: "Task",
      content: JSON.stringify({
        result:
          "Found the bottleneck: user/public/images/hero-bg.png is 4.2MB (uncompressed PNG). Also, no caching headers on static assets. The CSS imports a Google Font that blocks rendering.",
      }),
    },
  ]),
  assistantText(
    "tk-7",
    "Found 3 issues:\n1. **Hero image is 4.2MB** — it's an uncompressed PNG. Converting to WebP would get it under 500KB.\n2. **No caching headers** on static files — browsers re-download everything on each visit.\n3. **Render-blocking font** — Google Fonts CSS blocks the initial paint.\n\nWant me to fix all three?",
  ),
]

// ===========================================================================
// 23. Linear create issue — single issue card
// ===========================================================================
function mcpContent(data: unknown): string {
  return JSON.stringify([{ type: "text", text: JSON.stringify(data) }])
}

export const EDGE_LINEAR_ISSUE: UIMessage[] = [
  userMsg("li-1", "create a bug report for the broken contact form on brightstudio.com"),
  assistantToolUse("li-2", [
    {
      toolId: "toolu_li_c1",
      name: "mcp__linear__create_issue",
      input: {
        title: "Contact form returns 500 on submit",
        description: "Users on brightstudio.com report the contact form throws a server error when submitting.",
        teamId: "team_frontend",
        priority: 2,
      },
    },
  ]),
  toolResult("li-3", [
    {
      toolUseId: "toolu_li_c1",
      toolName: "mcp__linear__create_issue",
      content: mcpContent({
        id: "issue_abc123",
        identifier: "FE-142",
        title: "Contact form returns 500 on submit",
        description:
          "Users on brightstudio.com report the contact form throws a server error when submitting. Likely a validation issue in the Hono API route.",
        priority: { value: 2, name: "High" },
        status: "Todo",
        url: "https://linear.app/brightstudio/issue/FE-142",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        team: "Frontend",
        project: "Bright Studio",
        assignee: "Lars",
        labels: [{ name: "bug", color: "#ef4444" }],
      }),
    },
  ]),
  assistantText("li-4", "Created **FE-142** as a high-priority bug. I assigned it to Lars on the Frontend team."),
]

// ===========================================================================
// 24. Linear list issues — table with filtering/sorting
// ===========================================================================
export const EDGE_LINEAR_ISSUES: UIMessage[] = [
  userMsg("lis-1", "show me all open issues for the Bright Studio project"),
  assistantToolUse("lis-2", [
    {
      toolId: "toolu_lis_l1",
      name: "mcp__linear__list_issues",
      input: { projectId: "proj_brightstudio", status: "active" },
    },
  ]),
  toolResult("lis-3", [
    {
      toolUseId: "toolu_lis_l1",
      toolName: "mcp__linear__list_issues",
      content: mcpContent([
        {
          id: "iss_001",
          identifier: "FE-138",
          title: "Hero image flickers on iOS Safari",
          description: "The WebP hero image shows a flash of white before loading on Safari mobile.",
          priority: { value: 1, name: "Urgent" },
          status: "In Progress",
          url: "https://linear.app/brightstudio/issue/FE-138",
          createdAt: "2026-02-20T09:00:00Z",
          updatedAt: "2026-02-24T15:30:00Z",
          team: "Frontend",
          project: "Bright Studio",
          assignee: "Lars",
        },
        {
          id: "iss_002",
          identifier: "FE-139",
          title: "Add dark mode toggle to navigation",
          priority: { value: 3, name: "Medium" },
          status: "Todo",
          url: "https://linear.app/brightstudio/issue/FE-139",
          createdAt: "2026-02-21T10:00:00Z",
          updatedAt: "2026-02-23T11:20:00Z",
          team: "Frontend",
          project: "Bright Studio",
        },
        {
          id: "iss_003",
          identifier: "FE-140",
          title: "Implement blog RSS feed endpoint",
          description: "Add /rss.xml route that generates an RSS 2.0 feed from the blog posts.",
          priority: { value: 4, name: "Low" },
          status: "Backlog",
          url: "https://linear.app/brightstudio/issue/FE-140",
          createdAt: "2026-02-22T08:00:00Z",
          updatedAt: "2026-02-22T08:00:00Z",
          team: "Frontend",
          project: "Bright Studio",
        },
        {
          id: "iss_004",
          identifier: "FE-141",
          title: "SEO: missing meta descriptions on all pages",
          priority: { value: 2, name: "High" },
          status: "In Review",
          url: "https://linear.app/brightstudio/issue/FE-141",
          createdAt: "2026-02-19T14:00:00Z",
          updatedAt: "2026-02-25T09:45:00Z",
          team: "Frontend",
          project: "Bright Studio",
          assignee: "Lars",
        },
        {
          id: "iss_005",
          identifier: "FE-142",
          title: "Contact form returns 500 on submit",
          priority: { value: 2, name: "High" },
          status: "Todo",
          url: "https://linear.app/brightstudio/issue/FE-142",
          createdAt: "2026-02-25T10:00:00Z",
          updatedAt: "2026-02-25T10:00:00Z",
          team: "Frontend",
          project: "Bright Studio",
          assignee: "Lars",
          labels: [{ name: "bug", color: "#ef4444" }],
        },
        {
          id: "iss_006",
          identifier: "FE-135",
          title: "Migrate from Google Fonts to self-hosted fonts",
          priority: { value: 3, name: "Medium" },
          status: "Done",
          url: "https://linear.app/brightstudio/issue/FE-135",
          createdAt: "2026-02-15T09:00:00Z",
          updatedAt: "2026-02-20T16:00:00Z",
          team: "Frontend",
          project: "Bright Studio",
        },
      ]),
    },
  ]),
  assistantText(
    "lis-4",
    "Found 6 issues for Bright Studio. 1 is in progress (hero image flicker), 1 is in review (SEO meta), and you have 2 new high-priority items to tackle.",
  ),
]

// ===========================================================================
// 25. Email compose — draft card with send/save actions
// ===========================================================================
export const EDGE_EMAIL: UIMessage[] = [
  userMsg("em-1", "write an email to the client about the site launch delay"),
  assistantToolUse("em-2", [
    {
      toolId: "toolu_em_c1",
      name: "mcp__gmail__compose_email",
      input: {
        to: ["maria@brightstudio.nl"],
        subject: "Site launch update — new timeline",
        body: "Hi Maria,\n\nQuick update on the Bright Studio website launch. We discovered some performance issues during final testing — the hero image and font loading need optimization.\n\nWe're pushing the launch by 3 days to February 28th to make sure everything is solid. The fixes are already in progress.\n\nLet me know if you have any questions.\n\nBest,\nLars",
      },
    },
  ]),
  toolResult("em-3", [
    {
      toolUseId: "toolu_em_c1",
      toolName: "mcp__gmail__compose_email",
      content: mcpContent({
        to: ["maria@brightstudio.nl"],
        subject: "Site launch update — new timeline",
        body: "Hi Maria,\n\nQuick update on the Bright Studio website launch. We discovered some performance issues during final testing — the hero image and font loading need optimization.\n\nWe're pushing the launch by 3 days to February 28th to make sure everything is solid. The fixes are already in progress.\n\nLet me know if you have any questions.\n\nBest,\nLars",
        status: "draft",
      }),
    },
  ]),
  assistantText("em-4", "Drafted the email to Maria. You can review it and hit Send when ready."),
]

// ===========================================================================
// 26. Calendar compose event — event draft card
// ===========================================================================
export const EDGE_CALENDAR: UIMessage[] = [
  userMsg("cal-1", "schedule a launch review meeting with the team for friday afternoon"),
  assistantToolUse("cal-2", [
    {
      toolId: "toolu_cal_c1",
      name: "mcp__google_calendar__compose_calendar_event",
      input: {
        summary: "Bright Studio — Launch Review",
        description:
          "Review final checklist before the brightstudio.com launch. Cover: performance fixes, SEO, mobile testing.",
        start: { dateTime: "2026-02-27T14:00:00+01:00", timeZone: "Europe/Amsterdam" },
        end: { dateTime: "2026-02-27T15:00:00+01:00", timeZone: "Europe/Amsterdam" },
        attendees: [{ email: "lars@alive.best" }, { email: "maria@brightstudio.nl" }],
        location: "Google Meet",
      },
    },
  ]),
  toolResult("cal-3", [
    {
      toolUseId: "toolu_cal_c1",
      toolName: "mcp__google_calendar__compose_calendar_event",
      content: mcpContent({
        summary: "Bright Studio — Launch Review",
        description:
          "Review final checklist before the brightstudio.com launch. Cover: performance fixes, SEO, mobile testing.",
        start: { dateTime: "2026-02-27T14:00:00+01:00", timeZone: "Europe/Amsterdam" },
        end: { dateTime: "2026-02-27T15:00:00+01:00", timeZone: "Europe/Amsterdam" },
        attendees: [{ email: "lars@alive.best" }, { email: "maria@brightstudio.nl" }],
        location: "Google Meet",
      }),
    },
  ]),
  assistantText("cal-4", "Created a calendar event for Friday 2-3 PM. Click to add it to your calendar."),
]

// ===========================================================================
// 27. Stripe list subscriptions — subscriptions table
// ===========================================================================
export const EDGE_STRIPE_SUBS: UIMessage[] = [
  userMsg("st-1", "show me our current stripe subscriptions"),
  assistantToolUse("st-2", [
    {
      toolId: "toolu_st_l1",
      name: "mcp__stripe__list_subscriptions",
      input: { limit: 10 },
    },
  ]),
  toolResult("st-3", [
    {
      toolUseId: "toolu_st_l1",
      toolName: "mcp__stripe__list_subscriptions",
      content: mcpContent([
        {
          id: "sub_1NkKzGBjhF8mMo",
          customer: "cus_OaBC123abc",
          status: "active",
          currency: "eur",
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 12,
          items: {
            data: [
              {
                price: {
                  nickname: "Pro Plan",
                  unit_amount: 2900,
                  currency: "eur",
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        },
        {
          id: "sub_2MmLzHCkhG9nNp",
          customer: "cus_PbCD234bcd",
          status: "active",
          currency: "eur",
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 25,
          items: {
            data: [
              {
                price: {
                  nickname: "Starter Plan",
                  unit_amount: 900,
                  currency: "eur",
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        },
        {
          id: "sub_3NnMzIDliH0oOq",
          customer: "cus_QcDE345cde",
          status: "trialing",
          currency: "eur",
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 5,
          items: {
            data: [
              {
                price: {
                  nickname: "Pro Plan",
                  unit_amount: 2900,
                  currency: "eur",
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        },
        {
          id: "sub_4OoNzJEmjI1pPr",
          customer: "cus_RdEF456def",
          status: "canceled",
          currency: "eur",
          current_period_end: Math.floor(Date.now() / 1000) - 86400 * 3,
          items: {
            data: [
              {
                price: {
                  nickname: "Starter Plan",
                  unit_amount: 900,
                  currency: "eur",
                  recurring: { interval: "month", interval_count: 1 },
                },
              },
            ],
          },
        },
      ]),
    },
  ]),
  assistantText(
    "st-4",
    "You have 4 subscriptions: 2 active (1 Pro, 1 Starter), 1 trialing (Pro, 5 days left), and 1 recently canceled.",
  ),
]

// ===========================================================================
// 28. AI clarification questions — interactive questionnaire
// ===========================================================================
export const EDGE_AI_CLARIFICATION: UIMessage[] = [
  userMsg("cq-1", "i want to redesign my homepage"),
  assistantToolUse("cq-2", [
    {
      toolId: "toolu_cq_a1",
      name: "mcp__alive-tools__ask_clarification",
      input: {
        type: "clarification_questions",
        questions: [
          {
            id: "style",
            question: "What visual style are you going for?",
            options: [
              { label: "Minimal & clean", description: "Lots of whitespace, simple typography, muted colors" },
              { label: "Bold & colorful", description: "Vibrant gradients, large type, eye-catching sections" },
              { label: "Professional & corporate", description: "Structured layout, business-focused, trust signals" },
            ],
          },
          {
            id: "hero",
            question: "What should the hero section show?",
            options: [
              { label: "Full-width image with overlay text", description: "Big visual impact, text on top of a photo" },
              { label: "Split layout (text + image)", description: "Text on one side, visual on the other" },
              {
                label: "Text-only with CTA",
                description: "Clean headline, subtext, and a single call-to-action button",
              },
            ],
          },
        ],
        context: "I'll use your preferences to design the homepage layout and choose colors.",
      },
    },
  ]),
  toolResult("cq-3", [
    {
      toolUseId: "toolu_cq_a1",
      toolName: "mcp__alive-tools__ask_clarification",
      content: mcpContent({
        type: "clarification_questions",
        questions: [
          {
            id: "style",
            question: "What visual style are you going for?",
            options: [
              { label: "Minimal & clean", description: "Lots of whitespace, simple typography, muted colors" },
              { label: "Bold & colorful", description: "Vibrant gradients, large type, eye-catching sections" },
              { label: "Professional & corporate", description: "Structured layout, business-focused, trust signals" },
            ],
          },
          {
            id: "hero",
            question: "What should the hero section show?",
            options: [
              { label: "Full-width image with overlay text", description: "Big visual impact, text on top of a photo" },
              { label: "Split layout (text + image)", description: "Text on one side, visual on the other" },
              {
                label: "Text-only with CTA",
                description: "Clean headline, subtext, and a single call-to-action button",
              },
            ],
          },
        ],
        context: "I'll use your preferences to design the homepage layout and choose colors.",
      }),
    },
  ]),
]

// ===========================================================================
// 29. Website config — interactive site creation form
// ===========================================================================
export const EDGE_WEBSITE_CONFIG: UIMessage[] = [
  userMsg("wc-1", "i want to create a new website"),
  assistantToolUse("wc-2", [
    {
      toolId: "toolu_wc_c1",
      name: "mcp__alive-tools__ask_website_config",
      input: {
        type: "website_config",
        templates: [
          { id: "tmpl_blank", name: "Blank", description: "Empty canvas — start from scratch", icon: "blank" },
          {
            id: "tmpl_gallery",
            name: "Portfolio",
            description: "Image gallery with lightbox and project pages",
            icon: "gallery",
          },
          {
            id: "tmpl_business",
            name: "Business",
            description: "Professional site with services, team, and contact sections",
            icon: "business",
          },
          {
            id: "tmpl_saas",
            name: "SaaS",
            description: "Landing page with pricing table, features, and signup",
            icon: "saas",
          },
        ],
        defaultSlug: "my-site",
        context: "Choose a template and pick a subdomain for your new website.",
      },
    },
  ]),
  toolResult("wc-3", [
    {
      toolUseId: "toolu_wc_c1",
      toolName: "mcp__alive-tools__ask_website_config",
      content: mcpContent({
        type: "website_config",
        templates: [
          { id: "tmpl_blank", name: "Blank", description: "Empty canvas — start from scratch", icon: "blank" },
          {
            id: "tmpl_gallery",
            name: "Portfolio",
            description: "Image gallery with lightbox and project pages",
            icon: "gallery",
          },
          {
            id: "tmpl_business",
            name: "Business",
            description: "Professional site with services, team, and contact sections",
            icon: "business",
          },
          {
            id: "tmpl_saas",
            name: "SaaS",
            description: "Landing page with pricing table, features, and signup",
            icon: "saas",
          },
        ],
        defaultSlug: "my-site",
        context: "Choose a template and pick a subdomain for your new website.",
      }),
    },
  ]),
]

// ===========================================================================
// 30. Linear update issue — issue card with "Updated" badge
// ===========================================================================
export const EDGE_LINEAR_UPDATE: UIMessage[] = [
  userMsg("lu-1", "mark FE-138 as done and add a note that the Safari fix shipped"),
  assistantToolUse("lu-2", [
    {
      toolId: "toolu_lu_u1",
      name: "mcp__linear__update_issue",
      input: { issueId: "iss_001", status: "Done", comment: "Safari hero image fix shipped in v1.3.2" },
    },
  ]),
  toolResult("lu-3", [
    {
      toolUseId: "toolu_lu_u1",
      toolName: "mcp__linear__update_issue",
      content: mcpContent({
        id: "iss_001",
        identifier: "FE-138",
        title: "Hero image flickers on iOS Safari",
        description: "The WebP hero image shows a flash of white before loading on Safari mobile.",
        priority: { value: 1, name: "Urgent" },
        status: "Done",
        url: "https://linear.app/brightstudio/issue/FE-138",
        createdAt: "2026-02-20T09:00:00Z",
        updatedAt: new Date().toISOString(),
        team: "Frontend",
        project: "Bright Studio",
        assignee: "Lars",
      }),
    },
  ]),
  assistantText("lu-4", "Marked **FE-138** as Done. The Safari hero image flicker is resolved."),
]

// ===========================================================================
// 31. Linear comment — comment added to an issue
// ===========================================================================
export const EDGE_LINEAR_COMMENT: UIMessage[] = [
  userMsg("lc-1", "add a comment to FE-142 that the form validation was the root cause"),
  assistantToolUse("lc-2", [
    {
      toolId: "toolu_lc_c1",
      name: "mcp__linear__create_comment",
      input: {
        issueId: "issue_abc123",
        body: "Root cause identified: the Hono route handler was missing input validation. The `email` field accepted any string, and the downstream `sendEmail()` threw when it got an empty value. Fixed by adding Zod validation before the API call.",
      },
    },
  ]),
  toolResult("lc-3", [
    {
      toolUseId: "toolu_lc_c1",
      toolName: "mcp__linear__create_comment",
      toolInput: {
        issueId: "issue_abc123",
        body: "Root cause identified: the Hono route handler was missing input validation. The `email` field accepted any string, and the downstream `sendEmail()` threw when it got an empty value. Fixed by adding Zod validation before the API call.",
      },
      content: mcpContent({}),
    },
  ]),
  assistantText("lc-4", "Added the root cause analysis as a comment on FE-142."),
]

// ===========================================================================
// 32. Linear list comments — comments thread on an issue
// ===========================================================================
export const EDGE_LINEAR_COMMENTS: UIMessage[] = [
  userMsg("lcs-1", "show me the comments on FE-142"),
  assistantToolUse("lcs-2", [
    {
      toolId: "toolu_lcs_l1",
      name: "mcp__linear__list_comments",
      input: { issueId: "issue_abc123" },
    },
  ]),
  toolResult("lcs-3", [
    {
      toolUseId: "toolu_lcs_l1",
      toolName: "mcp__linear__list_comments",
      content: mcpContent([
        {
          id: "comment_001",
          body: "Reproduced this on Chrome too. The 500 happens when the email field is empty.",
          user: { name: "Lars", email: "lars@alive.best" },
          createdAt: "2026-02-25T10:30:00Z",
          issue: { identifier: "FE-142", title: "Contact form returns 500 on submit" },
        },
        {
          id: "comment_002",
          body: "Root cause identified: the Hono route handler was missing input validation. Fixed by adding Zod validation before the API call.",
          user: { name: "Claude", email: "noreply@anthropic.com" },
          createdAt: "2026-02-25T11:15:00Z",
          issue: { identifier: "FE-142", title: "Contact form returns 500 on submit" },
        },
        {
          id: "comment_003",
          body: "Fix verified on staging. Closing this one.",
          user: { name: "Lars", email: "lars@alive.best" },
          createdAt: "2026-02-25T14:00:00Z",
          issue: { identifier: "FE-142", title: "Contact form returns 500 on submit" },
        },
      ]),
    },
  ]),
  assistantText(
    "lcs-4",
    "3 comments on FE-142, showing the full investigation trail from reproduction to fix verification.",
  ),
]

// ===========================================================================
// 33. Stripe customers — customer table
// ===========================================================================
export const EDGE_STRIPE_CUSTOMERS: UIMessage[] = [
  userMsg("sc-1", "list our stripe customers"),
  assistantToolUse("sc-2", [
    {
      toolId: "toolu_sc_l1",
      name: "mcp__stripe__list_customers",
      input: { limit: 5 },
    },
  ]),
  toolResult("sc-3", [
    {
      toolUseId: "toolu_sc_l1",
      toolName: "mcp__stripe__list_customers",
      content: mcpContent([
        {
          id: "cus_OaBC123abc",
          name: "Bright Studio BV",
          email: "billing@brightstudio.nl",
          created: Math.floor(Date.now() / 1000) - 86400 * 45,
          balance: 0,
          currency: "eur",
          delinquent: false,
        },
        {
          id: "cus_PbCD234bcd",
          name: "Homable",
          email: "admin@homable.nl",
          created: Math.floor(Date.now() / 1000) - 86400 * 30,
          balance: -500,
          currency: "eur",
          delinquent: false,
        },
        {
          id: "cus_QcDE345cde",
          name: null,
          email: "demo@example.com",
          created: Math.floor(Date.now() / 1000) - 86400 * 5,
          balance: 0,
          currency: "eur",
          delinquent: false,
        },
      ]),
    },
  ]),
  assistantText(
    "sc-4",
    "3 customers. Bright Studio and Homable are established accounts, the third is a recent trial signup.",
  ),
]

// ===========================================================================
// 34. Stripe balance — account balance overview
// ===========================================================================
export const EDGE_STRIPE_BALANCE: UIMessage[] = [
  userMsg("sb-1", "what's our stripe balance?"),
  assistantToolUse("sb-2", [
    {
      toolId: "toolu_sb_b1",
      name: "mcp__stripe__retrieve_balance",
      input: {},
    },
  ]),
  toolResult("sb-3", [
    {
      toolUseId: "toolu_sb_b1",
      toolName: "mcp__stripe__retrieve_balance",
      content: mcpContent({
        available: [{ amount: 284350, currency: "eur" }],
        pending: [{ amount: 14900, currency: "eur" }],
        instant_available: [{ amount: 284350, currency: "eur" }],
      }),
    },
  ]),
  assistantText(
    "sb-4",
    "You have **\u20AC2,843.50** available and **\u20AC149.00** pending. Instant payout is available for the full balance.",
  ),
]

// ===========================================================================
// 35. Stripe account info — account details card
// ===========================================================================
export const EDGE_STRIPE_ACCOUNT: UIMessage[] = [
  userMsg("sa-1", "show me our stripe account details"),
  assistantToolUse("sa-2", [
    {
      toolId: "toolu_sa_a1",
      name: "mcp__stripe__get_stripe_account_info",
      input: {},
    },
  ]),
  toolResult("sa-3", [
    {
      toolUseId: "toolu_sa_a1",
      toolName: "mcp__stripe__get_stripe_account_info",
      content: mcpContent({
        display_name: "Alive Platform",
        account_id: "acct_1NkKzGBjhF8mMo",
      }),
    },
  ]),
  assistantText("sa-4", "Your Stripe account is **Alive Platform** (`acct_1NkKzGBjhF8mMo`)."),
]

// ===========================================================================
// 36. Stripe payment intents — payment intents table
// ===========================================================================
export const EDGE_STRIPE_PAYMENTS: UIMessage[] = [
  userMsg("sp-1", "show me recent payment intents"),
  assistantToolUse("sp-2", [
    {
      toolId: "toolu_sp_l1",
      name: "mcp__stripe__list_payment_intents",
      input: { limit: 5 },
    },
  ]),
  toolResult("sp-3", [
    {
      toolUseId: "toolu_sp_l1",
      toolName: "mcp__stripe__list_payment_intents",
      content: mcpContent([
        { id: "pi_3PxQ1abc", status: "succeeded", amount: 2900, currency: "eur", customer: "cus_OaBC123abc" },
        { id: "pi_3PxQ2def", status: "succeeded", amount: 900, currency: "eur", customer: "cus_PbCD234bcd" },
        {
          id: "pi_3PxQ3ghi",
          status: "requires_payment_method",
          amount: 2900,
          currency: "eur",
          customer: "cus_QcDE345cde",
        },
        { id: "pi_3PxQ4jkl", status: "failed", amount: 900, currency: "eur", customer: "cus_RdEF456def" },
        { id: "pi_3PxQ5mno", status: "succeeded", amount: 2900, currency: "eur", customer: "cus_OaBC123abc" },
      ]),
    },
  ]),
  assistantText("sp-4", "5 recent payment intents: 3 succeeded, 1 awaiting payment method, 1 failed."),
]

// ===========================================================================
// 37. Calendar delete event — delete confirmation card
// ===========================================================================
export const EDGE_CALENDAR_DELETE: UIMessage[] = [
  userMsg("cd-1", "cancel the launch review meeting on friday"),
  assistantToolUse("cd-2", [
    {
      toolId: "toolu_cd_d1",
      name: "mcp__google_calendar__compose_delete_event",
      input: {
        eventId: "evt_abc123def",
        summary: "Bright Studio \u2014 Launch Review",
        start: { dateTime: "2026-02-27T14:00:00+01:00", timeZone: "Europe/Amsterdam" },
        end: { dateTime: "2026-02-27T15:00:00+01:00", timeZone: "Europe/Amsterdam" },
      },
    },
  ]),
  toolResult("cd-3", [
    {
      toolUseId: "toolu_cd_d1",
      toolName: "mcp__google_calendar__compose_delete_event",
      content: mcpContent({
        type: "delete_event_draft",
        eventId: "evt_abc123def",
        calendarId: "primary",
        summary: "Bright Studio \u2014 Launch Review",
        start: { dateTime: "2026-02-27T14:00:00+01:00", timeZone: "Europe/Amsterdam" },
        end: { dateTime: "2026-02-27T15:00:00+01:00", timeZone: "Europe/Amsterdam" },
        location: "Google Meet",
      }),
    },
  ]),
  assistantText("cd-4", "I've prepared the deletion. Click confirm to remove the meeting from your calendar."),
]

// ===========================================================================
// 38. Calendar propose meeting — meeting proposal with time slots
// ===========================================================================
export const EDGE_CALENDAR_MEETING: UIMessage[] = [
  userMsg("cm-1", "propose a 30 minute design review with maria next week"),
  assistantToolUse("cm-2", [
    {
      toolId: "toolu_cm_p1",
      name: "mcp__google_calendar__propose_meeting",
      input: {
        summary: "Design Review \u2014 Bright Studio Homepage",
        description: "Review the new homepage layout and color scheme before launch.",
        attendees: [{ email: "maria@brightstudio.nl" }],
        duration: 30,
      },
    },
  ]),
  toolResult("cm-3", [
    {
      toolUseId: "toolu_cm_p1",
      toolName: "mcp__google_calendar__propose_meeting",
      content: mcpContent({
        summary: "Design Review \u2014 Bright Studio Homepage",
        description: "Review the new homepage layout and color scheme before launch.",
        start: { dateTime: "2026-03-02T10:00:00+01:00", timeZone: "Europe/Amsterdam" },
        end: { dateTime: "2026-03-02T10:30:00+01:00", timeZone: "Europe/Amsterdam" },
        attendees: [{ email: "lars@alive.best" }, { email: "maria@brightstudio.nl" }],
        location: "Google Meet",
      }),
    },
  ]),
  assistantText("cm-4", "Proposed a 30-minute design review for Monday March 2nd at 10:00 AM. Click to add it."),
]

// ===========================================================================
// 39. AI automation config — automation job setup form
// ===========================================================================
export const EDGE_AI_AUTOMATION: UIMessage[] = [
  userMsg("ac-1", "set up an automation to check my site uptime every hour"),
  assistantToolUse("ac-2", [
    {
      toolId: "toolu_ac_c1",
      name: "mcp__alive-tools__ask_automation_config",
      input: {
        type: "automation_config",
        sites: [
          { id: "site_bright", hostname: "brightstudio.com" },
          { id: "site_homable", hostname: "homable.nl" },
        ],
        defaultSiteId: "site_bright",
        defaultName: "Uptime Monitor",
        defaultPrompt: "Check if the site is responding and the homepage loads correctly. Report any errors.",
        context: "Configure the automation job that will run on a schedule.",
      },
    },
  ]),
  toolResult("ac-3", [
    {
      toolUseId: "toolu_ac_c1",
      toolName: "mcp__alive-tools__ask_automation_config",
      content: mcpContent({
        type: "automation_config",
        sites: [
          { id: "site_bright", hostname: "brightstudio.com" },
          { id: "site_homable", hostname: "homable.nl" },
        ],
        defaultSiteId: "site_bright",
        defaultName: "Uptime Monitor",
        defaultPrompt: "Check if the site is responding and the homepage loads correctly. Report any errors.",
        context: "Configure the automation job that will run on a schedule.",
      }),
    },
  ]),
]

// ===========================================================================
// 40. Plan approval — exit plan mode UI
// ===========================================================================
export const EDGE_PLAN_APPROVAL: UIMessage[] = [
  userMsg("pa-1", "rebuild my homepage with a new hero section and pricing table"),
  assistantText(
    "pa-2",
    "I've analyzed your current homepage structure. Here's my plan:\n\n1. Replace the hero section with a split layout (text left, image right)\n2. Add a 3-tier pricing table below the fold\n3. Update the navigation to include a \"Pricing\" anchor link\n4. Optimize the hero image to WebP\n\nLet me submit this for your approval.",
  ),
  assistantToolUse("pa-3", [
    {
      toolId: "toolu_pa_e1",
      name: "exitplanmode",
      input: {},
    },
  ]),
  toolResult("pa-4", [
    {
      toolUseId: "toolu_pa_e1",
      toolName: "exitplanmode",
      content: mcpContent({
        blocked: true,
        planFile: "plan.md",
      }),
    },
  ]),
]

// ===========================================================================
// 13. Long exploration group (6 reads) then text — tests scroll behavior
// ===========================================================================
export const EDGE_LONG_GROUP: UIMessage[] = (() => {
  const msgs: UIMessage[] = [
    userMsg("lg-1", "can you review all my page components and tell me if there are any issues?"),
  ]
  const files = [
    { name: "index.tsx", content: "export function Home() { return <main>...</main> }" },
    { name: "about.tsx", content: "export function About() { return <main>...</main> }" },
    { name: "pricing.tsx", content: "export function Pricing() { return <main>...</main> }" },
    { name: "contact.tsx", content: "export function Contact() { return <main>...</main> }" },
    { name: "blog/index.tsx", content: "export function BlogList() { return <main>...</main> }" },
    { name: "blog/[slug].tsx", content: "export function BlogPost({ slug }) { return <main>...</main> }" },
  ]

  for (let i = 0; i < files.length; i++) {
    const toolId = `toolu_lg_r${i + 1}`
    msgs.push(
      assistantToolUse(`lg-${2 + i * 2}`, [
        { toolId, name: "Read", input: { file_path: `user/pages/${files[i].name}` } },
      ]),
    )
    msgs.push(
      toolResult(`lg-${3 + i * 2}`, [
        {
          toolUseId: toolId,
          toolName: "Read",
          content: files[i].content,
        },
      ]),
    )
  }
  msgs.push(
    assistantText(
      `lg-${2 + files.length * 2}`,
      "Reviewed all 6 pages. A few things I noticed:\n- None of the pages set a `<title>` or meta description — bad for SEO\n- The blog post page takes `slug` as a prop but doesn't validate it\n- The contact page has no form validation\n\nWant me to fix these?",
    ),
  )
  return msgs
})()

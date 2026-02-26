/**
 * Mock SDK messages: two parallel Task subagents with interleaved messages.
 *
 * Flow:
 * 1. User asks to refactor auth + update docs
 * 2. Main agent launches two parallel Task subagents
 * 3. Subagent A (explore auth) does Glob → Read × 5
 * 4. Subagent B (explore docs) does Glob → Read × 3
 * 5. Messages interleave (A, B, A, B, A, ...)
 * 6. Both complete → main agent writes summary
 */

import type { UIMessage } from "@/features/chat/lib/message-parser"

const TASK_A_ID = "toolu_01AAaaAAaaAAaaAAaaAAaaAA"
const TASK_B_ID = "toolu_01BBbbBBbbBBbbBBbbBBbbBB"
const SESSION_ID = "mock-session-parallel-001"

let seq = 0
function ts() {
  return new Date(Date.now() - 300000 + seq++ * 800).toISOString()
}

function mockId(n: number) {
  return `mock-${n}`
}

export const MOCK_MESSAGES: UIMessage[] = [
  // 1. User message
  {
    id: mockId(1),
    type: "user",
    content: "Refactor the auth module and update the docs to match the new structure.",
    timestamp: new Date(ts()),
  },

  // 2. Main assistant — text + two tool_use (parallel Tasks)
  {
    id: mockId(2),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-opus-4-6",
        id: "msg_main_01",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I'll explore the auth module and docs in parallel to understand the current structure.",
          },
          {
            type: "tool_use",
            id: TASK_A_ID,
            name: "Task",
            input: {
              subagent_type: "Explore",
              description: "Explore auth module",
              prompt: "Read the auth module files",
            },
          },
          {
            type: "tool_use",
            id: TASK_B_ID,
            name: "Task",
            input: { subagent_type: "Explore", description: "Explore docs", prompt: "Read the documentation files" },
          },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 500, output_tokens: 120 },
      },
      parent_tool_use_id: null,
      uuid: "uuid-main-01",
      session_id: SESSION_ID,
    },
  },

  // 3. Subagent A: assistant — Glob auth
  {
    id: mockId(3),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_a_01",
        type: "message",
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_a_glob", name: "Glob", input: { pattern: "features/auth/**/*.ts" } }],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 200, output_tokens: 30 },
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-01",
      session_id: SESSION_ID,
    },
  },

  // 4. Subagent A: Glob result
  {
    id: mockId(4),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_a_glob",
            content:
              "features/auth/lib/auth.ts\nfeatures/auth/lib/session.ts\nfeatures/auth/lib/sessionStore.ts\nfeatures/auth/components/LoginForm.tsx\nfeatures/auth/components/AuthGuard.tsx",
            tool_name: "Glob",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-02",
      session_id: SESSION_ID,
    },
  },

  // 5. Subagent B: assistant — Glob docs
  {
    id: mockId(5),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_b_01",
        type: "message",
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_b_glob", name: "Glob", input: { pattern: "docs/**/*.md" } }],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 200, output_tokens: 30 },
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-01",
      session_id: SESSION_ID,
    },
  },

  // 6. Subagent B: Glob result
  {
    id: mockId(6),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_b_glob",
            content:
              "docs/architecture/README.md\ndocs/security/README.md\ndocs/security/auth.md\ndocs/testing/TESTING_GUIDE.md",
            tool_name: "Glob",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-02",
      session_id: SESSION_ID,
    },
  },

  // 7. Subagent A: assistant — Read auth.ts
  {
    id: mockId(7),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_a_02",
        type: "message",
        role: "assistant",
        content: [
          { type: "tool_use", id: "toolu_a_read1", name: "Read", input: { file_path: "features/auth/lib/auth.ts" } },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 300, output_tokens: 20 },
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-03",
      session_id: SESSION_ID,
    },
  },

  // 8. Subagent A: Read result
  {
    id: mockId(8),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_a_read1",
            content:
              "export async function isWorkspaceAuthenticated(workspace: string): Promise<boolean> {\n  const session = await getSession()\n  return session?.workspace === workspace\n}",
            tool_name: "Read",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-04",
      session_id: SESSION_ID,
    },
  },

  // 9. Subagent B: assistant — Read docs/security/auth.md
  {
    id: mockId(9),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_b_02",
        type: "message",
        role: "assistant",
        content: [
          { type: "tool_use", id: "toolu_b_read1", name: "Read", input: { file_path: "docs/security/auth.md" } },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 300, output_tokens: 20 },
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-03",
      session_id: SESSION_ID,
    },
  },

  // 10. Subagent B: Read result
  {
    id: mockId(10),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_b_read1",
            content:
              "# Authentication\n\nThe auth module uses JWT tokens stored in HTTP-only cookies.\n\n## Session Management\n\nSessions are stored in Supabase `iam.sessions` table.",
            tool_name: "Read",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-04",
      session_id: SESSION_ID,
    },
  },

  // 11. Subagent A: assistant — Read session.ts
  {
    id: mockId(11),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_a_03",
        type: "message",
        role: "assistant",
        content: [
          { type: "tool_use", id: "toolu_a_read2", name: "Read", input: { file_path: "features/auth/lib/session.ts" } },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 400, output_tokens: 20 },
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-05",
      session_id: SESSION_ID,
    },
  },

  // 12. Subagent A: Read result
  {
    id: mockId(12),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_a_read2",
            content:
              "export function getSession(): Session | null {\n  const cookie = cookies().get('alive_session')\n  if (!cookie) return null\n  return verifyJWT(cookie.value)\n}",
            tool_name: "Read",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-06",
      session_id: SESSION_ID,
    },
  },

  // 13. Subagent A: assistant — Read sessionStore.ts
  {
    id: mockId(13),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_a_04",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_a_read3",
            name: "Read",
            input: { file_path: "features/auth/lib/sessionStore.ts" },
          },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 500, output_tokens: 20 },
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-07",
      session_id: SESSION_ID,
    },
  },

  // 14. Subagent A: Read result
  {
    id: mockId(14),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_a_read3",
            content:
              "export function tabKey({ userId, workspace, tabGroupId, tabId }: TabKeyParams): string {\n  return `${userId}::${workspace}::${tabGroupId}::${tabId}`\n}",
            tool_name: "Read",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-08",
      session_id: SESSION_ID,
    },
  },

  // 15. Subagent B: assistant — Read architecture README
  {
    id: mockId(15),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_b_03",
        type: "message",
        role: "assistant",
        content: [
          { type: "tool_use", id: "toolu_b_read2", name: "Read", input: { file_path: "docs/architecture/README.md" } },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 400, output_tokens: 20 },
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-05",
      session_id: SESSION_ID,
    },
  },

  // 16. Subagent B: Read result
  {
    id: mockId(16),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_b_read2",
            content:
              "# Architecture\n\n## Overview\n\nAlive is a multi-tenant development platform...\n\n## Request Flow\n\nBrowser → /api/claude/stream → Claude Agent SDK → tool callbacks → @webalive/tools → workspace sandbox",
            tool_name: "Read",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-06",
      session_id: SESSION_ID,
    },
  },

  // 17. Subagent A: assistant — Read LoginForm + AuthGuard
  {
    id: mockId(17),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_a_05",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_a_read4",
            name: "Read",
            input: { file_path: "features/auth/components/LoginForm.tsx" },
          },
          {
            type: "tool_use",
            id: "toolu_a_read5",
            name: "Read",
            input: { file_path: "features/auth/components/AuthGuard.tsx" },
          },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 600, output_tokens: 40 },
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-09",
      session_id: SESSION_ID,
    },
  },

  // 18. Subagent A: Read results (two tool_results in one message)
  {
    id: mockId(18),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_a_read4",
            content:
              "export function LoginForm() {\n  const [email, setEmail] = useState('')\n  const [password, setPassword] = useState('')\n  // ...\n}",
            tool_name: "Read",
            tool_input: {},
          },
          {
            type: "tool_result",
            tool_use_id: "toolu_a_read5",
            content:
              "export function AuthGuard({ children }: { children: React.ReactNode }) {\n  const session = useSession()\n  if (!session) return <LoginForm />\n  return <>{children}</>\n}",
            tool_name: "Read",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-10",
      session_id: SESSION_ID,
    },
  },

  // 19. Subagent B: assistant — Read testing guide
  {
    id: mockId(19),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_b_04",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_b_read3",
            name: "Read",
            input: { file_path: "docs/testing/TESTING_GUIDE.md" },
          },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 500, output_tokens: 20 },
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-07",
      session_id: SESSION_ID,
    },
  },

  // 20. Subagent B: Read result
  {
    id: mockId(20),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_b_read3",
            content:
              "# Testing Guide\n\n## Quick Commands\n\nbun run unit\nbun run e2e\n\n## When to Write Tests\n\nMUST write tests for security-critical functions and new API routes.",
            tool_name: "Read",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-08",
      session_id: SESSION_ID,
    },
  },

  // 21. Subagent A: final assistant text (result summary)
  {
    id: mockId(21),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_a_06",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "The auth module has 5 files:\n\n1. `auth.ts` — workspace authentication check\n2. `session.ts` — JWT cookie-based session retrieval\n3. `sessionStore.ts` — tab-keyed session store with composite keys\n4. `LoginForm.tsx` — email/password login form\n5. `AuthGuard.tsx` — session-gated wrapper component\n\nThe module uses JWT tokens in HTTP-only cookies, with sessions stored in Supabase's `iam.sessions` table.",
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 800, output_tokens: 100 },
      },
      parent_tool_use_id: TASK_A_ID,
      uuid: "uuid-a-11",
      session_id: SESSION_ID,
    },
  },

  // 22. Subagent B: final assistant text (result summary)
  {
    id: mockId(22),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-haiku-4-5-20251001",
        id: "msg_b_05",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "The documentation has 4 relevant files:\n\n1. `docs/architecture/README.md` — system overview with request flow diagram\n2. `docs/security/README.md` — security patterns overview\n3. `docs/security/auth.md` — detailed auth documentation (references JWT cookies, Supabase sessions)\n4. `docs/testing/TESTING_GUIDE.md` — testing requirements (security functions need 100% coverage)\n\nThe docs reference the old auth structure and need updating to match the refactored module.",
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 700, output_tokens: 120 },
      },
      parent_tool_use_id: TASK_B_ID,
      uuid: "uuid-b-09",
      session_id: SESSION_ID,
    },
  },

  // 23. Main agent: Task A result (completed)
  {
    id: mockId(23),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: TASK_A_ID,
            content:
              "The auth module has 5 files:\n\n1. `auth.ts` — workspace authentication check\n2. `session.ts` — JWT cookie-based session retrieval\n3. `sessionStore.ts` — tab-keyed session store\n4. `LoginForm.tsx` — email/password form\n5. `AuthGuard.tsx` — session-gated wrapper\n\nUses JWT in HTTP-only cookies with Supabase iam.sessions.",
            tool_name: "Task",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: null,
      uuid: "uuid-main-02",
      session_id: SESSION_ID,
    },
  },

  // 24. Main agent: Task B result (completed)
  {
    id: mockId(24),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: TASK_B_ID,
            content:
              "Documentation has 4 files referencing auth:\n\n1. docs/architecture/README.md\n2. docs/security/README.md\n3. docs/security/auth.md\n4. docs/testing/TESTING_GUIDE.md\n\nDocs reference old auth structure and need updating.",
            tool_name: "Task",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: null,
      uuid: "uuid-main-03",
      session_id: SESSION_ID,
    },
  },

  // 25. Main agent: assistant summary + Edit tool
  {
    id: mockId(25),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "assistant",
      message: {
        model: "claude-opus-4-6",
        id: "msg_main_02",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Both explorations are complete. The auth module has 5 files using JWT + Supabase sessions, and there are 4 doc files that reference the old structure.\n\nI'll now update the auth documentation to reflect the current module layout.",
          },
          {
            type: "tool_use",
            id: "toolu_main_edit1",
            name: "Edit",
            input: {
              file_path: "docs/security/auth.md",
              old_string: "## Session Management",
              new_string: "## Session Management (Refactored)",
            },
          },
        ],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 150 },
      },
      parent_tool_use_id: null,
      uuid: "uuid-main-04",
      session_id: SESSION_ID,
    },
  },

  // 26. Main agent: Edit result
  {
    id: mockId(26),
    type: "sdk_message",
    timestamp: new Date(ts()),
    content: {
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_main_edit1",
            content: "OK",
            tool_name: "Edit",
            tool_input: {},
          },
        ],
      },
      parent_tool_use_id: null,
      uuid: "uuid-main-05",
      session_id: SESSION_ID,
    },
  },
]

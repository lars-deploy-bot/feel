# OpenClaw Architecture Deep Dive

> **Update (Jan 31, 2026):** OpenClaw has been renamed to **OpenClaw**. Official repo: https://github.com/openclaw/openclaw · Website: https://openclaw.ai. The CLI is now `openclaw`. This report has been updated to use the new naming.

**Date:** January 26, 2026 (Updated: January 31, 2026)
**Version Analyzed:** 2026.1.30 (originally 2026.1.24-3)
**Source:** `/opt/services/clawdbot`

---

## Overview

OpenClaw is a self-hosted personal AI assistant that routes messages from multiple chat platforms (WhatsApp, Telegram, Discord, etc.) through a central Gateway to AI models (Claude, GPT, etc.).

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR DEVICES                                 │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│ WhatsApp │ Telegram │ Discord  │  Slack   │  Signal  │ iMessage     │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────┬───────┘
     │          │          │          │          │            │
     └──────────┴──────────┴────┬─────┴──────────┴────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   OPENCLAW GATEWAY    │
                    │   ws://127.0.0.1:18789│
                    ├───────────────────────┤
                    │ • Channel Manager     │
                    │ • Session Store       │
                    │ • Plugin Loader       │
                    │ • Cron Scheduler      │
                    │ • Control UI          │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   PI AGENT RUNTIME    │
                    │   (Embedded Agent)    │
                    ├───────────────────────┤
                    │ • Tool Execution      │
                    │ • Session Management  │
                    │ • Skill Loading       │
                    │ • Auth Profiles       │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
     ┌────────▼───────┐ ┌──────▼──────┐ ┌───────▼───────┐
     │   Anthropic    │ │   OpenAI    │ │   Bedrock     │
     │   (Claude)     │ │   (GPT)     │ │   (AWS)       │
     └────────────────┘ └─────────────┘ └───────────────┘
```

---

## Directory Structure

```
clawdbot/
├── src/                    # Main TypeScript source
│   ├── agents/            # Agent runtime (PI embedded agent)
│   ├── gateway/           # WebSocket gateway server
│   ├── channels/          # Core channel abstractions
│   ├── plugins/           # Plugin SDK and loader
│   ├── commands/          # CLI commands
│   ├── config/            # Configuration management
│   ├── cron/              # Scheduled tasks
│   ├── whatsapp/          # WhatsApp-specific code
│   ├── telegram/          # Telegram-specific code
│   ├── discord/           # Discord-specific code
│   ├── slack/             # Slack-specific code
│   └── ...
├── extensions/            # Channel plugins (hot-loadable)
│   ├── whatsapp/         # WhatsApp via Baileys
│   ├── telegram/         # Telegram via grammY
│   ├── discord/          # Discord via discord.js
│   ├── slack/            # Slack via Bolt
│   ├── signal/           # Signal via signal-cli
│   ├── imessage/         # iMessage via imsg
│   └── ...
├── skills/               # Agent skills (markdown prompts)
│   ├── github/
│   ├── notion/
│   ├── weather/
│   └── ...
├── apps/                 # Native apps
│   ├── macos/
│   ├── ios/
│   └── android/
└── ui/                   # Control UI (web dashboard)
```

---

## Core Components

### 1. Gateway Server (`src/gateway/server.impl.ts`)

The Gateway is the central hub that:
- Listens on WebSocket (default: `ws://127.0.0.1:18789`)
- Manages all channel connections (WhatsApp, Telegram, etc.)
- Routes incoming messages to the agent
- Serves the Control UI dashboard
- Handles authentication and authorization

**Key Features:**
- **Bind modes:** loopback, lan, tailnet, auto
- **Authentication:** Token-based, optional
- **HTTP endpoints:** OpenAI-compatible `/v1/chat/completions`
- **Config reload:** Hot-reload without restart

```typescript
// Starting the gateway
const server = await startGatewayServer(18789, {
  bind: 'loopback',
  controlUiEnabled: true,
  auth: { token: 'your-token' }
});
```

### 2. Pi Agent Runtime (`src/agents/pi-embedded-runner/`)

The agent runtime is built on **@mariozechner/pi-coding-agent** (Pi Agent by Mario Zechner). This is the core that:
- Manages conversations with AI models
- Executes tools (bash, read, write, edit)
- Handles session persistence
- Routes to different AI providers

**Key Files:**
- `run.ts` - Main agent execution loop
- `compact.ts` - Context window compaction
- `model.ts` - Model resolution and auth
- `tools.ts` - Tool registration

```typescript
// Running an agent turn
const result = await runEmbeddedPiAgent({
  sessionId: 'my-session',
  prompt: 'Hello, what can you do?',
  model: 'claude-opus-4-5',
  provider: 'anthropic',
  workspaceDir: '/home/user/projects',
});
```

### 3. Plugin System (`extensions/`)

Channels are implemented as **plugins** that register with the Gateway.

**Plugin Structure:**
```typescript
// extensions/whatsapp/index.ts
const plugin = {
  id: "whatsapp",
  name: "WhatsApp",
  description: "WhatsApp channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setWhatsAppRuntime(api.runtime);
    api.registerChannel({ plugin: whatsappPlugin });
  },
};
export default plugin;
```

**Plugin Lifecycle:**
1. Gateway loads plugins from `extensions/`
2. Each plugin registers via `api.registerChannel()`
3. Plugin receives messages and calls agent
4. Agent response is sent back through plugin

### 4. Skills System (`skills/`)

Skills are **markdown files** that provide domain-specific knowledge to the agent.

**Skill Format:**
```markdown
---
name: github
description: "Interact with GitHub using the gh CLI..."
---

# GitHub Skill

Use the `gh` CLI to interact with GitHub...

## Pull Requests
Check CI status on a PR:
```bash
gh pr checks 55 --repo owner/repo
```
```

**How Skills Work:**
1. Skills are loaded from `skills/` directory
2. Relevant skills are injected into system prompt
3. Agent uses skill knowledge to respond
4. Skills can define required tools/commands

**Skill Discovery:**
```bash
clawdbot skills list          # List all skills
clawdbot skills info github   # Get skill details
```

---

## Authentication Architecture

### Auth Profiles (`src/agents/auth-profiles/`)

OpenClaw supports multiple authentication methods stored in "auth profiles":

```
~/.clawdbot/agents/<agentId>/agent/auth-profiles.json
```

**Profile Types:**
1. **OAuth** - Claude Pro/Max subscription via browser login
2. **API Key** - Direct Anthropic/OpenAI API keys
3. **External CLI** - Synced from Claude CLI (`claude setup-token`)

**Auth Flow:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Claude CLI      │ ──► │ auth-profiles.json│ ──► │ Agent Runtime   │
│ (oauth tokens)  │     │ (synced on start) │     │ (uses profile)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Key Functions:**
- `ensureAuthProfileStore()` - Load/create auth storage
- `resolveAuthProfileOrder()` - Pick best auth method
- `markAuthProfileFailure()` - Handle auth errors
- `markAuthProfileGood()` - Track successful auth

### Model Fallback (`src/agents/model-fallback.ts`)

When a model fails, OpenClaw can automatically fallback:

```
claude-opus-4-5 → claude-sonnet-4 → gpt-4o → gpt-4o-mini
```

**Fallback Triggers:**
- Rate limiting (429)
- Auth errors
- Context overflow
- Timeout

---

## WhatsApp Integration Deep Dive

### How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ WhatsApp     │ ◄── │ Baileys      │ ◄── │ OpenClaw     │
│ (Phone App)  │     │ (Library)    │     │ Extension    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │  QR Code Scan      │  WebSocket         │  Plugin API
       │  ───────────►      │  Connection        │
       │                    │  ◄─────────        │
       │  Messages          │                    │
       │  ◄─────────────────│                    │
       │                    │  Event: message    │
       │                    │  ─────────────────►│
       │                    │                    │
       │                    │  Send response     │
       │                    │  ◄─────────────────│
       │  Response          │                    │
       │  ◄─────────────────│                    │
```

### Key Library: @whiskeysockets/baileys

OpenClaw uses **Baileys** (v7.0.0-rc.9) for WhatsApp Web protocol:

```json
"@whiskeysockets/baileys": "7.0.0-rc.9"
```

**Baileys Features Used:**
- WhatsApp Web multi-device protocol
- QR code pairing
- Message send/receive
- Media handling (images, audio, video)
- Group management
- Reactions and polls

### WhatsApp Plugin Architecture (`extensions/whatsapp/`)

```typescript
// extensions/whatsapp/src/channel.ts
export const whatsappPlugin: ChannelPlugin<ResolvedWhatsAppAccount> = {
  id: "whatsapp",
  meta: {
    showConfigured: false,
    quickstartAllowFrom: true,
    forceAccountBinding: true,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    polls: true,
    reactions: true,
    media: true,
  },
  // ... config, security, setup methods
};
```

### WhatsApp Message Flow

1. **Inbound Message:**
```
Phone → WhatsApp Servers → Baileys WebSocket → Plugin → Gateway → Agent
```

2. **Outbound Response:**
```
Agent → Gateway → Plugin → Baileys → WhatsApp Servers → Phone
```

### WhatsApp Credentials Storage

```
~/.clawdbot/credentials/whatsapp/default/
├── creds.json          # Session credentials
├── app-state-sync-*.json
└── pre-keys/
```

### WhatsApp Security

**DM Policy Options:**
- `pairing` - Require approval code for unknown senders
- `allowlist` - Only allow specific numbers
- `open` - Accept all messages (dangerous!)

```typescript
security: {
  resolveDmPolicy: ({ cfg, account }) => ({
    policy: account.dmPolicy ?? "pairing",
    allowFrom: account.allowFrom ?? [],
    approveHint: formatPairingApproveHint("whatsapp"),
  }),
}
```

---

## Tools Architecture

### Built-in Tools (`src/agents/pi-tools.ts`)

OpenClaw provides coding tools from **@mariozechner/pi-coding-agent**:

```typescript
import {
  codingTools,
  createEditTool,
  createReadTool,
  createWriteTool,
} from "@mariozechner/pi-coding-agent";
```

**Core Tools:**
| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Write/create files |
| `Edit` | Edit existing files |
| `Exec` | Execute shell commands |
| `Process` | Manage background processes |
| `ApplyPatch` | Apply unified diffs |

### Tool Execution Flow

```
Agent requests tool → Tool Policy Check → Sandbox Check → Execute → Return Result
```

**Tool Policy (`src/agents/pi-tools.policy.ts`):**
- Allowlist/blocklist by tool name
- Group-specific policies (e.g., no exec in groups)
- Subagent-specific restrictions

### OpenClaw-Specific Tools (`src/agents/clawdbot-tools.ts`)

Additional tools for OpenClaw features:
- `session_status` - Get current session info
- `sessions_list` - List conversation sessions
- `sessions_spawn` - Create sub-agents
- `camera_snapshot` - Take photos (mobile nodes)
- `message_send` - Send to channels

---

## Key Libraries & Dependencies

### Core Runtime
| Package | Version | Purpose |
|---------|---------|---------|
| `@mariozechner/pi-coding-agent` | 0.49.3 | Agent runtime, tools |
| `@mariozechner/pi-ai` | 0.49.3 | AI provider abstraction |
| `@agentclientprotocol/sdk` | 0.13.1 | Agent Control Protocol |
| `hono` | 4.11.4 | HTTP framework |
| `ws` | 8.19.0 | WebSocket server |

### Messaging Channels
| Package | Version | Channel |
|---------|---------|---------|
| `@whiskeysockets/baileys` | 7.0.0-rc.9 | WhatsApp |
| `grammy` | 1.39.3 | Telegram |
| `@slack/bolt` | 4.6.0 | Slack |
| `@buape/carbon` | 0.14.0 | Discord |
| `@line/bot-sdk` | 10.6.0 | LINE |

### AI Providers
| Package | Purpose |
|---------|---------|
| (built-in) | Anthropic Claude |
| (built-in) | OpenAI GPT |
| `@aws-sdk/client-bedrock` | AWS Bedrock |

### Utilities
| Package | Purpose |
|---------|---------|
| `playwright-core` | Browser automation |
| `sharp` | Image processing |
| `node-edge-tts` | Text-to-speech |
| `@lydell/node-pty` | Terminal emulation |
| `croner` | Cron scheduling |
| `sqlite-vec` | Vector memory storage |

---

## Configuration

### Main Config (`~/.clawdbot/clawdbot.json`)

```json
{
  "gateway": {
    "port": 18789,
    "bind": "loopback",
    "auth": { "token": "your-token" }
  },
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": {
        "default": {
          "dmPolicy": "pairing",
          "allowFrom": ["+1234567890"]
        }
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "provider": "anthropic",
        "model": "claude-opus-4-5",
        "fallbacks": ["claude-sonnet-4"]
      }
    }
  },
  "tools": {
    "exec": {
      "security": "ask",
      "timeoutSec": 120
    }
  }
}
```

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...      # Direct API key
OPENAI_API_KEY=sk-...             # OpenAI API key
CLAWDBOT_STATE_DIR=~/.clawdbot    # State directory
CLAWDBOT_CONFIG_PATH=...          # Config file path
```

---

## Cron & Automations

### Cron System (`src/cron/`)

OpenClaw has built-in cron for scheduled tasks:

```json
{
  "cron": {
    "jobs": [
      {
        "id": "daily-summary",
        "schedule": "0 9 * * *",
        "message": "Give me a summary of today's tasks",
        "channel": "whatsapp",
        "target": "+1234567890"
      }
    ]
  }
}
```

**Cron Features:**
- Standard cron syntax
- Message to any channel
- Run agent commands
- Webhook triggers

### Webhooks (`src/hooks/`)

External services can trigger the agent:

```bash
POST http://127.0.0.1:18789/hooks/trigger
{
  "hookId": "github-push",
  "payload": { "repo": "myrepo", "commits": [...] }
}
```

---

## Memory & Persistence

### Session Storage

Sessions are stored in JSON files:
```
~/.clawdbot/agents/<agentId>/sessions/sessions.json
```

Each session contains:
- Conversation history
- Model/provider used
- Timestamps
- Channel metadata

### Memory Extension (`extensions/memory-core/`)

Vector-based memory for long-term recall:
- Uses `sqlite-vec` for embeddings
- Searchable memory entries
- Automatic relevance retrieval

```bash
clawdbot memory search "what did we discuss about the project?"
```

---

## Comparison: OpenClaw vs Alive Architecture

| Aspect | OpenClaw | Alive (Claude Bridge) |
|--------|----------|----------------------|
| **Agent Library** | @mariozechner/pi-coding-agent | @anthropic-ai/claude-agent-sdk |
| **Gateway** | Custom WebSocket (Hono + ws) | Next.js API routes + SSE |
| **Auth** | OAuth sync from Claude CLI | Supabase sessions + cookies |
| **Channels** | 12+ (WhatsApp, Telegram, etc.) | Web only |
| **Multi-tenant** | No (single user) | Yes (workspace isolation) |
| **Tools** | Pi Agent tools + custom | Claude SDK tools |
| **Skills** | Markdown files | Not implemented |
| **Memory** | sqlite-vec embeddings | Session-based only |
| **Voice** | ElevenLabs TTS | Not implemented |

---

## How to Send a WhatsApp Message (End-to-End)

### 1. User sends WhatsApp message to their linked session

```
Phone → WhatsApp Servers → Baileys WebSocket
```

### 2. Baileys emits event to WhatsApp plugin

```typescript
// Inside Baileys connection handler
sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    await handleIncomingMessage(msg);
  }
});
```

### 3. Plugin forwards to Gateway

```typescript
// Plugin calls gateway method
await gateway.chat({
  channel: 'whatsapp',
  from: '+1234567890',
  message: 'Hello OpenClaw!',
  sessionKey: 'whatsapp:+1234567890'
});
```

### 4. Gateway runs agent

```typescript
const result = await runEmbeddedPiAgent({
  sessionId: 'whatsapp:+1234567890',
  prompt: 'Hello OpenClaw!',
  model: 'claude-opus-4-5',
});
```

### 5. Agent calls Anthropic API

```
Gateway → Anthropic API → Response
```

### 6. Response sent back through WhatsApp

```typescript
// Plugin sends response
await sock.sendMessage(jid, { text: result.response });
```

### 7. User receives response on phone

```
Baileys → WhatsApp Servers → Phone
```

---

## Running OpenClaw Commands

```bash
# Start gateway
clawdbot gateway --port 18789 --verbose

# Send a message via WhatsApp
clawdbot message send --channel whatsapp --target +1234567890 --message "Hello"

# Talk to agent (and optionally deliver to channel)
clawdbot agent --message "What's the weather?" --deliver

# Check status
clawdbot status --all

# Run diagnostics
clawdbot doctor

# List skills
clawdbot skills list

# Interactive TUI
clawdbot tui
```

---

## Summary

OpenClaw is a sophisticated personal AI assistant with:

1. **Multi-channel architecture** - Single gateway, many messaging platforms
2. **Pi Agent runtime** - Battle-tested coding agent with tools
3. **Plugin system** - Hot-loadable channel extensions
4. **Skills system** - Markdown-based domain knowledge
5. **OAuth + API key auth** - Flexible authentication
6. **Cron + webhooks** - Automation capabilities
7. **Memory persistence** - Vector-based recall

The key insight: OpenClaw is a **personal assistant** (single-user, full system access) while Alive is a **platform** (multi-tenant, sandboxed). They solve different problems but share some architectural patterns.

---

## Automations Deep Dive

OpenClaw has **three automation systems**:

### 1. Cron Jobs (Scheduled Tasks)

Cron jobs run the agent on a schedule - like "every morning at 9am, summarize my emails."

**How it works:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CronService   │ ──► │ Isolated Agent  │ ──► │  Deliver to     │
│   (croner lib)  │     │   Session       │     │  Channel        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
   Schedules jobs         Runs agent turn         Sends to WhatsApp/
   at specified times     in isolated session     Telegram/etc.
```

**Cron Job Structure** (`src/cron/types.ts`):
```typescript
type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule:
    | { kind: "at"; atMs: number }           // One-time at specific time
    | { kind: "every"; everyMs: number }     // Repeat every X ms
    | { kind: "cron"; expr: string; tz?: string }; // Cron expression
  sessionTarget: "main" | "isolated";         // Run in main or isolated session
  wakeMode: "next-heartbeat" | "now";
  payload:
    | { kind: "systemEvent"; text: string }  // Inject system message
    | { kind: "agentTurn"; message: string; deliver?: boolean; channel?: string; to?: string };
};
```

**Example cron config:**
```json
{
  "cron": {
    "enabled": true,
    "jobs": [
      {
        "id": "morning-summary",
        "name": "Morning Summary",
        "schedule": { "kind": "cron", "expr": "0 9 * * *", "tz": "Europe/Amsterdam" },
        "sessionTarget": "isolated",
        "payload": {
          "kind": "agentTurn",
          "message": "Summarize my calendar and important emails for today",
          "deliver": true,
          "channel": "whatsapp",
          "to": "+31612345678"
        }
      }
    ]
  }
}
```

**Key features:**
- Jobs stored in `~/.clawdbot/cron/cron.json`
- Runs in **isolated sessions** (don't pollute main conversation)
- Can deliver results to any channel (WhatsApp, Telegram, etc.)
- Supports one-shot jobs that auto-delete after running

**Cron CLI Commands:**
```bash
clawdbot cron list              # List all cron jobs
clawdbot cron create            # Create a new job
clawdbot cron enable <id>       # Enable a job
clawdbot cron disable <id>      # Disable a job
clawdbot cron delete <id>       # Delete a job
clawdbot cron run <id>          # Run a job now (manual trigger)
```

---

### 2. Hooks (Event-Driven Automation)

Hooks respond to events - like "when I start a new session, save the old one to memory."

**Hook Architecture:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Event Source   │ ──► │  Hook Registry  │ ──► │  Hook Handler   │
│  (command, etc.)│     │  (internal)     │     │  (bundled/user) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
   Triggers events         Matches event to         Executes hook
   (command:new, etc.)     registered hooks         logic
```

**Event Types** (`src/hooks/internal-hooks.ts`):
- `command` - CLI command events (`command:new`, `command:reset`, etc.)
- `session` - Session lifecycle events
- `agent` - Agent bootstrap and execution events
- `gateway` - Gateway lifecycle events

**Bundled Hooks** (in `src/hooks/bundled/`):

| Hook | Event | Description |
|------|-------|-------------|
| `session-memory` | `command:new` | Saves conversation to memory when you run `/new` |
| `command-logger` | `command:*` | Logs all commands |
| `boot-md` | `agent:bootstrap` | Loads bootstrap markdown files |
| `soul-evil` | `agent:*` | Security filter for prompt injection |

**Hook Definition Format** (HOOK.md):
```markdown
---
name: session-memory
description: "Save session context to memory when /new command is issued"
metadata:
  clawdbot:
    emoji: "💾"
    events: ["command:new"]
    requires: { "config": ["workspace.dir"] }
---
# Session Memory Hook
When you run `/new` to start a fresh session:
1. Finds the previous session
2. Extracts conversation
3. Generates descriptive slug via LLM
4. Saves to `<workspace>/memory/YYYY-MM-DD-slug.md`
```

**Registering a hook programmatically:**
```typescript
import { registerInternalHook } from './internal-hooks.js';

registerInternalHook('command:new', async (event) => {
  // Save session to memory
  await saveSessionToMemory(event);
});
```

**Hook CLI Commands:**
```bash
clawdbot hooks list             # List all hooks
clawdbot hooks enable <name>    # Enable a hook
clawdbot hooks disable <name>   # Disable a hook
clawdbot hooks status           # Show hook status
```

---

### 3. Gmail Watcher (Push-Based Automation)

Watches your Gmail and triggers the agent when new emails arrive.

**How it works:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Gmail API      │ ──► │  gog binary     │ ──► │  OpenClaw       │
│  Push (Pub/Sub) │     │  (watch serve)  │     │  Agent          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
   Gmail sends              gog receives           Agent processes
   push notifications       via HTTP endpoint      and responds
```

**Components:**
- **gog binary** - Gmail CLI tool that runs `gmail watch serve`
- **Gmail API Pub/Sub** - Gmail pushes notifications to your endpoint
- **Tailscale endpoint** - Secure way to receive webhooks

**Gmail Config:**
```json
{
  "hooks": {
    "gmail": {
      "account": "me@gmail.com",
      "label": "inbox",
      "topic": "projects/my-project/topics/gmail"
    }
  }
}
```

**When email arrives:**
1. Gmail sends push notification to gog server
2. gog calls OpenClaw hook endpoint
3. Hook triggers agent with email content
4. Agent can respond, archive, label, etc.

**Gmail CLI Commands:**
```bash
clawdbot gmail setup            # Set up Gmail integration
clawdbot gmail watch start      # Start watching inbox
clawdbot gmail watch stop       # Stop watching
```

---

### Automation Flow Summary

```
                    ┌──────────────────────────────────────┐
                    │            CLAWDBOT GATEWAY          │
                    │                                      │
┌─────────────┐     │  ┌─────────┐  ┌─────────┐  ┌──────┐ │
│ Time-based  │─────┼─►│  CRON   │  │  HOOKS  │  │GMAIL │ │
│ (cron expr) │     │  │ Service │  │ Registry│  │WATCH │ │
└─────────────┘     │  └────┬────┘  └────┬────┘  └──┬───┘ │
                    │       │            │          │      │
┌─────────────┐     │       └────────────┼──────────┘      │
│ Event-based │─────┼────────────────────┘                 │
│ (command)   │     │                    │                 │
└─────────────┘     │                    ▼                 │
                    │           ┌─────────────────┐        │
┌─────────────┐     │           │   AGENT RUNNER  │        │
│ Push-based  │─────┼──────────►│  (Pi Embedded)  │        │
│ (gmail)     │     │           └────────┬────────┘        │
└─────────────┘     │                    │                 │
                    │                    ▼                 │
                    │           ┌─────────────────┐        │
                    │           │    DELIVERY     │        │
                    │           │  (to channels)  │        │
                    │           └─────────────────┘        │
                    └──────────────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
             ┌──────────┐         ┌──────────┐         ┌──────────┐
             │ WhatsApp │         │ Telegram │         │  Slack   │
             └──────────┘         └──────────┘         └──────────┘
```

**Key Insight:** OpenClaw automations are **agent-centric** - they all ultimately trigger the agent to do something, then optionally deliver the result to a messaging channel. This is different from traditional automation tools that just run scripts - OpenClaw runs AI conversations on a schedule.

---

*Report generated from OpenClaw source code analysis, January 26, 2026*

# Claude Bridge - Multi-Tenant Development Platform

A multi-tenant web development platform that provides Claude AI assistance with controlled file system access for building and maintaining multiple websites.

## Overview

Claude Bridge enables developers to interact with Claude AI in the context of specific website projects, with each domain getting its own isolated workspace where Claude can read, write, and edit files safely.

## Architecture

### Multi-Tenant Design
- **Domain-based workspaces**: Each hostname automatically maps to its own workspace
- **Isolated environments**: Sites are sandboxed in separate directories
- **Custom workspace selection**: Terminal mode allows manual workspace specification

### Workspace Structure
```
# Secure isolated location (new sites)
/srv/webalive/sites/
├── example.com/       # Owned by site-example-com user
│   └── user/          # Application files
└── demo.site.com/     # Owned by site-demo-site-com user
    └── user/          # Application files

# Legacy location (existing sites)
/root/webalive/sites/
├── existing-site.com/ # Legacy PM2 (insecure)
└── custom-project/    # Manual workspace (terminal mode)
```

## Features

### 🤖 Claude AI Integration
- **File Operations**: Read, write, edit, search files within workspace
- **Real-time Streaming**: Server-Sent Events (SSE) with live updates of Claude's actions
- **Conversation Context**: Maintains context across file operations with session resumption
- **Tool Restrictions**: Limited to safe file operations (Read, Write, Edit, Glob, Grep)
- **Tool Tracking**: Advanced toolUseMap pattern for tracking tool invocations and results
- **Conversation Locking**: Prevents concurrent requests for same conversation

### 🔐 Security & Access Control
- **Passcode Authentication**: Configurable via `BRIDGE_PASSCODE` environment variable
- **Workspace Sandboxing**: Claude cannot access files outside designated workspace
- **Path Traversal Protection**: Prevents directory escape attacks
- **Session Management**: Cookie-based authentication

### 🌐 Multi-Mode Access

#### Standard Mode (`example.com`)
- Automatic workspace: `/claude-bridge/sites/example.com/src`
- Immediate Claude access for domain-specific development

#### Terminal Mode (`terminal.example.com`)
- Custom workspace selection under `webalive/sites/`
- Workspace verification before Claude access
- Advanced development scenarios

### 📁 File Management
- **Directory Browser**: Explore workspace file structure
- **File Operations API**: Programmatic access to workspace files
- **Workspace Verification**: Ensures directories exist before access

## Installation & Setup

### Prerequisites
- Node.js 18+
- Bun package manager (1.2.22+)
- systemd (for secure site isolation)
- Caddy (for reverse proxy)
- PM2 (for Claude Bridge process management)
- Biome (for code formatting and linting)

### Environment Variables
```bash
# Required
ANTHROPIC_API_KEY=your_claude_api_key

# Optional
BRIDGE_PASSCODE=your_secure_passcode  # If unset, any passcode works
CLAUDE_MODEL=claude-3-5-sonnet-20241022  # Default model
WORKSPACE_BASE=/srv/webalive/sites       # Base directory for workspaces (default: /srv/webalive/sites)

# Auto-deployment (optional)
GITHUB_WEBHOOK_SECRET=your_webhook_secret  # For GitHub webhook security (run: bun run setup-webhook)
DEPLOY_BRANCH=main                         # Only deploy on this branch (default: main)

# Local development (requires both)
BRIDGE_ENV=local                        # Enables local template mode + test user (test/test)
LOCAL_TEMPLATE_PATH=/absolute/path/to/packages/template/user  # Absolute path to template workspace
```

### Local Development Login
When `BRIDGE_ENV=local` is set, you can use the test credentials:
- **Workspace**: `test`
- **Passcode**: `test`

### Development

#### Local Setup (First Time)
```bash
# Install dependencies
bun install

# Set up local development workspace
bun run setup

# Add environment variables to apps/web/.env.local
# (The setup script will show you the exact values)
```

#### Start Development Server
```bash
# Start development server
bun run dev
# or
bun run web
```

See [docs/setup/README.md](./docs/setup/README.md) for detailed local development setup instructions.

### Production Deployment

#### Automated Deployment (Recommended)

**One-Command Deploy:**
```bash
# Pull latest code, atomic build, restart PM2 with health checks
bun run deploy
```

**What it does:**
- Pulls latest code from git
- Installs dependencies
- Runs atomic build (timestamped directories + symlink)
- Restarts PM2 process
- Performs health check
- Rolls back automatically if health check fails

See `docs/deployment.md` for detailed atomic build system documentation.

**GitHub Webhook Auto-Deploy:**
```bash
# 1. Setup webhook (generates secret, adds to .env)
bun run setup-webhook

# 2. Deploy with webhook enabled
bun run deploy

# 3. Configure GitHub webhook (instructions shown by setup-webhook)
#    - Payload URL: https://your-domain.com/api/webhook/deploy
#    - Secret: (copied from setup output)
#    - Events: Just the push event

# 4. Push to main → auto-deploys!
git push origin main
```

**View Deployment Logs:**
```bash
# PM2 logs
pm2 logs claude-bridge

# Webhook deployment logs
curl https://your-domain.com/api/webhook/deploy/logs/deploy-TIMESTAMP.log
```

#### Manual Deployment

**Atomic Build System:**
```bash
# Build only (creates timestamped directory + symlink)
./scripts/build-atomic.sh

# Restart PM2 to serve new build
pm2 restart claude-bridge

# Or combine both steps
./scripts/build-atomic.sh && pm2 restart claude-bridge
```

The atomic build system prevents race conditions by:
- Building to isolated `dist.TIMESTAMP/` directories
- Using symlinks for atomic swaps (kernel-level operation)
- Keeping last 3 builds for instant rollback
- Never serving incomplete builds to PM2

**First-time PM2 setup:**
```bash
cd apps/web
pm2 start "bun next start -p 8999" --name claude-bridge
pm2 save
```

#### Caddy Configuration & Domain Routing

**🔒 Secure Site Deployment (ONLY WAY):**
```bash
# Deploy with systemd isolation + automatic password
/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh newsite.com

# Or use package.json script:
bun run deploy-site newsite.com

# Result: systemd service with dedicated user, security hardening, and automatic password "supersecret"
```

**Manual Caddy Setup (if needed):**
```bash
# 1. Add to /root/webalive/claude-bridge/Caddyfile
newsite.com {
    reverse_proxy localhost:3338
}

# 2. Reload (zero-downtime)
systemctl reload caddy
```

**Architecture:**
- **Main** (`/etc/caddy/Caddyfile`): System config + `import /root/webalive/claude-bridge/Caddyfile`
- **Sites** (`/root/webalive/claude-bridge/Caddyfile`): Domain→port mappings
- **Auto-sync**: Changes applied instantly via import, no file copying
- **Validation**: `caddy validate --config /etc/caddy/Caddyfile`

**Deployment Scripts:**
- **Secure (Recommended)**: `claude-bridge/scripts/deploy-site-systemd.sh` (systemd isolation)

## Usage Examples

### Standard Domain Access
1. Visit `https://yoursite.com`
2. Enter passcode
3. Start chatting with Claude about your site
4. Claude can read/edit files in `/claude-bridge/sites/yoursite.com/src`

### Terminal Mode Access
1. Visit `https://terminal.yoursite.com`
2. Enter passcode
3. Specify workspace (e.g., `webalive/sites/custom-project`)
4. Verify workspace exists
5. Claude can work in `/root/webalive/sites/custom-project`

### Claude Capabilities
```
You: "Read the package.json file and update the version"
Claude: [reads file, analyzes, makes changes]

You: "Find all TODO comments in the codebase"
Claude: [searches with Grep, provides list]

You: "Create a new React component for user authentication"
Claude: [writes new file, follows project conventions]
```

## API Endpoints

### Authentication
- `POST /api/login` - Authenticate with passcode, sets session cookie
- `POST /api/logout` - Clear session cookies
- `GET /api/manager` - List domain configurations (requires manager auth)
- `POST /api/manager` - Update domain passwords (requires manager auth)

### Claude Integration

#### `POST /api/claude/stream` (Streaming SSE)
Real-time streaming endpoint with Server-Sent Events.

**Headers**: `Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive`

**Request Body**:
```json
{
  "message": "What does this file do?",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "workspace": "webalive/sites/demo"  // optional; required for terminal mode
}
```

**Response**: SSE stream with events:
- `start` - Conversation initialization
- `message` - Each Claude SDK message
- `session` - Session ID for resumption
- `complete` - Final completion summary
- `error` - Error information

**Status Codes**:
- 200 OK – Stream begins
- 401 Unauthorized – No session cookie
- 409 Conflict – Conversation already in progress (locked)
- 400 Bad Request – Invalid workspace or missing required fields
- 500 Internal Server Error – SDK query failed

#### `POST /api/claude` (Polling)
Non-streaming endpoint returning full response as JSON.

**Request Body**: Same as streaming endpoint

**Response**:
```json
{
  "ok": true,
  "host": "localhost",
  "cwd": "/path/to/workspace",
  "result": { /* SDKResultMessage */ },
  "requestId": "abc123"
}
```

### File Operations
- `POST /api/files` - Browse workspace directory
- `POST /api/verify` - Verify workspace exists and is readable

### Deployment Webhooks
- `POST /api/webhook/deploy` - GitHub webhook receiver for auto-deployment
  - **Authentication**: HMAC SHA-256 signature verification
  - **Headers**: `x-github-event`, `x-hub-signature-256`
  - **Events**: Push events on configured branch (default: main)
  - **Response**: Immediate (deployment runs in background)
  - **Logs**: Stored in `logs/deploy-TIMESTAMP.log`
- `GET /api/webhook/deploy` - Check webhook status and recent deployments
- `GET /api/webhook/deploy/logs/[filename]` - View specific deployment log

## Security Features

### Workspace Isolation
- Claude operations restricted to designated workspace
- Path validation prevents directory traversal
- No access to system files or other sites

### Authentication
- **Domain Manager**: Hidden access via `/manager` URL for password management
- **Separate Sessions**: Manager uses `manager_session` cookie, isolated from domain sessions
- **Multi-Mode Authentication**: Manager access ("wachtwoord") + domain-specific passwords (`domain-passwords.json`)
- Session-based authentication
- Configurable passcode protection
- Optional bypass for development (when `BRIDGE_PASSCODE` unset)

### Tool Restrictions
- Limited to safe file operations
- No shell access or dangerous operations
- All tool usage logged and monitored

## Testing

```bash
# Run unit tests
cd apps/web && bun test

# Run E2E tests (requires setup)
bun run test:e2e

# Run with coverage
cd apps/web && bun test --coverage
```

**First time setup for E2E tests:**
```bash
bunx playwright install chromium
bun run setup
```

See [Testing Guide](./docs/testing/TESTING_GUIDE.md) for detailed testing instructions, examples, and best practices.

## Development Scripts

```bash
# Development
bun run dev          # Start dev server with Turbo
bun run web          # Start web app only
bun run widget       # Start widget server (Go-based)

# Testing
bun test             # Run unit tests (from apps/web)
bun run test:e2e     # Run E2E tests

# Production
./scripts/build-atomic.sh  # Atomic build (timestamped + symlink)
bun run start                # Start production server

# Deployment
bun run deploy       # Full deploy: pull, atomic build, PM2 restart, health check
bun run see          # View PM2 logs

# Site Deployment
bun run deploy-site  # Deploy new site with systemd isolation

# Code Quality
bun run format       # Format code with Biome
bun run lint         # Lint code with Biome

# CORS & Infrastructure
bun run update-cors  # Update CORS domains configuration

# Git Operations (with custom SSH key)
bun run push         # Push with alive_brug_deploy SSH key
bun run pull         # Pull with alive_brug_deploy SSH key
```

## Directory Structure

```
claude-bridge/
├── apps/web/                 # Next.js application
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── claude/       # Claude integration
│   │   │   ├── files/        # File operations
│   │   │   ├── login/        # Authentication
│   │   │   └── verify/       # Workspace verification
│   │   ├── chat/             # Chat interface
│   │   ├── workspace/        # Workspace selection
│   │   └── globals.css       # Global styles
│   ├── components/           # React components
│   ├── lib/                  # Utility libraries
│   ├── dist → dist.TIMESTAMP # Symlink to active build (gitignored)
│   ├── dist.20251105-155847/ # Timestamped build (gitignored)
│   └── package.json
├── scripts/                  # Deployment scripts
│   ├── build-atomic.sh       # Atomic build with symlinks
│   └── build-and-serve.sh    # Full deployment script
├── docs/                     # Documentation
│   └── deployment.md         # Atomic build system guide
├── Caddyfile                 # Reverse proxy config
└── package.json              # Monorepo configuration
```

## Enhanced Architecture Features

### Streaming & SSE Protocol

The platform uses Server-Sent Events (SSE) for real-time streaming of Claude's responses:

**Event Schema:**
```json
{
  "type": "start|message|session|complete|error",
  "requestId": "abc123",
  "timestamp": "2025-10-28T14:00:00Z",
  "data": { /* event-specific payload */ }
}
```

**Event Lifecycle:**
1. **start** – `{ host, cwd, message, messageLength, isResume }`
2. **message** – For each SDK message: `{ messageCount, messageType, content: SDKMessage }`
3. **session** – `{ sessionId }` (extracted from system:init, persisted to SessionStore)
4. **complete** – `{ totalMessages, result: SDKResultMessage | null }`
5. **error** – `{ error, message, details, stack }`

### Tool Tracking & Result Rendering

**toolUseMap Pattern:**
- Global `Map<tool_use_id, tool_name>` tracks tool invocations
- Assistant messages with `tool_use` blocks populate the map
- User messages with `tool_result` blocks lookup tool names for proper rendering
- Enables flexible message interleaving and component dispatch

### Session Management & Concurrency

**Conversation Locking:**
- `Set<conversationKey>` prevents concurrent requests for same conversation
- Lock acquired before SDK query, released in finally block
- Returns 409 Conflict if conversation already in progress

**Session Persistence:**
- SessionStore interface with get/set/delete operations
- Key format: `${userId}::${workspace}::${conversationId}`
- Supports conversation resumption across browser sessions
- Default in-memory implementation (Redis/DB recommended for production)

### Message Grouping Strategy

Messages are batched into groups for optimal UI rendering:
- **Text messages** (user + assistant-text-only) → separate groups
- **Thinking/tool messages** → accumulated into groups until completion
- `isComplete` flag drives loading states and UI finalization

## Key Dependencies

- **Next.js 16.0.0** – React framework with App Router
- **React 19.2.0** – Latest React with concurrent features
- **@anthropic-ai/claude-agent-sdk 0.1.25** – Claude integration (query, streaming, tool callbacks)
- **TailwindCSS 4.1.15** – Utility-first CSS framework
- **Lucide React 0.546.0** – Modern icon library
- **Zod 4.1.12** – TypeScript-first schema validation
- **Groq SDK 0.34.0** – Alternative AI model integration
- **React Hot Toast 2.6.0** – Toast notifications
- **React Markdown 10.1.0** – Markdown rendering with GFM support

## Production Checklist

### Application Security
- [ ] Replace in-memory SessionStore with Redis/database
- [ ] Implement JWT session tokens with expiry
- [ ] Add logout endpoint and session invalidation
- [ ] Set proper cookie flags (httpOnly, Secure, SameSite)
- [ ] Add rate limiting on authentication and streaming endpoints
- [ ] Validate workspace boundary enforcement with adversarial paths
- [ ] Log all tool invocations for audit trail

### Performance & Monitoring
- [ ] Monitor SessionStore memory usage and concurrent conversation limits
- [ ] Add request tracing with requestId propagation
- [ ] Implement health checks for all services
- [ ] Set up error tracking and alerting
- [ ] Configure proper logging levels for production

### Infrastructure
- [ ] Configure Caddy reverse proxy with HTTPS/TLS
- [ ] Set up PM2 process manager for high availability
- [ ] Validate all required environment variables
- [ ] Test domain routing for both standard and terminal modes
- [ ] Implement backup and recovery procedures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following existing code style (use `bun run format` and `bun run lint`)
4. Test with both standard and terminal modes
5. Ensure all environment variables are documented
6. Update relevant documentation
7. Submit a pull request

## License

[Add your license here]
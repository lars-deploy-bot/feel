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
/root/webalive/sites/
├── example.com/
│   └── src/           # Claude works here for example.com
├── demo.site.com/
│   └── src/           # Claude works here for demo.site.com
└── custom-project/    # Manual workspace (terminal mode)
```

## Features

### 🤖 Claude AI Integration
- **File Operations**: Read, write, edit, search files within workspace
- **Real-time Streaming**: Live updates of Claude's actions
- **Conversation Context**: Maintains context across file operations
- **Tool Restrictions**: Limited to safe file operations (Read, Write, Edit, Glob, Grep)

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
- Bun package manager
- PM2 (for production)
- Caddy (for reverse proxy)

### Environment Variables
```bash
# Required
ANTHROPIC_API_KEY=your_claude_api_key

# Optional
BRIDGE_PASSCODE=your_secure_passcode  # If unset, any passcode works
CLAUDE_MODEL=claude-3-5-sonnet-20241022  # Default model
WORKSPACE_BASE=/claude-bridge/sites     # Base directory for workspaces
```

### Development
```bash
# Install dependencies
bun install

# Start development server
bun run dev
# or
bun run web
```

### Production Deployment
```bash
# Build application
bun run build

# Start with PM2
pm2 start apps/web/next start --name claude-bridge -p 8999

# Configure Caddy reverse proxy
# See Caddyfile for domain routing
```

#### Caddy Configuration & Domain Routing

**Quick Setup:**
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
See `claude-bridge/scripts/deploy-site.sh` for automated Caddy reloads

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
- `POST /api/login` - Authenticate with passcode

### Claude Integration
- `POST /api/claude` - Send message to Claude (non-streaming)
- `POST /api/claude/stream` - Send message to Claude (streaming)

### File Operations
- `POST /api/files` - Browse workspace directory
- `POST /api/verify` - Verify workspace exists

## Security Features

### Workspace Isolation
- Claude operations restricted to designated workspace
- Path validation prevents directory traversal
- No access to system files or other sites

### Authentication
- Session-based authentication
- Configurable passcode protection
- Optional bypass for development (when `BRIDGE_PASSCODE` unset)

### Tool Restrictions
- Limited to safe file operations
- No shell access or dangerous operations
- All tool usage logged and monitored

## Development Scripts

```bash
# Development
bun run dev          # Start dev server with Turbo
bun run web          # Start web app only

# Production
bun run build        # Build for production
bun run start        # Start production server

# Process Management
bun run see          # View PM2 logs
bun run restart      # Restart PM2 process

# Code Quality
bun run format       # Format code with Biome
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
│   └── package.json
├── scripts/                  # Deployment scripts
├── docs/                     # Documentation
├── Caddyfile                 # Reverse proxy config
└── package.json              # Monorepo configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following existing code style
4. Test with both standard and terminal modes
5. Submit a pull request

## License

[Add your license here]
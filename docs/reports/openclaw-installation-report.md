# OpenClaw Installation Report

**Date:** January 25-26, 2026 (Updated: January 31, 2026)
**Server:** claude-server (138.201.56.93)
**Status:** Installed and Running

> **Update (Jan 31, 2026):** ClawdBot has been renamed to **OpenClaw**. Official repo: https://github.com/openclaw/openclaw · Website: https://openclaw.ai · The CLI is now `openclaw`. Service renamed to `openclaw-gateway.service`. Currently running v2026.1.30.

---

## Summary

OpenClaw v2026.1.30 is installed and configured as a systemd service on the WebAlive infrastructure server.

## What is OpenClaw?

OpenClaw (formerly ClawdBot) is a self-hosted AI assistant created by Peter Steinberger. Unlike web-based AI interfaces, OpenClaw lives inside messaging apps you already use (Telegram, WhatsApp, Discord, Slack, Signal, iMessage) and provides a unified gateway for AI agent interactions.

**Key differentiators:**
- Local-first: Runs on your own infrastructure
- Multi-channel inbox: One agent, many messaging platforms
- Multi-agent routing: Route different channels to isolated agents
- Voice wake + talk mode: Always-on speech (macOS/iOS/Android)
- Skill system: Extensible capabilities

## Installation Details

### Prerequisites Installed

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 22.22.0 | Upgraded from v20 (OpenClaw requires ≥22) |
| OpenClaw | 2026.1.30 | Latest stable |
| Source | /opt/services/clawdbot | Cloned from GitHub (github.com/openclaw/openclaw) |

### Service Configuration

**Systemd Service:** `openclaw-gateway.service`

```bash
# Status
systemctl status openclaw-gateway.service

# Logs
journalctl -u openclaw-gateway.service -f

# Restart
systemctl restart openclaw-gateway.service
```

**Gateway:** Running on `ws://127.0.0.1:18789` (localhost only for security)

**Dashboard:** `http://127.0.0.1:18789/` (accessible only from server)

### Authentication

ClawdBot automatically synced Anthropic credentials from the existing Claude CLI installation. No additional API key configuration was needed.

## Current Capabilities

### Ready Skills (9/49)

| Skill | Description |
|-------|-------------|
| `coding-agent` | Run Codex CLI, Claude Code, or Pi Coding Agent |
| `github` | Interact with GitHub via `gh` CLI |
| `notion` | Notion API for pages, databases, and blocks |
| `slack` | Slack channel control |
| `tmux` | Remote-control tmux sessions |
| `video-frames` | Extract frames from videos using ffmpeg |
| `weather` | Weather forecasts (no API key required) |
| `skill-creator` | Create custom agent skills |
| `bluebubbles` | BlueBubbles messaging integration |

### Available But Not Configured (40)

Many skills require additional setup (API keys, OAuth, or macOS-specific tools):

- **Messaging:** WhatsApp, Telegram, Discord, Signal, iMessage, Microsoft Teams, Matrix
- **Productivity:** 1Password, Apple Notes, Apple Reminders, Bear Notes, Google Workspace
- **Development:** ClawdHub, MCP Porter
- **Media:** GIF search, image generation (Gemini), camera capture
- **Home:** Eight Sleep control, BluOS audio

### Core Tools (Always Available)

- File operations (Read, Write, Edit)
- Shell command execution
- Web search (requires Brave API key for best results)
- URL fetching
- Browser automation (start, navigate, screenshot, act)
- Memory persistence
- Sub-agents for background tasks

## Usage Examples

### Talk to the Agent

```bash
# One-shot message
openclaw agent --agent main --message "What's the weather in Amsterdam?"

# Interactive TUI
openclaw tui
```

### Check Status

```bash
# Full status
openclaw status --all

# Health check
openclaw health

# Doctor (diagnostics)
openclaw doctor
```

### Manage Skills

```bash
# List all skills
openclaw skills list

# Get skill details
openclaw skills info weather
```

### Connect Messaging Channels

```bash
# Interactive setup
openclaw onboard

# WhatsApp (scan QR)
openclaw channels login

# Configure specific channel
openclaw configure
```

## Comparison: OpenClaw vs Claude Bridge

| Feature | OpenClaw | Claude Bridge |
|---------|----------|---------------|
| **Primary Use** | Personal AI assistant | Website development platform |
| **Interface** | Messaging apps, TUI, CLI | Web chat, file operations |
| **Multi-tenant** | Single user (agents) | Multi-tenant (workspaces) |
| **File Access** | Full system access | Sandboxed per workspace |
| **Channels** | WhatsApp, Telegram, Discord, etc. | Web only |
| **Voice** | Yes (ElevenLabs) | No |
| **Target User** | Power users, developers | Website builders |

### Potential Synergies

1. **OpenClaw as notification channel:** Send build/deploy notifications via Telegram/Discord
2. **OpenClaw for ops:** Use OpenClaw's tmux skill for server management
3. **Unified agent:** Route OpenClaw to Claude Bridge workspaces
4. **Voice interface:** Add voice commands for website building

## Security Considerations

- Gateway runs on localhost only (127.0.0.1:18789)
- No external ports exposed
- Uses existing Claude CLI credentials
- Pairing codes required for unknown DMs (default security)

## Next Steps (Optional)

1. **Enable Tailscale** for remote access to the gateway
2. **Connect Telegram/Discord** for remote AI access
3. **Set up Brave API key** for web search capability
4. **Create custom skills** for WebAlive-specific tasks
5. **Configure webhooks** for integration with n8n workflows

## Files & Locations

| Item | Path |
|------|------|
| Installation | `/opt/services/clawdbot` |
| Config | `/root/.clawdbot/clawdbot.json` (legacy path, still works) |
| Agent workspace | `/root/.clawdbot/agents/main/` |
| Sessions | `/root/.clawdbot/agents/main/sessions/sessions.json` |
| Systemd service | `/etc/systemd/system/openclaw-gateway.service` |
| Logs | `journalctl -u openclaw-gateway.service` |

## References

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw Website](https://openclaw.ai/)
- [VelvetShark Review](https://velvetshark.com/clawdbot-the-self-hosted-ai-that-siri-should-have-been)

---

*Report generated from Claude Code conversation session `63fbcb14-1715-4a0c-aed2-9e78f1453ab8`*

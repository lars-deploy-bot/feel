# ClawdBot Skills Analysis

**Date**: 2026-01-26
**Purpose**: Understand how ClawdBot skills work and what we can adopt for Alive

## Overview

ClawdBot uses a skill system based on **markdown files with frontmatter**. The core library is `@mariozechner/pi-coding-agent` from the [badlogic/pi-mono](https://github.com/badlogic/pi-mono) repository.

## Local References

- ClawdBot repo: `/opt/services/clawdbot`
- pi-mono library: `/opt/third/pi-mono`
- pi-skills collection: `/opt/third/pi-skills`

## How Skills Work

### Skill Format

Skills are simple `SKILL.md` files with YAML frontmatter:

```markdown
---
name: skill-name
description: Short description for the agent
---

# Instructions

Detailed instructions for the agent...
Helper files available at: {baseDir}/script.js
```

### Required Frontmatter Fields

| Field | Required | Max Length | Description |
|-------|----------|------------|-------------|
| `name` | Yes | 64 chars | Lowercase a-z, 0-9, hyphens only |
| `description` | Yes | 1024 chars | Shown to agent for skill selection |
| `disable-model-invocation` | No | - | If true, skill only via explicit `/skill:name` |

### Directory Structure

```
~/.pi/agent/skills/          # User-level skills
.pi/skills/                   # Project-level skills
skills/
├── weather/
│   └── SKILL.md
├── github/
│   └── SKILL.md
└── brave-search/
    ├── SKILL.md
    ├── search.js
    └── package.json
```

### How Loading Works

The `loadSkillsFromDir()` function:

1. Scans directories for `SKILL.md` files (recursive)
2. Parses frontmatter for metadata
3. Validates name/description per spec
4. Returns array of `Skill` objects

### Prompt Integration

`formatSkillsForPrompt()` generates XML for the system prompt:

```xml
<available_skills>
  <skill>
    <name>weather</name>
    <description>Get current weather and forecasts</description>
    <location>/path/to/skills/weather/SKILL.md</location>
  </skill>
</available_skills>
```

The agent then uses the Read tool to load skill content when relevant.

## ClawdBot vs Alive Comparison

### What We Already Have

| Feature | Alive Status | Notes |
|---------|--------------|-------|
| Skill loading | ✅ Have it | `.claude/commands/*.md` |
| Markdown format | ✅ Compatible | Same frontmatter style |
| Skill tool | ✅ Have it | Loads skills into context |
| System prompt injection | ✅ Have it | Via `<available_skills>` |

### What We're Missing

| Feature | ClawdBot | Alive |
|---------|----------|-------|
| `{baseDir}` placeholder | ✅ | ❌ |
| Skill validation | ✅ | Partial |
| 50+ bundled skills | ✅ | ~20 |
| Voice skills | ✅ | ❌ |
| Messaging skills | ✅ | ❌ |

## Available pi-skills (Ready to Use)

From `/opt/third/pi-skills`:

| Skill | Description | Requirements |
|-------|-------------|--------------|
| `brave-search` | Web search via Brave API | Node.js, API key |
| `browser-tools` | Chrome automation via CDP | Chrome, Node.js |
| `gccli` | Google Calendar CLI | Node.js, OAuth |
| `gdcli` | Google Drive CLI | Node.js, OAuth |
| `gmcli` | Gmail CLI | Node.js, OAuth |
| `transcribe` | Speech-to-text (Groq Whisper) | curl, API key |
| `vscode` | VS Code integration | VS Code |
| `youtube-transcript` | YouTube transcripts | Node.js |

## ClawdBot Bundled Skills (50+)

From `/opt/services/clawdbot/skills`:

### Productivity
- `1password` - Password manager
- `apple-notes` - Apple Notes integration
- `apple-reminders` - Reminders integration
- `bear-notes` - Bear app
- `notion` - Notion integration
- `obsidian` - Obsidian vault
- `things-mac` - Things todo app
- `trello` - Trello boards

### Media
- `spotify-player` - Spotify control
- `sonoscli` - Sonos speakers
- `video-frames` - Video frame extraction
- `camsnap` - Camera snapshots
- `peekaboo` - Screenshot tool

### Communication
- `discord` - Discord integration
- `slack` - Slack integration
- `imsg` - iMessage
- `bluebubbles` - iMessage bridge

### Development
- `coding-agent` - Run Codex/Claude Code/Pi
- `github` - GitHub CLI wrapper
- `tmux` - Terminal multiplexer

### Utilities
- `weather` - Weather via wttr.in
- `local-places` - Local business search
- `food-order` - Food ordering
- `goplaces` - Google Places

## Key Insights

### 1. Skills Are Just Instructions

Skills don't contain code that runs - they contain **instructions for the agent**. The agent reads the skill and follows the instructions using its tools (bash, read, write, etc.).

### 2. Helper Scripts Are Optional

Some skills include helper scripts (like `search.js` in brave-search), but these are just convenience wrappers. The agent could do the same with raw bash/curl.

### 3. {baseDir} Is Important

The `{baseDir}` placeholder gets replaced with the skill's directory path at runtime. This allows skills to reference their helper scripts:

```markdown
Run the search:
```bash
{baseDir}/search.js "query"
```
```

### 4. Compatibility Is High

Our existing skill system is ~90% compatible with pi-coding-agent format. We could:
- Copy pi-skills directly into our skills folder
- Add `{baseDir}` placeholder support
- Reuse ClawdBot's bundled skills

## Recommendations

### Quick Wins

1. **Add `{baseDir}` support** - Simple string replacement in skill loading
2. **Import pi-skills** - Copy from `/opt/third/pi-skills` to our skills
3. **Import useful ClawdBot skills** - Weather, GitHub, coding-agent

### Medium-Term

4. **Add skill validation** - Name/description length checks
5. **Add skill discovery** - List available skills in UI
6. **Add skill commands** - `/skill:name` explicit invocation

### Long-Term

7. **Voice skills** - Requires speech-to-text integration
8. **Messaging skills** - WhatsApp/Telegram/Discord integration
9. **Memory skills** - Persistent context across sessions

## Technical Details

### pi-mono Package Structure

```
packages/
├── coding-agent/     # CLI and skill loading
├── agent/           # Core agent runtime
├── ai/              # Multi-provider LLM API
├── tui/             # Terminal UI
└── web-ui/          # Web components
```

### Key Functions

```typescript
// Load skills from directory
loadSkillsFromDir({ dir: string, source: string }): LoadSkillsResult

// Format for system prompt
formatSkillsForPrompt(skills: Skill[]): string

// Skill interface
interface Skill {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  source: string;
  disableModelInvocation: boolean;
}
```

## Sources

- [badlogic/pi-mono](https://github.com/badlogic/pi-mono) - Core library
- [badlogic/pi-skills](https://github.com/badlogic/pi-skills) - Skill collection
- [clawdbot/clawdbot](https://github.com/clawdbot/clawdbot) - ClawdBot repo
- [Agent Skills Spec](https://agentskills.io/specification) - Standard specification

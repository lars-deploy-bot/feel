# Diagrams

Sequence diagrams, flow charts, and architectural visualizations for the Claude Bridge platform.

## Available Diagrams

### Authentication & Security

- **[MCP Tool Authentication Flow](./mcp-tool-authentication-flow.md)** - Complete sequence diagram showing how session cookies are passed from browser through child process to MCP tool API calls. Includes root cause analysis of cookie name mismatch bug.

### OAuth Integration

- **[Linear OAuth Flow](./oauth/linear-oauth-flow.md)** - Complete OAuth2 flow for Linear integration including CSRF state management, token exchange, and automatic refresh. Shows all three phases: initial authorization, callback, and token refresh.

---

## Diagram Format

All diagrams use **Mermaid** syntax for easy rendering in GitHub, Markdown viewers, and documentation tools.

### Viewing Diagrams

- **GitHub**: Renders automatically in `.md` files
- **VS Code**: Install "Markdown Preview Mermaid Support" extension
- **CLI**: Use `mmdc` (mermaid-cli) to generate images

### Creating New Diagrams

When adding a new diagram:

1. Create a `.md` file in this directory
2. Use Mermaid syntax (```mermaid)
3. Include context and explanation around the diagram
4. Add reference to this README
5. Link from relevant documentation

### Example Structure

```markdown
# Diagram Title

**Context:** Why this diagram exists
**Date:** When it was created

## Overview

Brief explanation of what the diagram shows.

## Diagram

```mermaid
sequenceDiagram
    ...
```

## Explanation

Detailed walkthrough of the diagram.
```

---

## Common Diagram Types

### Sequence Diagrams
Show interactions between components over time. Use for:
- API request/response flows
- Authentication chains
- Multi-process communication

### Flowcharts
Show decision paths and logic flow. Use for:
- Deployment processes
- Error handling logic
- State transitions

### Architecture Diagrams
Show system structure and relationships. Use for:
- Component relationships
- Data flow
- Infrastructure layout

---

## Related Documentation

- [Architecture](../architecture/README.md) - System design patterns
- [Security](../security/README.md) - Security flows and patterns
- [Troubleshooting](../troubleshooting/README.md) - Problem analysis

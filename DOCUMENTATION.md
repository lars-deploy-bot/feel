# Documentation Index

Complete guide to Claude Bridge documentation. Start here to find what you need.

## Quick Links

| Role | Start Here |
|------|------------|
| **New Developer** | [README.md](./README.md) → [Local Setup](./docs/guides/local-development-setup.md) → [CLAUDE.md](./CLAUDE.md) |
| **Contributing** | [CLAUDE.md](./CLAUDE.md) → [Testing Guide](./docs/testing/README.md) |
| **DevOps** | [Deployment Guide](./docs/deployment/deployment.md) → [Infrastructure](../CLAUDE.md) |
| **Security Review** | [Workspace Enforcement](./docs/security/workspace-enforcement.md) → [Testing](./docs/testing/README.md) |

## Core Documentation

### Getting Started
- **[README.md](./README.md)** - Project overview, features, quick start
- **[CLAUDE.md](./CLAUDE.md)** - Developer guide for AI assistants working on the codebase
- **[Local Development Setup](./docs/guides/local-development-setup.md)** - Complete setup instructions

### Architecture
- **[Message Handling](./docs/architecture/message-handling.md)** - Tool tracking, message grouping, UI routing
- **[Preview Subdomains](./docs/architecture/preview-subdomains.md)** - Subdomain routing and workspace resolution
- **[Session Management](./docs/sessions/session-management.md)** - Backend session persistence
- **[Streaming](./docs/streaming/stream-implementation.md)** - SSE protocol and streaming architecture

### Security
- **[Workspace Enforcement](./docs/security/workspace-enforcement.md)** - Path validation, tool whitelisting, systemd isolation
- **[Authentication](./docs/security/authentication.md)** - JWT tokens, workspace permissions (if exists)

### Features
- **[Session Persistence](./docs/features/session-persistence.md)** - Frontend conversation persistence with Zustand

### Deployment
- **[Deployment Guide](./docs/deployment/deployment.md)** - Production deployment, atomic builds, rollback
- **[Deployment Environments](./docs/deployment/deployment-environments.md)** - Production vs staging setup
- **[Architecture](./docs/deployment/ARCHITECTURE.md)** - Build system internals
- **[Changelog](./docs/deployment/CHANGELOG.md)** - Deployment system history

### Testing
- **[Testing Overview](./docs/testing/README.md)** - Test strategy, quick commands
- **[Unit Testing](./docs/testing/UNIT_TESTING.md)** - Vitest setup and examples
- **[Integration Testing](./docs/testing/INTEGRATION_TESTING.md)** - Testing components together
- **[E2E Testing](./docs/testing/E2E_TESTING.md)** - Playwright end-to-end tests
- **[Failure Modes](./docs/testing/TESTING_FAILURE_MODES.md)** - Known test issues and solutions

### Guides
- **[Local Development Setup](./docs/guides/local-development-setup.md)** - Environment setup
- **[Workspace Permission Setup](./docs/guides/workspace-permission-setup.md)** - Systemd site deployment
- **[Removing a Site](./docs/guides/removing-site.md)** - Clean site removal
- **[DNS Validation Design](./docs/guides/dns-validation-design.md)** - DNS verification system
- **[Hetzner Images Setup](./docs/guides/hetzner-images-setup.md)** - Image service configuration
- **[Zustand Next.js SSR Patterns](./docs/guides/zustand-nextjs-ssr-patterns.md)** - State management best practices

### Error Management
- **[Error Management Overview](./docs/error-management/README.md)** - Error handling strategy
- **[User vs Backend Messages](./docs/error-management/USER-VS-BACKEND-MESSAGES.md)** - Message formatting
- **[Actionable Messages](./docs/error-management/ACTIONABLE-MESSAGES.md)** - User-facing errors
- **[Consistent Error Messages](./docs/error-management/CONSISTENT-ERROR-MESSAGES.md)** - Error standardization

### Implementation Plans
- **[Claude Fixture System](./docs/implementation-plans/claude-fixture-system.md)** - Test fixture architecture
- **[Claude Fixture System Robust](./docs/implementation-plans/claude-fixture-system-robust.md)** - Enhanced fixtures

### Stores (State Management)
- Documentation for Zustand stores following project patterns (§14.1-14.3)

## Infrastructure Documentation

### WebAlive Infrastructure
- **[Infrastructure Overview](../CLAUDE.md)** - Sites, systemd, Caddy configuration
- **[Deployment Script](../scripts/deploy-site-systemd.sh)** - Automated site deployment

## Implementation Status
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Session persistence completion
- **[Lint Fixes Summary](./LINT_FIXES_SUMMARY.md)** - Code quality improvements
- **[Session Persistence Verification](./VERIFY_SESSION_PERSISTENCE.md)** - Manual testing guide

## By Topic

### 🔒 Security
1. [Workspace Enforcement](./docs/security/workspace-enforcement.md) - Path validation, tool whitelisting
2. [Testing Security Functions](./docs/testing/README.md#what-to-test-mvp-priorities) - 100% coverage requirement
3. [Systemd Isolation](./docs/guides/workspace-permission-setup.md) - Process isolation

### 🚀 Deployment
1. [Production Deployment](./docs/deployment/deployment.md) - Full deploy process
2. [Atomic Builds](./docs/deployment/ARCHITECTURE.md) - Build system design
3. [Site Deployment](./docs/guides/workspace-permission-setup.md) - Deploy new sites
4. [Removing Sites](./docs/guides/removing-site.md) - Cleanup process

### 🧪 Testing
1. [Testing Strategy](./docs/testing/README.md) - What to test, when to test
2. [Unit Tests](./docs/testing/UNIT_TESTING.md) - Security-critical functions
3. [E2E Tests](./docs/testing/E2E_TESTING.md) - User flows
4. [Failure Modes](./docs/testing/TESTING_FAILURE_MODES.md) - Troubleshooting

### 💬 Messaging & Streaming
1. [Message Handling](./docs/architecture/message-handling.md) - Tool tracking, grouping
2. [Streaming](./docs/streaming/stream-implementation.md) - SSE protocol
3. [Session Management](./docs/sessions/session-management.md) - Backend sessions
4. [Session Persistence](./docs/features/session-persistence.md) - Frontend persistence

### 🏗️ Architecture
1. [Multi-tenant Design](./README.md#architecture) - Workspace isolation
2. [Streaming & SSE](./README.md#enhanced-architecture-features) - Real-time updates
3. [Tool Tracking](./docs/architecture/message-handling.md) - SDK message handling
4. [Message Grouping](./docs/architecture/message-handling.md) - UI rendering

### 🎨 State Management
1. [Zustand Patterns](./docs/guides/zustand-nextjs-ssr-patterns.md) - Best practices
2. [Session Store](./lib/stores/sessionStore.ts) - Conversation persistence
3. [Store Guidelines](./CLAUDE.md#state-management-zustand) - Implementation rules

## Common Tasks

### Starting Development
```bash
# 1. Install and setup
bun install
bun run setup

# 2. Add .env.local (see setup output)

# 3. Start dev server
bun run dev

# 4. Login with test credentials
# workspace: test, passcode: test
```

See: [Local Development Setup](./docs/guides/local-development-setup.md)

### Running Tests
```bash
# Unit tests
cd apps/web && bun test

# E2E tests
bun run test:e2e

# Coverage
bun test --coverage
```

See: [Testing Guide](./docs/testing/README.md)

### Deploying to Production
```bash
# Full deploy
bun run deploy

# Logs
bun run see

# Rollback
cd .builds && ln -sfn dist.TIMESTAMP current && cd .. && pm2 restart claude-bridge
```

See: [Deployment Guide](./docs/deployment/deployment.md)

### Deploying a New Site
```bash
# One command
bun run deploy-site newsite.com

# Manual steps in guide
```

See: [Workspace Permission Setup](./docs/guides/workspace-permission-setup.md)

### Adding a New Feature
1. Read [CLAUDE.md](./CLAUDE.md) for patterns
2. Check [Architecture docs](./docs/architecture/) for similar features
3. Write tests (see [Testing Guide](./docs/testing/README.md))
4. Follow [State Management patterns](./docs/guides/zustand-nextjs-ssr-patterns.md) if using Zustand
5. Update relevant documentation
6. Run `bun run format && bun run lint`

## Documentation Standards

### File Organization
- Core docs in root: `README.md`, `CLAUDE.md`, `DOCUMENTATION.md` (this file)
- Categorized docs in `docs/`: Architecture, deployment, testing, guides, etc.
- Implementation summaries in root: `IMPLEMENTATION_SUMMARY.md`, etc.

### Link Format
- Use relative links: `[Text](./path/to/file.md)`
- Link to specific sections: `[Text](./file.md#section)`
- Always verify links work after updates

### Code Examples
- Use TypeScript for examples
- Include context (file paths, imports)
- Show both correct and incorrect patterns
- Add comments for clarity

### Update Process
1. Make code changes
2. Update relevant docs
3. Update this index if adding new docs
4. Verify all links work
5. Update `IMPLEMENTATION_SUMMARY.md` if completing a feature

## Getting Help

### Can't Find Documentation?
1. Check this index (you're here!)
2. Search codebase: `grep -r "keyword" docs/`
3. Ask in the main [README.md](./README.md) or [CLAUDE.md](./CLAUDE.md)

### Documentation Issues?
1. Check if it's outdated (compare with code)
2. Fix it and update this index
3. Add missing docs following patterns above

### Need More Detail?
- Architecture questions → Check `docs/architecture/`
- Security questions → Check `docs/security/`
- Deployment questions → Check `docs/deployment/`
- Testing questions → Check `docs/testing/`
- Implementation examples → Check `docs/guides/`

## Contributing to Documentation

### Adding New Documentation
1. Choose appropriate directory in `docs/`
2. Follow existing naming conventions
3. Update this index with link
4. Add cross-references to related docs
5. Include code examples where relevant

### Updating Existing Documentation
1. Make changes
2. Update "Last updated" date if present
3. Update related documentation
4. Verify links still work
5. Update this index if structure changed

### Documentation Review Checklist
- [ ] Accurate (matches current code)
- [ ] Complete (covers edge cases)
- [ ] Clear (examples included)
- [ ] Links work
- [ ] Added to this index
- [ ] Cross-referenced from related docs

---

**Last Updated**: 2025-11-07
**Maintainer**: Claude Bridge Team

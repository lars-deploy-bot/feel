# Claude Bridge Documentation

**Intelligent, concise technical documentation for the Claude Bridge platform.**

## Quick Navigation

| Document | Purpose |
|----------|---------|
| [Getting Started](./GETTING_STARTED.md) | Installation, local development setup, first steps |
| [Architecture](./architecture/README.md) | System design, patterns, core concepts |
| [Security](./security/README.md) | Authentication, workspace isolation, security patterns |
| [Features](./features/README.md) | Feature documentation and implementation guides |
| [Testing](./testing/README.md) | Unit, integration, E2E testing approaches |
| [Troubleshooting](./troubleshooting/README.md) | Common issues, solutions, postmortems |
| [Deployment](./deployment/README.md) | Environment management and deployment (devops) |

## Reference Documentation

| Topic | Description |
|-------|-------------|
| [Database](./database/) | Supabase setup, RLS, ES256 migration |
| [Integrations](./integrations/) | External service integrations |
| [Streaming](./streaming/) | SSE implementation details |

## Active Work

| Topic | Description |
|-------|-------------|
| [Open Problems](./open-problems/) | Active issues and investigations |
| [Currently Working On](./currently-working-on-this/) | Work in progress |

## Documentation Principles

1. **Intelligence**: Assumes technical competence, no hand-holding
2. **Conciseness**: Information density over verbosity
3. **Consolidation**: Related topics merged, duplication eliminated
4. **Clarity**: Clear structure, scannable headings, code examples

## For AI Assistants

- **Primary guide**: `/CLAUDE.md` in project root
- **Testing**: Always check [testing/README.md](./testing/README.md) before writing tests
- **Security**: Review [security/README.md](./security/README.md) before file operations or auth changes
- **Patterns**: Follow existing patterns in [architecture/README.md](./architecture/README.md)

## Archive

Historical documentation, implementation notes, and resolved issues are preserved in `/docs/archive/` for reference.

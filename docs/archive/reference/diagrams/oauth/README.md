# OAuth Diagrams

Visual documentation for OAuth integration flows in Claude Bridge.

## Available Diagrams

### [Linear OAuth Flow](./linear-oauth-flow.md)

Comprehensive sequence diagrams showing the complete Linear OAuth integration:
- Initial authorization flow (CSRF state management)
- OAuth callback flow (token exchange)
- Automatic token refresh (expiry handling)

**Use when**: Understanding how Linear OAuth works, debugging OAuth issues, or implementing new OAuth providers.

## Diagram Format

All diagrams use [Mermaid](https://mermaid.js.org/) syntax for version control compatibility and GitHub rendering.

## Adding New Diagrams

When adding new OAuth provider diagrams:

1. Create `[provider]-oauth-flow.md` in this directory
2. Include all three phases: initial flow, callback, refresh
3. Document security measures (CSRF, encryption, token rotation)
4. Link to implementation files
5. Add entry to this README

## Related Documentation

- [OAuth Core Package](../../../packages/oauth-core/README.md)
- [Features: OAuth Integration](../../features/oauth-integration.md)
- [Architecture: Multi-Tenant OAuth](../../architecture/multi-tenant-oauth.md)

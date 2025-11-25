# Open Problems

This directory tracks critical bugs and issues that are **currently blocking functionality** or require immediate attention.

## What Goes Here

- **Critical bugs** that prevent core features from working
- **Blocker issues** that affect multiple users or deployments
- **Root cause analyses** with complete debugging context
- **Proposed fixes** with implementation details

## What Does NOT Go Here

- Feature requests (use GitHub issues)
- Minor bugs (use GitHub issues)
- Resolved problems (move to `/docs/postmortems/` or `/docs/fixes/`)
- Historical issues (move to `/docs/archive/`)

## Document Structure

Each problem document should include:

1. **Problem Statement** - Clear description of the issue
2. **Root Causes** - Technical analysis of why it's happening
3. **Evidence** - Logs, commands, outputs proving the diagnosis
4. **Complete Flow** - Step-by-step data flow showing where it breaks
5. **Proposed Fixes** - Concrete code changes with file locations
6. **Implementation Plan** - Phased rollout strategy
7. **Testing Checklist** - How to verify the fix works

## Lifecycle

```
GitHub Issue → Open Problem (this dir) → Fix Applied → Postmortem (moved to /docs/postmortems/)
```

## Current Open Problems

- [deployment-port-collision.md](./deployment-port-collision.md) - Port assignment fails due to systemd environment pollution
- [oauth-core-architectural-issues.md](./oauth-core-architectural-issues.md) - Critical architectural debt in OAuth core package requiring major refactoring

## Moving to Postmortem

Once a problem is fixed and validated:

1. Update status in the document to ✅ RESOLVED
2. Add "Resolution Date" and "Resolution Summary"
3. Move to `/docs/postmortems/YYYY-MM-DD-{problem-name}.md`
4. Update this README to remove from "Current Open Problems"

# Currently Working On

**Purpose**: Living documentation for active development tasks.

This directory contains work-in-progress documentation for features currently being developed. When working on a multi-step task:

## Usage Guidelines

1. **Check here first** when starting work - see if there's existing context/plans
2. **Create/update docs here** as you work (design docs, implementation plans, checklists)
3. **Update throughout the session** - don't wait until the task is complete
4. **When task is complete**, move finalized docs to their permanent location

## Directory States

### Empty (Current)
No active development tasks. All recent work has been completed and moved to permanent locations.

### In Use
When active work is happening, you'll find files like:
- Design documents (architecture decisions, system design)
- Implementation status (what's done, what's pending)
- Testing checklists (pre-production verification)
- Client integration guides (step-by-step instructions)

## Recent Completed Work

**Stream Cancellation Architecture** (Completed 2025-01-10)
- Moved to: `docs/streaming/`
- Files:
  - `cancellation-architecture.md` - Full design and architecture
  - `stream-handler-audit-2025-01-10.md` - Code audit findings
  - `cleanup-summary-2025-01-10.md` - Cleanup actions taken

## Why This Directory Exists

**Prevents context loss**: Documentation survives between sessions
**Enables task switching**: Easy to pause and resume work
**Creates handoff docs**: Clear status for team members or future sessions
**Living record**: Documentation evolves with the implementation

## Example Workflow

```bash
# Starting new feature: "Add workspace permissions system"
1. Create: docs/currently-working-on-this/workspace-permissions-design.md
2. Create: docs/currently-working-on-this/implementation-checklist.md
3. Update as you work
4. When complete:
   - Move design doc to: docs/security/workspace-permissions.md
   - Delete checklist (no longer needed)
   - Update this README with "Recent Completed Work"
```

## Notes

- This is a **temporary workspace**, not a permanent archive
- Keep it clean - remove outdated docs when work is complete
- If uncertain whether to keep something, move it to permanent location
- Always update this README when completing major work

# Archive

Historical documentation, completed work, and open investigations.

**Size**: 1.4M | **Files**: ~80 documents organized by stage

## Sections

### [active/](./active/)
**Open blockers and planned work** - Current investigations, PRs in progress, unresolved problems

- `open-problems/` - Known issues being investigated
- `prs/` - Planned features and implementation guides
- `work-in-progress-2024-12/` - Active work items

### [completed/](./completed/)
**Finished work** - Migrations, features that shipped, resolved refactoring

- Implementation plans that executed
- Bug fixes with resolutions
- Completed features

### [outdated/](./outdated/)
**Historical postmortems and reports** - Lessons learned, but resolved

- `postmortems/` - Past incidents with resolutions
- Reports and old analysis

### [reference/](./reference/)
**Technical deep-dives** - Useful for understanding patterns, but not actively changing

- `diagrams/` - Sequence diagrams, flow charts
- `streaming/` - SSE implementation patterns
- `error-management/` - Error handling architecture
- `sessions/` - Session management details

### [legacy/](./legacy/)
**Pre-current-architecture** - Historical context, don't reference for new work

- Old documentation from before major refactoring

## How to Use Archive

**Search across archive:**
```bash
grep -r "your-topic" archive/
```

**Find a specific feature:**
```bash
find archive/ -name "*feature-name*"
```

**Check if something's resolved:**
```bash
ls archive/outdated/postmortems/ | grep "2025-"
```

---

**Tip**: If docs are missing from main, check archive first before assuming they're lost.

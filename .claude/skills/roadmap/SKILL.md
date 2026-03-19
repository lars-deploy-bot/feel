---
name: roadmap
description: Manage GitHub issues, milestones, and the Alive Roadmap project board. View project state, create/update issues, assign milestones and labels.
---

# Roadmap & Issues

Manage the Alive project roadmap, issues, and milestones via the GitHub CLI.

## Project Details

- **Repo**: `lars-deploy-bot/feel`
- **Project board**: #1 "Alive Roadmap" (owner: `lars-deploy-bot`)
- **Project ID**: `PVT_kwHOAgKQf84BOvXp`

## Milestones

| Milestone | Number | Focus |
|-----------|--------|-------|
| v0.1 — Solid ground | 4 | Foundation quality and reliability |
| v0.2 — 10 users | 5 | Early user validation and instrumentation |
| v0.3 — Double down | 6 | Scale what works from early usage |
| v0.4 — 50 users | 7 | Growth stage execution |
| Cleanup & DevEx | 3 | Naming, config consolidation, tech debt |

## Custom Project Fields

| Field | Type | Options |
|-------|------|---------|
| Priority | Single select | P0 - Critical, P1 - High, P2 - Medium, P3 - Low |
| Category | Single select | Infrastructure, UX, AI/Agent, Database, Security, Frontend, DevEx |
| Effort | Single select | Small (< 1 day), Medium (1-3 days), Large (3+ days) |
| Execution Lane | Single select | Today, Epic, Later |

## Label Policy (Strict)

Use labels only for stable taxonomy/state. Use project fields for planning metadata.

### Preflight (source of truth)
Before adding any label, query the live repo labels:

```bash
gh label list --repo lars-deploy-bot/feel --limit 500
```

Do not assume static label sets from docs. The live repo is authoritative.

### Default behavior
- Prefer **no labels** unless a label adds clear taxonomy value.
- Use project fields (`Priority`, `Category`, `Effort`, `Execution Lane`) for planning metadata.
- Use `epic` only for parent epic issues.

### Deprecated labels (do not add)
- `priority/*` (use Project `Priority` field)
- `lane/*` (use Project `Execution Lane` field)
- `dx` (use Project `Category=DevEx`)
- `git`, `worktrees`
- `help wanted`
- `feat/*`
- Generic/noise labels that are not active taxonomy

If a deprecated label is encountered:
1. Remove it from the issue.
2. Map intent to project fields where applicable.
3. Do not recreate deleted label definitions.

## Epic Workflow (Mandatory)

When creating an epic:
1. Create one parent issue with label `epic`.
2. Add a child issue checklist in the epic body.
3. Add parent + children to Project #1.
4. Set project field `Execution Lane=Epic` on parent.
5. Set `Priority`, `Category`, and `Effort` via project fields.
6. Child issues should not carry `epic` unless they are also parent epics.

## Common Operations

### View project state
```bash
# List all open issues
gh issue list --repo lars-deploy-bot/feel --state open --limit 50

# List issues by milestone
gh issue list --repo lars-deploy-bot/feel --milestone "Cleanup & DevEx"

# List project items with fields
gh project item-list 1 --owner lars-deploy-bot --format json

# View milestones
gh api repos/lars-deploy-bot/feel/milestones --jq '.[] | "\(.title): \(.open_issues) open, \(.closed_issues) closed"'
```

### Create an issue
```bash
gh issue create --repo lars-deploy-bot/feel \
  --title "Short descriptive title" \
  --body "$(cat <<'EOF'
## Summary
What and why.

## Details
- Bullet points
- With context

## Acceptance Criteria
- [ ] Thing works
EOF
)" \
  --milestone "Cleanup & DevEx"
```

### Update an issue
```bash
# Add to milestone
gh issue edit <number> --repo lars-deploy-bot/feel --milestone "Cleanup & DevEx"

# Add labels
gh issue edit <number> --repo lars-deploy-bot/feel --add-label "security"

# Close with comment
gh issue close <number> --repo lars-deploy-bot/feel --comment "Fixed in <commit>"
```

### Add issue to project board
```bash
gh project item-add 1 --owner lars-deploy-bot --url "https://github.com/lars-deploy-bot/feel/issues/<number>"
```

### Set project field on an item
```bash
# Get item ID first
gh project item-list 1 --owner lars-deploy-bot --format json | jq '.items[] | select(.content.number == <issue_number>) | .id'

# Set priority (need field ID: PVTSSF_lAHOAgKQf84BOvXpzg9Wk4U)
gh project item-edit --project-id PVT_kwHOAgKQf84BOvXp --id <item_id> --field-id PVTSSF_lAHOAgKQf84BOvXpzg9Wk4U --single-select-option-id <option_id>

# Set execution lane Epic (field ID: PVTSSF_lAHOAgKQf84BOvXpzg-HQn8, option: a7403925)
gh project item-edit --project-id PVT_kwHOAgKQf84BOvXp --id <item_id> --field-id PVTSSF_lAHOAgKQf84BOvXpzg-HQn8 --single-select-option-id a7403925
```

### Field IDs (for programmatic updates)

| Field | Field ID |
|-------|----------|
| Status | PVTSSF_lAHOAgKQf84BOvXpzg9Wkpg |
| Priority | PVTSSF_lAHOAgKQf84BOvXpzg9Wk4U |
| Category | PVTSSF_lAHOAgKQf84BOvXpzg9Wk6U |
| Effort | PVTSSF_lAHOAgKQf84BOvXpzg9Wk8A |
| Execution Lane | PVTSSF_lAHOAgKQf84BOvXpzg-HQn8 |

### Single-select option IDs

- Priority:
  - `P0 - Critical`: `19392ad7`
  - `P1 - High`: `274251ee`
  - `P2 - Medium`: `788be6b6`
  - `P3 - Low`: `3bd80130`
- Category:
  - `Infrastructure`: `81c9a767`
  - `UX`: `21316b9a`
  - `AI/Agent`: `5252d7b7`
  - `Database`: `6e748752`
  - `Security`: `1be7c75f`
  - `Frontend`: `4ebd4c86`
  - `DevEx`: `21679ecc`
- Effort:
  - `Small (< 1 day)`: `76d89b7c`
  - `Medium (1-3 days)`: `aca0a9a3`
  - `Large (3+ days)`: `36e8d3e4`
- Execution Lane:
  - `Today`: `1f7154ed`
  - `Epic`: `a7403925`
  - `Later`: `a7e4833a`

## Guidelines

- **Issue titles**: Short, imperative ("Add X", "Fix Y", not "Adding X" or "X is broken")
- **Always assign a milestone** when creating issues
- **Add to the project board** after creating
- **Use project fields for planning metadata** (`Priority`, `Category`, `Effort`, `Execution Lane`)
- **Use `epic` label only on parent epics**, never as a generic lane marker
- **Never add deprecated labels** listed above
- **Link PRs to issues**: Use "Fixes #N" in PR descriptions
- **Close stale issues** rather than letting them pile up
- When asked about project state, give a concise summary grouped by milestone

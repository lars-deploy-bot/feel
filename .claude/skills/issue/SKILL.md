---
name: issue
description: Create a well-structured GitHub issue with observed data, no assumptions. Research-quality bug reports and feature requests.
---

# Creating Issues

Write issues like a researcher: report what you observed, not what you think caused it.

## Principles

1. **No bias** — Don't conclude the cause. Present data and let the reader decide.
2. **Evidence first** — Every claim needs a query, log line, or screenshot backing it.
3. **Reproducible** — Include the exact commands/queries you ran so someone can verify.
4. **Anonymized** — Never include email addresses, display names, or anything personally identifiable. Use `org_id`, `user_id`, and `domain_id` only. Redact IPs.
5. **Measurable acceptance** — "Done" must be verifiable with a query or command. No vague criteria.
6. **Sentry first** — Validation must require Sentry capture coverage on changed server error paths.
7. **E2E required** — Validation must require end-to-end test evidence (no mocked backend internals).
8. **No duplication** — Validation must require explicit DRY proof (shared helper reuse, no copy-pasted branch logic).

## Structure

```markdown
## Observation

One sentence: what you noticed.

## Scope

What this issue is about — and what it is NOT about.
One issue = one observation. If you found two things, make two issues.

## Impact

How many orgs/users/domains are affected? Quantify with a query.

## Timeline

- **First seen**: [date + how you determined it]
- **Last known working**: [date, or "unknown"]

## Data

### [Source 1: e.g. Production logs]

How you gathered it:
```bash
# exact command you ran
```

What it showed:
```
# relevant output, trimmed to what matters
```

### [Source 2: e.g. Database query]

```sql
-- exact query
```

| col1 | col2 | col3 |
|------|------|------|
| data | data | data |

### [Source 3: e.g. HTTP checks, systemd status]

```bash
# exact command
```

## Additional observations

Anything else you noticed while investigating that may or may not be related.
Don't speculate — just state what you saw.

## Structural code smells (if any)

If the bug reveals deeper structural issues, document them here.
These are patterns that make the bug likely to exist and hard to fix in isolation.
Each smell: name, location (file:line), what it means, why it matters.
Don't propose fixes — just document what you see.
Skip this section if the bug is straightforward.

Categories to look for:
- State consistency gaps: two pieces of state that must agree but nothing enforces it
- Race conditions by design: independent async flows touching the same state without coordination
- Test blind spots: test infrastructure that systematically skips the failing code path
- Missing data in calls: a function requires context that callers don't have
- Implicit ordering: code that only works if unrelated code runs first
- Multiple uncoordinated writers: N call sites mutating the same state with different invariants
- Silent degradation: errors/mismatches that produce blank UI instead of feedback

## Acceptance criteria

Each criterion must be verifiable by running a specific command or query.

- [ ] `journalctl -u alive-production | grep "Charged" | grep "haiku" | grep -v "Charged 0 "` returns results
- [ ] `SELECT credits FROM iam.orgs WHERE org_id = 'org_xxx'` shows a value lower than starting balance after usage

## Validation gates (strict)

Add this section to every issue body (epics and child issues):

- [ ] **E2E required (no mocks)**: add/update end-to-end coverage for the behavior. Include command output in PR notes.
  ```bash
  bun run e2e --grep "<feature-or-route-pattern>"
  ```
- [ ] **Sentry-first error telemetry**: changed server-side failure paths must capture errors via `Sentry.captureException` or `Sentry.captureMessage` with request context (`requestId`, `workspace`, `domain_id` when available).
  ```bash
  bun run --cwd apps/web scripts/check-error-patterns.ts
  git diff --name-only origin/main...HEAD -- apps/web packages/worker-pool apps/e2b-terminal \
    | xargs -r rg -n 'Sentry\.(captureException|captureMessage)|captureException\('
  ```
  Both commands must pass and be included in PR evidence.
- [ ] **Zero duplication (DRY gate)**: repeated logic across touched handlers/services must be extracted into shared helpers and reused at call sites. Include helper-to-callsites mapping in PR notes.
```

## Size

An issue should be **one clear thing someone can investigate and fix**. Not a project, not a typo.

- Too big → split into an epic with child issues (use `/roadmap` epic workflow)
- Too small → doesn't need an issue, just fix it
- Right size → one person can understand it, investigate it, and verify the fix

**Too big:** "Billing system has problems" (multiple observations bundled)
**Too small:** "Change variable name in line 42"
**Right size:** "Haiku model streams log 0 credits charged across all orgs"

## Rules

- **DO** include exact queries, commands, and log lines
- **DO** include timestamps and IDs so someone can reproduce
- **DO** separate observations from each other — they might have different causes
- **DO** include a `## Validation gates (strict)` section in every issue
- **DO** include `## Structural code smells` when the bug reveals deeper patterns (races, state gaps, test blind spots, silent degradation, uncoordinated writers)
- **DO** require Sentry evidence, E2E evidence, and DRY evidence in acceptance criteria
- **DON'T** write "the bug is X" or "this causes Y" — write "X was observed"
- **DON'T** include email addresses, display names, or IPs — use `org_id` / `user_id` / `domain_id` only
- **DON'T** mix the issue with a fix proposal — that's a separate conversation
- **DON'T** editorialize with words like "critical", "broken", "must fix" — let the data speak
- **DON'T** write vague acceptance criteria like "billing works" — write a query that proves it
- **DON'T** bundle multiple observations into one issue — split them
- **DON'T** write "some users" or "several orgs" — count them
- **DON'T** approve issue closure without E2E + Sentry + DRY gates checked

## Command

```bash
GIT_SSH_COMMAND="ssh -i /root/.ssh/id_lars_deploy_bot -o IdentitiesOnly=yes" \
gh issue create \
  --repo eenlars/alive \
  --title "Observation: short factual title" \
  --body "$(cat <<'EOF'
## Observation

...

## Data

...

## Validation gates (strict)

- [ ] E2E required (no mocks) with command output attached in PR
- [ ] Sentry-first error telemetry evidence attached in PR
- [ ] Zero duplication (DRY) helper-to-callsites evidence attached in PR
EOF
)"
```

After creating, use `/roadmap` to assign milestone, project board, and fields.

## Anti-patterns

**Bad title:** "Credits billing is broken for Haiku"
**Good title:** "Haiku model streams log 0 credits charged across all orgs"

**Bad body:** "The billing system doesn't charge Haiku users. This needs to be fixed urgently."
**Good body:** "Production logs show 1,425 Haiku charge events, all logging `Charged 0 credits`. Opus shows 1,733 events with charges >0. Queried via: `journalctl -u alive-production | grep 'Charged' | ...`"

---
name: conductor
description: Triage GitHub issues, pick parallel non-overlapping issues for worktrees, generate strict agent prompts, review PRs critically, merge ready PRs, and sync issue states. Use when user asks "what next", "pick issues", "parallel worktrees", "conductor", "review PRs", or "sync issues".
---

# Issue Conductor

Run a strict issue-to-PR pipeline with parallel worktrees and tight scope control.

## Guardrails

- Treat live GitHub state as source of truth.
- Assume issue descriptions can be stale; re-verify against current code and PR history.
- Default to non-scraper issues unless the user explicitly asks for scraper work.
- Prefer one issue per PR.
- Do not bundle cleanup/refactors unless explicitly in issue scope.

## Step 1: Reconcile Current State

1. List open PRs and open issues. only do this for the milestones that are not too far away, so first list the milestones and then only do this for the milestones that are not too far away:

```bash
gh milestone list --repo lars-deploy-bot/feel --state open --limit 50
```

then for each milestone, list the open PRs and open issues:

```bash
gh pr list --state open --limit 50 --milestone <MILESTONE_TITLE>
gh issue list --state open --limit 100 --milestone <MILESTONE_TITLE>
```

2. If open PRs exist, review them first before starting new work.
3. For candidate issues, open details and verify what is still unresolved:

```bash
gh issue view <ISSUE_NUMBER>
```

4. Cross-check recently merged PRs to avoid duplicate work:

```bash
gh pr list --state merged --limit 30
```

## Step 2: Select Parallel-Safe Issues

Pick 2-4 issues that can run in parallel with minimal overlap.

Selection rules:

- Priority first (`P1` before `P2`).
- Exclude scraper issues by default.
- Exclude issues that are already fully addressed by merged PRs.
- Avoid pairing issues that touch the same critical files/modules.
- Keep each worktree focused on one issue only.

Output a short batching table for the user:

- issue number + title
- why now
- expected files/area
- risk of overlap

## Step 3: Create Worktree Plan

For each selected issue, define:

- branch name: `lars-deploy-bot/<issue-id>-<slug>`
- single-sentence objective
- strict out-of-scope list


## Step 4: Generate Strict Agent Prompts

Output one focused prompt per issue, using this template PER ISSUE (so this is the literal output per issue, no changes to the below text)

```text
You are in a dedicated git worktree. Execute exactly one issue: #<ISSUE_ID> - <ISSUE_TITLE>.

Hard scope rules:
- Do only this issue end-to-end.
- No dependency changes unless strictly required.

Execution rules:
1) Read the issue and inspect relevant code paths first.
2) Implement the minimal correct fix.
3) Add/update tests that fail before and pass after (issue-focused).
4) Run validation with bun:
   - bun run lint
   - bun run typecheck
   - relevant test command(s)
5) start by opening a draft PR with:
   - concise issue-focused title
   - body including: "Fixes #<ISSUE_ID>", root cause, changes made, exact test commands + results, and remaining risks.

your task is to inspect the issue, improve the issue description if not clear enough, and then open a draft PR for the issue.

watch out: first research how the codebase works for this issue, and the patterns.
if the issue relates to a bug, first research the root cause of the bug.
it may help to isolate the issue in case of a bug, by creating a minimal reproduction.
```
---
name: automations
description: Manage automation jobs — list, inspect, update, trigger, and debug. Query Supabase app.automation_jobs table.
---

# /automations

Manage automation jobs stored in Supabase `app.automation_jobs`.

## Database Access

Use the `/sql` skill for all database queries. It handles connection strings, env loading, and safety.

```bash
# List all automations
bash scripts/database/sql.sh --target production -c "
  SELECT id, name, is_active, status, last_run_status, cron_schedule, next_run_at
  FROM app.automation_jobs ORDER BY name
"

# Get full details of one job
bash scripts/database/sql.sh --target production -c "
  SELECT * FROM app.automation_jobs WHERE id = 'auto_job_xxx'
"

# Update a cron schedule (recalculates next_run_at — see Scheduling section)
bash scripts/database/sql.sh --target production -c "
  UPDATE app.automation_jobs
  SET cron_schedule = '*/20 * * * *',
      next_run_at = '2026-03-06T16:00:00+00:00'
  WHERE id = 'auto_job_xxx'
  RETURNING name, cron_schedule, next_run_at
"
```

## Worker HTTP API

The automation worker runs on port 5070. Auth uses `JWT_SECRET`:

```bash
JWT_SECRET=$(grep "^JWT_SECRET=" /root/webalive/alive/apps/web/.env.production | sed 's/^JWT_SECRET=//')
```

**CRITICAL: Env values with special characters.** Many secrets contain `=`, `+`, `/`. Never use `cut -d= -f2` — it truncates at the first `=`. Always use `sed 's/^KEY=//'`.

### Health check
```bash
curl -s http://localhost:5070/health
# Returns: {"ok":true,"started":true,"triggeredJobs":1,...}
# triggeredJobs > 0 means a job is currently executing
```

### Trigger a job manually
```bash
curl -s -X POST "http://localhost:5070/trigger/${JOB_ID}" \
  -H "X-Internal-Secret: ${JWT_SECRET}"
```

**The `/trigger` endpoint is SYNCHRONOUS** — it blocks until the job completes (can take minutes). Use `-m 600` timeout or run in background. If a job is already running, returns `{"success":false,"error":"AUTOMATION_ALREADY_RUNNING"}`.

### Poke the worker (re-arm scheduler)
```bash
curl -s -X POST http://localhost:5070/poke -H "X-Internal-Secret: ${JWT_SECRET}"
```

### View recent run logs
```bash
journalctl -u automation-worker -n 100 --no-pager | grep "${JOB_ID}"
```

## Table Schema (key columns)

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Job ID (e.g. `auto_job_xxx`) |
| `name` | text | Human-readable name |
| `site_id` | text | Domain/site this job belongs to |
| `trigger_type` | text | `cron`, `email`, or `webhook` |
| `cron_schedule` | text | Cron expression (if cron trigger) |
| `action_type` | text | `prompt` (Claude runs the prompt) |
| `action_prompt` | text | The full prompt Claude executes |
| `action_model` | text | Model override (null = default) |
| `is_active` | bool | Whether the job runs |
| `status` | text | `idle`, `running`, `paused` |
| `last_run_at` | timestamptz | Last execution time |
| `last_run_status` | text | `success`, `error`, `timeout` |
| `last_run_error` | text | Error message if failed |
| `next_run_at` | timestamptz | Next scheduled run |
| `email_address` | text | Email trigger address (if email trigger) |
| `consecutive_failures` | int | Failure count (resets on success) |

## Scheduling: How `next_run_at` Works

**The worker wakes based on `next_run_at`, NOT by parsing `cron_schedule` each tick.**

1. When a job completes, the worker calculates the next fire time from `cron_schedule` and writes it to `next_run_at`
2. The worker sleeps until the earliest `next_run_at` across all active jobs

**The app PATCH API (`/api/automations/[id]`) handles this correctly** — it recomputes `next_run_at` when `cron_schedule` changes and pokes the worker. Use the API when possible.

**But if you update `cron_schedule` directly via SQL (bypassing the app API), you MUST also update `next_run_at`:**

```bash
bash scripts/database/sql.sh --target production -c "
  UPDATE app.automation_jobs
  SET cron_schedule = '*/20 * * * *',
      next_run_at = '$(date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:00+00:00)'
  WHERE id = 'auto_job_xxx'
  RETURNING name, cron_schedule, next_run_at
"

# Then poke the worker
curl -s -X POST http://localhost:5070/poke -H "X-Internal-Secret: ${JWT_SECRET}"
```

**For running jobs** (`status: "running"`): Don't update `next_run_at` — the worker will set it correctly when the job completes.

## Staggering Multiple Jobs

When multiple jobs share a site, stagger them to avoid concurrent execution (the worker runs one job at a time):

```
# 9 jobs, 4 min apart, hourly cycle (36 min active, 24 min quiet):
Job 1: "0 * * * *"     -> :00
Job 2: "4 * * * *"     -> :04
Job 3: "8 * * * *"     -> :08
...
Job 9: "32 * * * *"    -> :32
```

**Stagger rules:**
- Gap should be >= typical job duration (most jobs take 2-5 min)
- For N jobs with gap G: total cycle = N * G minutes. Must fit in the cron period.
- Use fixed minute offsets (`4 * * * *`) for hourly — simpler to reason about
- If jobs run longer than the gap, the next job just waits

## Tips

- Always show a summary table when listing automations
- When updating prompts, show the diff of what changed
- To disable: set `is_active` to `false`
- To re-enable: set `is_active` to `true`, update `next_run_at` to a near-future time, and poke the worker
- The worker only runs ONE job at a time. Jobs queue behind each other. Plan schedules accordingly.
- If a job is stuck in `status: "running"` but `/health` shows `triggeredJobs: 0`, the job crashed without cleanup. Manually update `status` to `'idle'` and set a new `next_run_at`.
- When triggering many jobs sequentially, don't use the synchronous `/trigger` endpoint in a loop. Instead, set `next_run_at` to staggered near-future times and let the scheduler handle it.

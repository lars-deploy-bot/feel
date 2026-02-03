# RFC: Scheduled Automation for Sites

**Status:** Draft
**RFC ID:** RFC-2026-005
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

Users can schedule automated tasks for their site. "Post a new blog entry every Monday from my notes." "Update the events page from my Google Calendar daily." "Change the hero banner every season." Set it and forget it.

## Problem

Users want their site to stay fresh but don't have time to update it manually. They have content in other places (calendars, notes, social media) that should flow to their site automatically.

**User frustration:** "I keep forgetting to update my events page. The calendar on my site is always outdated."

## User Stories

1. **Calendar sync:** "Sync my Google Calendar to the events page every night"
2. **Social import:** "Add my latest Instagram posts to the gallery weekly"
3. **Scheduled content:** "Publish this blog post next Monday at 9am"
4. **Recurring updates:** "Every first of the month, update the specials page"
5. **Seasonal changes:** "On December 1, switch to the holiday theme"
6. **Data refresh:** "Every hour, update the menu prices from my spreadsheet"

## Types of Automation

| Type | Trigger | Example |
|------|---------|---------|
| **Scheduled** | Cron/time-based | "Every Monday at 9am" |
| **Sync** | External data change | "When calendar updates" |
| **Delayed publish** | One-time future | "Publish on March 15" |
| **Recurring content** | Template + schedule | "Weekly specials from template" |

## Technical Approach

### Automation Architecture

```
┌─────────────────────────────────────────────────┐
│               Automation Engine                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐    ┌──────────────────────┐   │
│  │   Scheduler  │    │   Webhook Receiver   │   │
│  │  (cron jobs) │    │  (external triggers) │   │
│  └──────┬───────┘    └──────────┬───────────┘   │
│         │                       │               │
│         └───────────┬───────────┘               │
│                     ↓                           │
│         ┌───────────────────────┐               │
│         │    Job Executor       │               │
│         │  (runs as site user)  │               │
│         └───────────┬───────────┘               │
│                     ↓                           │
│         ┌───────────────────────┐               │
│         │    Claude Agent       │               │
│         │  (performs the task)  │               │
│         └───────────────────────┘               │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Job Definition

```typescript
interface AutomationJob {
  id: string
  siteId: string
  userId: string
  name: string
  description: string

  // Trigger
  trigger: {
    type: 'cron' | 'webhook' | 'one-time'
    schedule?: string  // cron expression
    runAt?: Date       // for one-time
    webhookSecret?: string
  }

  // What to do
  action: {
    type: 'prompt' | 'sync' | 'publish'
    prompt?: string  // instruction for Claude
    source?: ExternalDataSource
    targetPage?: string
  }

  // Status
  isActive: boolean
  lastRunAt?: Date
  lastRunStatus?: 'success' | 'failure'
  nextRunAt?: Date
}

interface ExternalDataSource {
  type: 'google-calendar' | 'google-sheets' | 'instagram' | 'rss'
  connectionId: string
  config: Record<string, unknown>
}
```

### Example: Calendar Sync Job

```typescript
const calendarSyncJob: AutomationJob = {
  id: 'job_123',
  siteId: 'site_456',
  userId: 'user_789',
  name: 'Sync Events Calendar',
  description: 'Update events page from Google Calendar daily',

  trigger: {
    type: 'cron',
    schedule: '0 6 * * *'  // 6am daily
  },

  action: {
    type: 'sync',
    source: {
      type: 'google-calendar',
      connectionId: 'conn_abc',
      config: { calendarId: 'primary', daysAhead: 30 }
    },
    targetPage: '/events'
  },

  isActive: true
}
```

### Job Execution

```typescript
async function executeJob(job: AutomationJob): Promise<JobResult> {
  const site = await getSite(job.siteId)
  const user = await getUser(job.userId)

  // Build prompt based on action type
  let prompt: string

  if (job.action.type === 'sync') {
    const data = await fetchExternalData(job.action.source)
    prompt = `
      Update the ${job.action.targetPage} page with this data:

      ${JSON.stringify(data, null, 2)}

      Keep the existing page structure and styling.
      Just update the content with the new data.
    `
  } else if (job.action.type === 'prompt') {
    prompt = job.action.prompt
  }

  // Execute as Claude agent
  const result = await claudeAgent.chat({
    userId: user.id,
    workspace: site.domain,
    message: prompt,
    source: 'automation',
    context: { jobId: job.id }
  })

  // Log result
  await logJobExecution(job.id, result)

  return result
}
```

## Database Schema

```sql
-- Automation jobs
CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES domains(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  -- Trigger configuration
  trigger_type TEXT NOT NULL,  -- 'cron', 'webhook', 'one-time'
  cron_schedule TEXT,          -- '0 6 * * *'
  run_at TIMESTAMPTZ,          -- for one-time jobs
  webhook_secret TEXT,

  -- Action configuration
  action_type TEXT NOT NULL,   -- 'prompt', 'sync', 'publish'
  action_prompt TEXT,
  action_source JSONB,         -- external data source config
  action_target_page TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_error TEXT,
  next_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job execution history
CREATE TABLE automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES automation_jobs(id) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL,  -- 'running', 'success', 'failure'
  result JSONB,
  error TEXT,
  changes_made TEXT[]   -- list of files changed
);

-- External connections (Google, Instagram, etc.)
CREATE TABLE external_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  provider TEXT NOT NULL,  -- 'google', 'instagram', 'notion'
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## User Interface

### Automation Dashboard

```
┌─────────────────────────────────────────────────┐
│ Automations                          [+ New]    │
├─────────────────────────────────────────────────┤
│                                                 │
│ ✅ Sync Events Calendar                         │
│    Daily at 6:00 AM · Last run: 2h ago ✓        │
│    [Edit] [Pause] [Run Now]                     │
│                                                 │
│ ✅ Import Instagram Posts                       │
│    Weekly on Sunday · Last run: 3d ago ✓        │
│    [Edit] [Pause] [Run Now]                     │
│                                                 │
│ ⏸️ Holiday Theme Switch (paused)                │
│    One-time: Dec 1, 2026                        │
│    [Edit] [Resume] [Delete]                     │
│                                                 │
│ ❌ Menu Price Update                            │
│    Hourly · Last run: 1h ago ✗                  │
│    Error: Google Sheets connection expired      │
│    [Fix Connection] [Edit] [Delete]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Create Automation Flow

```
Step 1: What do you want to automate?
┌─────────────────────────────────────────────────┐
│ ○ Sync from external source                     │
│   Pull data from Google Calendar, Sheets, etc.  │
│                                                 │
│ ○ Scheduled content update                      │
│   Run a task on a schedule                      │
│                                                 │
│ ○ Publish later                                 │
│   Schedule content to go live in the future     │
└─────────────────────────────────────────────────┘

Step 2: Connect your source
┌─────────────────────────────────────────────────┐
│ Connect to:                                     │
│                                                 │
│ [📅 Google Calendar]  [📊 Google Sheets]        │
│ [📸 Instagram]        [📝 Notion]               │
│ [📡 RSS Feed]         [🔗 Custom Webhook]       │
└─────────────────────────────────────────────────┘

Step 3: Set your schedule
┌─────────────────────────────────────────────────┐
│ Run this automation:                            │
│                                                 │
│ ○ Daily at [6:00 AM ▼]                          │
│ ○ Weekly on [Monday ▼] at [9:00 AM ▼]           │
│ ○ Monthly on day [1 ▼] at [12:00 PM ▼]          │
│ ○ Custom: [________] (cron expression)          │
└─────────────────────────────────────────────────┘
```

## Security Considerations

1. **Sandboxed execution:** Jobs run with same permissions as user
2. **Rate limiting:** Max jobs per user, max runs per hour
3. **Timeout:** Jobs killed after 5 minutes
4. **Audit log:** All changes logged with job ID
5. **OAuth scopes:** Minimal permissions for external connections
6. **Secret rotation:** Webhook secrets can be regenerated

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Cron scheduler + simple prompts | 3-4 days |
| Phase 2 | Google Calendar/Sheets integration | 3-4 days |
| Phase 3 | Automation UI (list, create, edit) | 3-4 days |
| Phase 4 | Execution history + error handling | 2-3 days |
| Phase 5 | More integrations (Instagram, RSS) | 1 week |
| Total | Full automation system | ~3-4 weeks |

## Success Metrics

- % of users with at least 1 active automation
- Automation success rate
- Time saved (estimated based on task frequency)
- Automation retention (do users keep using them?)

## Open Questions

1. Free tier limits (number of automations, frequency)?
2. How to handle failures - retry? notify? disable?
3. Should users see Claude's "thinking" for automation runs?
4. How to preview what an automation will do before enabling?

## References

- [OpenClaw Cron System](https://docs.openclaw.ai/automation/cron-jobs)
- [Zapier](https://zapier.com/) - Automation inspiration
- [IFTTT](https://ifttt.com/) - Simple trigger/action patterns
- [n8n](https://n8n.io/) - Open source automation

# RFC: Proactive Notifications for Sites

**Status:** Draft
**RFC ID:** RFC-2026-004
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

We notify users when something needs attention on their site. Broken links, SSL expiring, contact form not working, site down. Don't wait for users to discover problems - tell them proactively.

## Problem

Users publish their site and forget about it. Problems accumulate silently:
- Broken links (linked page was removed)
- SSL certificate expiring
- Contact form submissions failing
- Site returning errors
- Performance degradation

Users only find out when a customer complains or they randomly check.

**User frustration:** "My contact form was broken for 2 weeks and I had no idea. I lost leads!"

## User Stories

1. **Broken link alert:** "Hey, the link to your Instagram on the footer is broken (404). Want me to fix it?"
2. **SSL warning:** "Your SSL certificate expires in 7 days. I'll renew it automatically unless you say no."
3. **Downtime alert:** "Your site was down for 15 minutes. It's back now. Here's what happened."
4. **Form failure:** "Your contact form hasn't received any submissions in 14 days. Last time it worked was Jan 15."
5. **Weekly digest:** "Weekly site health: 2 broken links found, 1,234 visitors, 12 form submissions."

## What We Monitor

| Check | Frequency | Alert Trigger |
|-------|-----------|---------------|
| Site uptime | Every 5 min | Down > 2 consecutive checks |
| SSL expiry | Daily | < 14 days remaining |
| Broken links | Weekly | Any 404/5xx on internal links |
| Form submissions | Daily | None in 7+ days (if previously active) |
| Build failures | On deploy | Build fails |
| Performance | Weekly | Load time > 5s |

## Notification Channels

Users choose how they want to be notified:

1. **Email** (default) - Weekly digest + critical alerts
2. **In-app** - Badge/notification in dashboard
3. **Telegram/WhatsApp** (if connected) - Instant alerts
4. **Slack/Discord** (future) - Team notifications

## Technical Approach

### Monitoring Architecture

```
┌─────────────────────────────────────────────────┐
│                 Cron Scheduler                   │
│  (runs health checks on schedule)               │
└─────────────────┬───────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ↓             ↓             ↓
┌────────┐  ┌──────────┐  ┌──────────┐
│ Uptime │  │  SSL     │  │  Links   │
│ Check  │  │  Check   │  │  Crawl   │
└────┬───┘  └────┬─────┘  └────┬─────┘
     │           │              │
     └───────────┴──────────────┘
                  │
                  ↓
         ┌───────────────┐
         │ Alert Engine  │
         │ (dedupe,      │
         │  throttle)    │
         └───────┬───────┘
                 │
    ┌────────────┼────────────┐
    ↓            ↓            ↓
┌────────┐  ┌─────────┐  ┌──────────┐
│ Email  │  │ In-App  │  │ Telegram │
└────────┘  └─────────┘  └──────────┘
```

### Health Check Implementation

```typescript
interface HealthCheck {
  id: string
  name: string
  schedule: string  // cron expression
  run: (site: Site) => Promise<HealthCheckResult>
}

interface HealthCheckResult {
  status: 'ok' | 'warning' | 'critical'
  message?: string
  details?: Record<string, unknown>
  suggestedFix?: string
}

const uptimeCheck: HealthCheck = {
  id: 'uptime',
  name: 'Site Uptime',
  schedule: '*/5 * * * *',  // every 5 minutes
  async run(site) {
    const response = await fetch(site.url, { timeout: 10000 })
    if (!response.ok) {
      return {
        status: 'critical',
        message: `Site returned ${response.status}`,
        suggestedFix: 'Check your site configuration and server logs'
      }
    }
    return { status: 'ok' }
  }
}
```

### Alert Deduplication

Don't spam users with the same alert:

```typescript
interface AlertState {
  siteId: string
  checkId: string
  lastStatus: 'ok' | 'warning' | 'critical'
  lastAlertSent: Date | null
  consecutiveFailures: number
}

async function shouldSendAlert(
  current: HealthCheckResult,
  state: AlertState
): Promise<boolean> {
  // Only alert on status change (ok → warning, warning → critical)
  if (current.status === state.lastStatus) {
    return false
  }

  // Don't alert for transient failures
  if (current.status !== 'ok' && state.consecutiveFailures < 2) {
    return false
  }

  // Rate limit: max 1 alert per check per hour
  if (state.lastAlertSent &&
      Date.now() - state.lastAlertSent.getTime() < 3600000) {
    return false
  }

  return true
}
```

## Database Schema

```sql
-- Health check results
CREATE TABLE site_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES domains(id) NOT NULL,
  check_type TEXT NOT NULL,  -- 'uptime', 'ssl', 'links', 'forms'
  status TEXT NOT NULL,  -- 'ok', 'warning', 'critical'
  message TEXT,
  details JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert state for deduplication
CREATE TABLE site_alert_state (
  site_id UUID REFERENCES domains(id) NOT NULL,
  check_type TEXT NOT NULL,
  last_status TEXT NOT NULL,
  last_alert_sent TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  PRIMARY KEY (site_id, check_type)
);

-- User notification preferences
CREATE TABLE notification_preferences (
  user_id UUID REFERENCES users(id) PRIMARY KEY,
  email_enabled BOOLEAN DEFAULT TRUE,
  email_digest TEXT DEFAULT 'weekly',  -- 'daily', 'weekly', 'never'
  email_critical BOOLEAN DEFAULT TRUE,  -- immediate email for critical
  telegram_enabled BOOLEAN DEFAULT FALSE,
  telegram_chat_id TEXT,
  in_app_enabled BOOLEAN DEFAULT TRUE
);

-- Notification history
CREATE TABLE notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  site_id UUID REFERENCES domains(id),
  channel TEXT NOT NULL,  -- 'email', 'telegram', 'in_app'
  type TEXT NOT NULL,  -- 'alert', 'digest', 'info'
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Notification Templates

### Critical Alert (Immediate)

```
🚨 Your site is down

sweetmorning.com is not responding.
Detected: 2 minutes ago
Status: Connection timeout

What to do:
→ Check if the problem resolved itself (sometimes temporary)
→ Or reply "check" and I'll investigate

[View Site Status]
```

### Weekly Digest

```
📊 Weekly Report for sweetmorning.com

✅ Uptime: 99.8% (1 incident, 15 min)
✅ SSL: Valid for 45 more days
⚠️ Broken links: 2 found
   - /menu → /old-menu (404)
   - /instagram → external link broken

📈 Traffic: 1,234 visitors (+12% vs last week)
📬 Forms: 8 submissions received

Want me to fix those broken links? Just reply "fix links"
```

## User Settings UI

```
┌─────────────────────────────────────────────────┐
│ Notification Settings                           │
├─────────────────────────────────────────────────┤
│                                                 │
│ Email Notifications                             │
│ ├─ Weekly digest           [✓]                  │
│ ├─ Critical alerts         [✓]                  │
│ └─ Email: lars@example.com [Edit]               │
│                                                 │
│ Telegram Notifications                          │
│ └─ Not connected          [Connect Telegram]    │
│                                                 │
│ What to monitor                                 │
│ ├─ Site uptime             [✓]                  │
│ ├─ SSL certificate         [✓]                  │
│ ├─ Broken links            [✓]                  │
│ ├─ Form submissions        [✓]                  │
│ └─ Performance             [ ]                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Uptime monitoring + email alerts | 2-3 days |
| Phase 2 | SSL + broken link checks | 2-3 days |
| Phase 3 | Weekly digest emails | 1-2 days |
| Phase 4 | Telegram/messaging notifications | 1-2 days |
| Phase 5 | Notification settings UI | 2-3 days |
| Total | Full notification system | ~2 weeks |

## Success Metrics

- % of users with notifications enabled
- Time to detection (how fast we catch issues)
- User response rate to alerts
- Issues fixed after notification vs ignored

## Open Questions

1. Should we auto-fix some issues (like SSL renewal) without asking?
2. How to handle sites with expected downtime (maintenance)?
3. Free tier limits on monitoring frequency?
4. Should broken link alerts include suggested fixes?

## References

- [UptimeRobot](https://uptimerobot.com/) - Monitoring service for inspiration
- [OpenClaw Cron Jobs](https://docs.openclaw.ai/automation/cron-jobs)
- [Better Uptime](https://betteruptime.com/) - Status page patterns

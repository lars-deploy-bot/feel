---
name: sentry
description: Query Sentry for errors and bugs. Unresolved issues, stacktraces, error trends, environment breakdowns, and issue details.
---

# Sentry Error Analysis

Query the self-hosted Sentry instance for bugs and errors. Sentry runs on Server 2 (`sentry.sonno.tech`) but the API is reachable from any server.

## Setup

```bash
SENTRY_TOKEN=$(grep SENTRY_AUTH_TOKEN apps/web/.env.production | cut -d= -f2)
SENTRY_API="https://sentry.sonno.tech/api/0"
SENTRY_PROJECT="$SENTRY_API/projects/sentry/alive"
SENTRY_ISSUES="$SENTRY_API/issues"
AUTH="Authorization: Bearer $SENTRY_TOKEN"
```

## How to Query

**IMPORTANT**: The Sentry API uses Bearer token auth and returns JSON. The queries below use inline Python via `python3 -c` for simplicity. For more complex queries, consider using temp files to avoid shell quoting issues.

Key endpoints:
- **Project issues**: `$SENTRY_PROJECT/issues/` — list/search issues
- **Issue events**: `$SENTRY_ISSUES/{id}/events/` — individual error occurrences with stacktraces
- **Project stats**: `$SENTRY_PROJECT/stats/` — time-series error counts

## Run All Core Queries

When the user asks about Sentry errors, run ALL of these in parallel to give a full picture. Adjust `statsPeriod` (`24h`, `14d`) based on what the user asks.

### 1. Unresolved Issues (by frequency)

Top bugs sorted by how often they occur.

```bash
curl -s "$SENTRY_PROJECT/issues/?query=is:unresolved&sort=freq&limit=15&statsPeriod=14d" \
  -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f"{'Count':>6}  {'Users':>5}  {'Level':>5}  Title")
print('-' * 80)
for issue in d:
    title = issue['title'][:55]
    print(f'{issue[\"count\"]:>6}  {issue[\"userCount\"]:>5}  {issue[\"level\"]:>5}  {title}')
    print(f'         Last: {issue[\"lastSeen\"][:19]}  {issue[\"permalink\"]}')
"
```

### 2. Recent Issues (newest first)

Freshly appearing errors — regressions or new bugs.

```bash
curl -s "$SENTRY_PROJECT/issues/?query=is:unresolved&sort=date&limit=10&statsPeriod=24h" \
  -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d:
    print('No new issues in the last 24h.')
else:
    print(f"{'Count':>6}  {'First Seen':>19}  Title")
    print('-' * 80)
    for issue in d:
        title = issue['title'][:50]
        print(f'{issue[\"count\"]:>6}  {issue[\"firstSeen\"][:19]}  {title}')
        print(f'         {issue[\"permalink\"]}')
"
```

### 3. Error Trend (daily counts)

```bash
curl -s "$SENTRY_PROJECT/stats/?stat=received&resolution=1d&since=$(python3 -c 'import time; print(int(time.time() - 14*86400))')" \
  -H "$AUTH" | python3 -c "
import sys, json
from datetime import datetime
d = json.load(sys.stdin)
print('Daily error volume (last 14 days):')
print(f"{'Date':>12}  {'Errors':>6}  Graph")
print('-' * 50)
for ts, count in d:
    dt = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
    bar = '#' * min(int(count / 5), 40)
    print(f'{dt:>12}  {count:>6}  {bar}')
total = sum(c for _, c in d)
print(f"{'Total':>12}  {total:>6}")
"
```

### 4. Issues by Environment

```bash
curl -s "$SENTRY_PROJECT/issues/?query=is:unresolved+environment:production&sort=freq&limit=10&statsPeriod=14d" \
  -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('=== PRODUCTION errors ===')
if not d:
    print('  No unresolved production errors.')
else:
    for issue in d:
        print(f'  [{issue[\"count\"]}x] {issue[\"title\"][:70]}')
"

curl -s "$SENTRY_PROJECT/issues/?query=is:unresolved+environment:staging&sort=freq&limit=10&statsPeriod=14d" \
  -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print()
print('=== STAGING errors ===')
if not d:
    print('  No unresolved staging errors.')
else:
    for issue in d:
        print(f'  [{issue[\"count\"]}x] {issue[\"title\"][:70]}')
"
```

### 5. Issue Detail with Stacktrace

Use this to drill into a specific issue. Replace `ISSUE_ID` with the numeric ID from queries above.

```bash
ISSUE_ID=__REPLACE__
curl -s "$SENTRY_ISSUES/$ISSUE_ID/events/?limit=1&full=true" \
  -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d:
    print('No events found for this issue.')
    sys.exit(0)
e = d[0]
print(f'Event: {e[\"eventID\"]}')
print(f'Date:  {e[\"dateCreated\"]}')
print(f'Title: {e[\"title\"]}')
print()

# Tags
tags = e.get('tags', [])
important_tags = ['environment', 'browser', 'os', 'level', 'category', 'component', 'server_name', 'release']
tag_dict = {t['key']: t['value'] for t in tags}
for key in important_tags:
    if key in tag_dict:
        print(f'  {key}: {tag_dict[key]}')
print()

# Exception + stacktrace
for entry in e.get('entries', []):
    if entry['type'] == 'exception':
        for val in entry['data'].get('values', []):
            print(f'Exception: {val.get(\"type\")}: {val.get(\"value\", \"\")[:200]}')
            frames = val.get('stacktrace', {}).get('frames', [])
            print(f'Stacktrace ({len(frames)} frames, showing last 8):')
            for f in frames[-8:]:
                fn = f.get('filename', '?')
                ln = f.get('lineno', '?')
                col = f.get('colno', '')
                func = f.get('function', '?')
                in_app = ' [app]' if f.get('inApp') else ''
                print(f'  {fn}:{ln}:{col} in {func}{in_app}')
                # Show context lines around the error
                ctx = f.get('context', [])
                for line_num, code in ctx:
                    marker = '>>>' if line_num == ln else '   '
                    print(f'    {marker} {line_num}: {str(code)[:120]}')
            print()

    elif entry['type'] == 'breadcrumbs':
        crumbs = entry['data'].get('values', [])
        print(f'Breadcrumbs ({len(crumbs)} total, last 10):')
        for c in crumbs[-10:]:
            cat = c.get('category', '?')
            msg = c.get('message', '')[:80]
            lvl = c.get('level', '')
            ts = c.get('timestamp', '')[:19]
            print(f'  [{ts}] {cat} ({lvl}): {msg}')
        print()

    elif entry['type'] == 'request':
        req = entry.get('data', {})
        print(f'Request: {req.get(\"method\", \"?\")} {req.get(\"url\", \"?\")}')
        print()
"
```

### 6. Issue Stats (occurrence timeline)

Time-series data for a specific issue to see if it's getting worse.

```bash
ISSUE_ID=__REPLACE__
curl -s "$SENTRY_ISSUES/$ISSUE_ID/" \
  -H "$AUTH" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Title:      {d[\"title\"]}')
print(f'Level:      {d[\"level\"]}')
print(f'Status:     {d[\"status\"]}')
print(f'Count:      {d[\"count\"]}')
print(f'Users:      {d[\"userCount\"]}')
print(f'First seen: {d[\"firstSeen\"]}')
print(f'Last seen:  {d[\"lastSeen\"]}')
print(f'Link:       {d[\"permalink\"]}')
print()
stats = d.get('stats', {}).get('24h', [])
if stats:
    print('Last 24h timeline:')
    from datetime import datetime
    for ts, count in stats:
        if count > 0:
            dt = datetime.fromtimestamp(ts).strftime('%H:%M')
            bar = '#' * min(count, 30)
            print(f'  {dt}: {count:>3} {bar}')
"
```

## Investigating a Bug

After running the core queries, to investigate a specific issue:

1. **Get the issue ID** from the unresolved issues list
2. **Run query 5** (Issue Detail) to get the full stacktrace
3. **Run query 6** (Issue Stats) to see if it's trending up
4. **Map stacktrace to codebase**: Use the filenames from the stacktrace to find the actual source files with Glob/Grep
5. **Check recent commits**: If the error started recently, check `git log --since="FIRST_SEEN_DATE"` for related changes

## Advanced Searches

```bash
# Errors with specific text
curl -s "$SENTRY_PROJECT/issues/?query=is:unresolved+SEARCH_TERM&sort=freq&limit=10" -H "$AUTH"

# Errors for a specific user
curl -s "$SENTRY_PROJECT/issues/?query=is:unresolved+user.email:USER_EMAIL&limit=10" -H "$AUTH"

# Errors by tag
curl -s "$SENTRY_PROJECT/issues/?query=is:unresolved+category:stream&limit=10" -H "$AUTH"

# Resolved issues (to check for regressions)
curl -s "$SENTRY_PROJECT/issues/?query=is:resolved&sort=date&limit=10&statsPeriod=7d" -H "$AUTH"

# Errors with specific level
curl -s "$SENTRY_PROJECT/issues/?query=is:unresolved+level:fatal&limit=10" -H "$AUTH"
```

## Presenting Results

After running all queries, present a clean summary:

1. **Health overview**: Total errors in period, trend direction (increasing/decreasing), production vs staging split
2. **Top issues table**: Ranked by frequency with counts, affected users, and links
3. **New regressions**: Any issues that appeared in the last 24h
4. **Environment breakdown**: Production errors (critical) vs staging errors (less urgent)
5. **Action items**: 3-5 bullet points on what to fix first, based on frequency and user impact

## Sentry Search Syntax Reference

Common query operators:
- `is:unresolved` / `is:resolved` / `is:ignored` — issue status
- `level:error` / `level:fatal` / `level:warning` — severity
- `environment:production` / `environment:staging` — environment filter
- `assigned:me` / `assigned:nobody` — assignment
- `firstSeen:>2026-02-28` — first seen after date
- `lastSeen:>2026-02-28` — last seen after date
- `times_seen:>100` — occurrence threshold
- `has:user` — issues that affected real users
- Free text search matches against issue title/message

Sort options: `date` (newest), `freq` (most frequent), `priority` (Sentry priority), `user` (most users affected)

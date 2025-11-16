# Analytics Tools

1 tool for reading production app usage analytics.

---

## `analytics--read_project_analytics`

Read usage analytics for production deployed app.

**Signature:**
```typescript
analytics--read_project_analytics(
  startdate: string,
  enddate: string,
  granularity: string
): AnalyticsData
```

**Parameters:**
- `startdate` (required): Start date for analytics period
  - Format: `"YYYY-MM-DD"` or RFC3339 (`"YYYY-MM-DDTHH:MM:SSZ"`)
  - Examples: `"2025-01-01"`, `"2025-01-01T00:00:00Z"`
- `enddate` (required): End date for analytics period
  - Format: `"YYYY-MM-DD"` or RFC3339 (`"YYYY-MM-DDTHH:MM:SSZ"`)
  - Examples: `"2025-01-31"`, `"2025-01-31T23:59:59Z"`
- `granularity` (required): Data aggregation level
  - Options: `"hourly"` or `"daily"`
  - `"hourly"`: Hour-by-hour breakdown
  - `"daily"`: Day-by-day summary

**Returns:** Analytics data with metrics over specified period

**Usage:**
```typescript
// Get daily analytics for January 2025
analytics--read_project_analytics(
  "2025-01-01",
  "2025-01-31",
  "daily"
)

// Get hourly analytics for last week
analytics--read_project_analytics(
  "2025-01-20",
  "2025-01-27",
  "hourly"
)

// Get daily analytics for specific date range
analytics--read_project_analytics(
  "2024-12-01",
  "2024-12-31",
  "daily"
)

// Get hourly analytics for a single day
analytics--read_project_analytics(
  "2025-01-15",
  "2025-01-15",
  "hourly"
)

// Get analytics with full timestamps
analytics--read_project_analytics(
  "2025-01-01T00:00:00Z",
  "2025-01-31T23:59:59Z",
  "daily"
)
```

**Output Format:**
```json
{
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31",
    "granularity": "daily"
  },
  "metrics": [
    {
      "date": "2025-01-01",
      "pageViews": 1247,
      "uniqueVisitors": 342,
      "sessions": 456,
      "averageSessionDuration": 185.5,
      "bounceRate": 0.42,
      "topPages": [
        { "path": "/", "views": 523 },
        { "path": "/pricing", "views": 187 },
        { "path": "/features", "views": 156 }
      ]
    },
    {
      "date": "2025-01-02",
      "pageViews": 1389,
      "uniqueVisitors": 378,
      "sessions": 501,
      "averageSessionDuration": 198.2,
      "bounceRate": 0.38,
      "topPages": [
        { "path": "/", "views": 589 },
        { "path": "/features", "views": 201 },
        { "path": "/pricing", "views": 178 }
      ]
    }
  ],
  "summary": {
    "totalPageViews": 38450,
    "totalUniqueVisitors": 10234,
    "totalSessions": 14567,
    "averagePageViewsPerSession": 2.64,
    "averageBounceRate": 0.40
  }
}
```

**Metrics Included:**

**Page Views:**
- Total number of pages viewed
- Includes repeat views by same visitor
- Useful for engagement measurement

**Unique Visitors:**
- Number of distinct visitors
- Identified by IP/cookie
- Indicates reach

**Sessions:**
- Number of visit sessions
- Session = continuous period of activity
- Ends after 30 minutes of inactivity

**Average Session Duration:**
- Mean time spent per session (seconds)
- Indicates engagement level
- Higher = more engaged users

**Bounce Rate:**
- Percentage of single-page sessions
- 0.42 = 42% of visitors left after one page
- Lower is generally better (except for single-page apps)

**Top Pages:**
- Most visited pages in order
- Path and view count
- Identifies popular content

**When to Use:**

### User Requests Analytics
```typescript
// User: "How many people are using my app?"
analytics--read_project_analytics(
  "2025-01-01",
  "2025-01-31",
  "daily"
)

// Response: "Your app had 10,234 unique visitors in January..."
```

### Performance Analysis
```typescript
// User: "Has traffic increased after recent changes?"
analytics--read_project_analytics(
  "2024-12-01",  // Before changes
  "2024-12-31",
  "daily"
)

analytics--read_project_analytics(
  "2025-01-01",  // After changes
  "2025-01-31",
  "daily"
)

// Compare metrics between periods
```

### Identify Popular Features
```typescript
// User: "Which features are most popular?"
analytics--read_project_analytics(
  "2025-01-01",
  "2025-01-31",
  "daily"
)

// Look at topPages in results to see most visited routes
```

### Performance Troubleshooting
```typescript
// User: "App feels slow, are users leaving quickly?"
analytics--read_project_analytics(
  "2025-01-20",
  "2025-01-27",
  "daily"
)

// Check bounceRate and averageSessionDuration
// High bounce rate + low session duration = performance issue
```

### Growth Tracking
```typescript
// Monitor month-over-month growth
analytics--read_project_analytics(
  "2025-01-01",
  "2025-01-31",
  "daily"
)

analytics--read_project_analytics(
  "2025-02-01",
  "2025-02-28",
  "daily"
)

// Compare totalUniqueVisitors and totalPageViews
```

**Critical Rules:**
- ✅ **Only for production apps** (deployed to lovable.app or custom domain)
- ✅ No analytics for development/preview builds
- ✅ Use when user asks about app usage/traffic
- ✅ Can help identify performance issues
- ✅ Can reveal popular features
- ❌ Cannot track custom events (only page views)
- ❌ Cannot identify individual users (anonymous)
- ✅ Data available with ~1 hour delay (not real-time)

**Granularity Selection:**

**Use "daily" when:**
- Analyzing trends over weeks/months
- Getting high-level overview
- Comparing different time periods
- Default choice for most requests

**Use "hourly" when:**
- Analyzing specific day's traffic patterns
- Identifying peak usage times
- Troubleshooting issues on specific date
- Need detailed breakdown

---

## Use Cases & Patterns

### Basic Usage Report
```typescript
// User: "Show me my app usage"
analytics--read_project_analytics(
  "2025-01-01",
  "2025-01-31",
  "daily"
)

// Present summary:
// - Total visitors
// - Total page views
// - Most popular pages
// - Average engagement
```

### Compare Time Periods
```typescript
// Compare two months
const jan = analytics--read_project_analytics(
  "2025-01-01",
  "2025-01-31",
  "daily"
)

const feb = analytics--read_project_analytics(
  "2025-02-01",
  "2025-02-28",
  "daily"
)

// Calculate growth:
// - Visitor growth: (feb.visitors - jan.visitors) / jan.visitors * 100
// - Engagement changes
// - Popular page shifts
```

### Identify Traffic Patterns
```typescript
// Analyze hourly patterns for a week
analytics--read_project_analytics(
  "2025-01-20",
  "2025-01-26",
  "hourly"
)

// Identify:
// - Peak usage hours
// - Low traffic periods
// - Day of week patterns
```

### Feature Popularity Analysis
```typescript
// Get analytics
const data = analytics--read_project_analytics(
  "2025-01-01",
  "2025-01-31",
  "daily"
)

// Analyze topPages across all days
// Rank features by total views
// Identify underused features
// Suggest improvements for popular features
```

### Performance Investigation
```typescript
// User reports: "App seems slow recently"

// Get recent analytics
const recent = analytics--read_project_analytics(
  "2025-01-25",
  "2025-01-31",
  "daily"
)

// Check metrics:
// - High bounce rate? -> Loading issues
// - Low session duration? -> Usability problems
// - Specific page drop-off? -> That page has issues
```

### Growth Tracking Dashboard
```typescript
// Create monthly growth report
const analytics = analytics--read_project_analytics(
  "2025-01-01",
  "2025-01-31",
  "daily"
)

// Extract key metrics:
// - Total unique visitors
// - Growth vs previous month
// - Engagement metrics (session duration, bounce rate)
// - Top performing pages
// - Traffic trends (increasing/decreasing/stable)
```

---

## Best Practices

**Date Range Selection:**
```typescript
// ✅ Good: Reasonable ranges
analytics--read_project_analytics("2025-01-01", "2025-01-31", "daily")  // 1 month
analytics--read_project_analytics("2025-01-20", "2025-01-27", "hourly") // 1 week

// ⚠️ Careful: Very large ranges
analytics--read_project_analytics("2024-01-01", "2024-12-31", "hourly") // 8760 data points!

// Use daily granularity for long periods
analytics--read_project_analytics("2024-01-01", "2024-12-31", "daily")  // 365 data points
```

**Presenting Data to Users:**
```typescript
// Don't just dump raw JSON
// Present insights:
// - "Your app had 10,234 visitors in January, up 23% from December"
// - "Most popular page is /pricing with 5,432 views"
// - "Average visitor spends 3 minutes on your site"
// - "Your bounce rate of 32% is excellent (below 40% is good)"
```

**Actionable Insights:**
```typescript
// Low engagement?
// - Suggest performance improvements
// - Recommend clearer CTAs
// - Improve content on popular pages

// High bounce rate on specific page?
// - Suggest optimizing that page
// - Check for loading issues
// - Improve first-time UX

// Popular features?
// - Suggest enhancing them further
// - Create similar features
// - Make them more prominent
```

**Comparisons:**
```typescript
// Always compare to something:
// - Previous period (month-over-month)
// - Industry benchmarks
// - App's historical performance
// - Before/after feature launches
```

**Privacy:**
```typescript
// Analytics are anonymous
// No personal data
// Cannot identify individual users
// Complies with privacy regulations
```

---

## Common Questions

**"No analytics available":**
- App must be deployed to production
- Analytics only work on published app
- Not available in development/preview

**"Why are numbers low?":**
- Fresh deployments take time to accumulate traffic
- Analytics have ~1 hour delay
- Check date range is correct

**"Can I track custom events?":**
- No, only page views available
- For custom analytics, integrate third-party service (Google Analytics, Mixpanel, etc.)

**"Can I see who my users are?":**
- No, analytics are anonymous
- Only aggregate metrics available
- For user identification, implement authentication and custom tracking

**"Real-time analytics?":**
- No, data has ~1 hour delay
- For real-time needs, integrate third-party service

**"Export analytics data?":**
- Data returned as JSON
- Can process and present to user
- No direct export to CSV/Excel (but could generate from data)

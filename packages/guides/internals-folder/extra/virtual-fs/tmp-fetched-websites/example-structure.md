# tmp://fetched-websites/ Structure

## What Goes Here

Content fetched from websites when AI uses `lov-fetch-website(url, formats)`.

## Example Structure

```
tmp://fetched-websites/
├── docs-Alive-dev-20250127-142301/
│   ├── content.md              [Markdown formatted content]
│   ├── content.html            [Raw HTML source]
│   └── screenshot.png          [Visual capture of page]
│
<!-- SUPABASE DISABLED: ├── github-supabase-docs-20250127-142405/ -->
│   ├── content.md
│   └── screenshot.png
│
├── stackoverflow-question-20250127-143012/
│   ├── content.md
│   └── content.html
│
└── api-docs-stripe-20250127-144520/
    ├── content.md
    ├── content.html
    └── screenshot.png
```

## How Files Get Here

1. **AI needs web content** (e.g., to answer your question, find code examples)
2. **AI calls** `lov-fetch-website("https://docs.Alive.dev/features/cloud", "markdown,screenshot")`
3. **Alive's fetcher**:
   - Downloads the webpage
   - Converts to markdown (clean, readable)
   - Optionally saves raw HTML
   - Optionally takes screenshot
4. **Results stored** in `tmp://fetched-websites/[domain-timestamp]/`

## Available Formats

### `markdown` (Most Common)
```
Content converted to clean markdown:
- Headers preserved
- Links preserved
- Images noted (not downloaded)
- Scripts/styles removed
- Readable text format
```

**Example:**
```markdown
# Alive Cloud Documentation

Alive Cloud is a full-stack platform...

## Features

- Database management
- Authentication
- File storage
- Edge functions

[Learn more](https://docs.Alive.dev)
```

### `html` (Raw Source)
```
Complete HTML source code:
- All tags preserved
- Scripts included
- Styles included
- Metadata included
```

**Use Cases:**
- Need to see specific HTML structure
- Checking meta tags, scripts
- Analyzing page source

### `screenshot` (Visual Capture)
```
PNG screenshot of page:
- Full page render
- Default viewport
- Top portion of long pages
```

**Use Cases:**
- Visual design reference
- Layout inspection
- UI comparison

## Example Usage by AI

### Fetch Documentation
```typescript
// User asks: "How do I implement Alive AI?"

// AI calls:
(
  "https://docs.Alive.dev/features/ai",
  "markdown"
)

// Results:
// tmp://fetched-websites/docs-Alive-dev-[timestamp]/content.md

// AI reads:
lov-view("tmp://fetched-websites/docs-Alive-dev-[timestamp]/content.md")

// AI responds with implementation guidance
```

### Fetch Code Example
```typescript
// User asks: "How do others implement X?"

// AI calls:
lov-fetch-website(
  "https://github.com/username/repo/blob/main/example.tsx",
  "markdown,html"
)

// Results:
// tmp://fetched-websites/github-username-[timestamp]/
// ├── content.md  (readable code)
// └── content.html (raw HTML)

// AI analyzes code and adapts it
```

### Fetch for Design Reference
```typescript
// User asks: "Make it look like Stripe's pricing page"

// AI calls:
lov-fetch-website(
  "https://stripe.com/pricing",
  "markdown,screenshot"
)

// Results:
// tmp://fetched-websites/stripe-pricing-[timestamp]/
// ├── content.md (text structure)
// └── screenshot.png (visual design)

// AI implements similar design
```

## When AI Uses This

### Scenarios:
1. **User asks about recent tech** (beyond AI's training cutoff)
2. **User references specific documentation** ("Use the Stripe API docs")
3. **User asks for code examples** ("How do others solve this?")
4. **User wants design inspiration** ("Make it like Airbnb's homepage")
5. **AI needs to verify information** (checking latest API changes)

### Not Used For:
- General knowledge questions (AI uses built-in knowledge)
- Code in user's project (AI uses `lov-view` directly)
- User-uploaded files (those are in `user-uploads://`)

## Fetching Process

```
1. AI decides web content needed
2. AI calls: lov-fetch-website(url, formats)
3. Alive backend:
   - Sends HTTP request
   - Downloads page
   - Renders JavaScript if needed
   - Converts to requested formats
   - Stores in tmp://
4. AI receives file paths
5. AI reads content
6. AI uses information to answer user
```

## Example Workflow

### Scenario: User Asks About New API

```
User: "Implement the new OpenAI Realtime API"

AI thinks: "This is recent, may not be in my training data"

AI calls:
lov-fetch-website(
  "https://platform.openai.com/docs/guides/realtime",
  "markdown"
)

Results:
tmp://fetched-websites/platform-openai-[timestamp]/content.md

AI reads:
lov-view("tmp://fetched-websites/platform-openai-[timestamp]/content.md")

AI learns:
- WebSocket connection pattern
- Event types
- Authentication method
- Code examples

AI implements:
lov-write("src/hooks/useRealtimeAPI.ts", implementation_based_on_docs)
```

## Limitations

- **No login walls**: Can't fetch content behind authentication
- **Rate limits**: Excessive fetching may be throttled
- **JavaScript rendering**: Basic rendering only, complex SPAs may not fully render
- **File downloads**: Can't download large files (PDFs, videos)
- **Local URLs**: Can't fetch localhost or private networks

## Content Quality

### Clean Markdown
```markdown
✅ Headers preserved
✅ Lists formatted
✅ Links working
✅ Code blocks formatted
❌ Complex tables simplified
❌ Dynamic content may be missing
❌ Paywalled content not accessible
```

### Screenshots
```
✅ Visual design captured
✅ Layout visible
✅ Top portion of page
⚠️ Long pages truncated
❌ Interactive elements static
❌ Hover states not captured
```

## Cleanup

- Files persist **only for the current conversation**
- Automatically deleted when conversation ends
- No action needed from user

## Privacy & Security

- ✅ Only public web pages
- ✅ Respects robots.txt
- ✅ User-agent identified as Alive
- ❌ Cannot fetch password-protected pages
- ❌ Cannot fetch internal networks

## Common Questions

**Q: Can AI browse the web?**  
A: AI can fetch specific URLs you mention or it determines are relevant.

**Q: Does fetching cost credits?**  
A: Fetching is included in message credits (same as any AI operation).

**Q: Can I see what was fetched?**  
A: Ask AI: "What websites did you fetch?" and it can tell you.

**Q: Can I fetch multiple pages?**  
A: Yes, AI can fetch multiple URLs in one conversation.

**Q: Why not just search the web?**  
A: `lov-fetch-website` is for specific URLs. For search, AI uses `websearch--web_search()`.

## See Also

- **Web Search**: AI can search Google via `websearch--web_search()`
- **Code Search**: AI can search technical docs via `websearch--web_code_search()`
- **User Uploads**: Different from web fetching - see `user-uploads/`

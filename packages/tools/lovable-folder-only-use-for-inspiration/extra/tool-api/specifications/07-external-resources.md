# External Resources Tools

4 tools for web search, fetching websites, and downloading files from internet.

---

## `websearch--web_search`

General web search with text content extraction. Use for current events, general information, documentation.

**Signature:**
```typescript
websearch--web_search(
  query: string,
  numResults?: number,
  category?: string,
  links?: number,
  imageLinks?: number
): SearchResult[]
```

**Parameters:**
- `query` (required): Search query
  - Use `site:domain.com` to filter to specific domains
  - Use `"exact phrase"` for exact matches
  - Use `-word` to exclude terms
  - Examples: `"React Server Components tutorial"`, `"site:docs.lovable.dev authentication"`
- `numResults` (optional): Number of results to return (default: 5, max: 20)
- `category` (optional): Filter by category
  - Options: `"news"`, `"linkedin profile"`, `"pdf"`, `"github"`, `"personal site"`, `"financial report"`
- `links` (optional): Number of links to return per result
- `imageLinks` (optional): Number of image links to return per result

**Returns:** Array of search results with text content, URLs, and metadata

**Usage:**
```typescript
// General search
websearch--web_search("React Server Components tutorial")

// Search specific domain
websearch--web_search("site:docs.lovable.dev authentication")

// Multiple domains
websearch--web_search("site:docs.anthropic.com site:github.com API documentation")

// Exact phrase search
websearch--web_search('"gpt5" model name OAI')

// Exclude terms
websearch--web_search("jaguar speed -car")

// Get more results
websearch--web_search("TypeScript best practices 2025", 10)

// Find GitHub repositories
websearch--web_search("React form library", 5, "github")

// Get recent news
websearch--web_search("Next.js 15 release", 5, "news")

// Find PDFs
websearch--web_search("TypeScript handbook", 3, "pdf")
```

**When to Use:**
- ✅ User asks about recent events/news beyond training cutoff
- ✅ User references specific websites/documentation
- ✅ Finding real company information
- ✅ Researching new libraries/frameworks released recently
- ✅ Getting current best practices (e.g., "2025" not "2024")
- ❌ **DON'T** use for general knowledge already in training (waste of resources)
- ❌ **DON'T** use for technical code examples (use `web_code_search` instead)

**Critical Rules:**
- ✅ Account for current date (e.g., instructions say "Current date: 2025-11-14", use "2025" not "2024")
- ✅ Filter to specific domains for quality: `site:docs.lovable.dev`, `site:github.com`
- ✅ Use categories to narrow results: `"github"`, `"news"`, `"pdf"`
- ❌ Don't use for code examples (use `web_code_search` instead)

---

## `websearch--web_code_search`

Specialized search for technical documentation and code examples. **ALWAYS use for technical information.**

**Signature:**
```typescript
websearch--web_code_search(
  query: string,
  tokensNum?: string
): string
```

**Parameters:**
- `query` (required): Technical search query
  - Be specific about technology/framework
  - Include programming language when relevant
  - Examples: `"React hook form validation"`, `"Supabase RLS policies examples"`, `"Stripe Payment Intent API TypeScript"`
- `tokensNum` (optional): Tokens to return
  - Options: `"dynamic"` (default, auto-determines optimal length) or specific number (50-100000)
  - Higher = more comprehensive results (but slower)

**Returns:** Dense, relevant code examples and technical context

**Usage:**
```typescript
// Find React patterns
websearch--web_code_search("React useCallback optimization patterns")

// Find Supabase examples
websearch--web_code_search("Supabase edge function streaming response")

// Find API documentation
websearch--web_code_search("Stripe Payment Intent API TypeScript")

// Get comprehensive results (more tokens)
websearch--web_code_search("Next.js 14 app router data fetching", "1000")

// Find authentication implementation
websearch--web_code_search("NextAuth.js GitHub OAuth setup")

// Find database query patterns
websearch--web_code_search("Supabase row level security user data access")

// Find library usage examples
websearch--web_code_search("TanStack Query mutation with optimistic updates")
```

**Sources Searched:**
- GitHub repositories
- Official documentation sites
- Stack Overflow
- Technical blogs
- Dev.to articles
- Medium technical posts
- 1B+ technical documents indexed

**Critical Rules:**
- ✅ **ALWAYS** use for technical information (not regular `web_search`)
- ✅ Searches specialized technical sources
- ✅ Returns dense code snippets (not general web content)
- ✅ Uses advanced reranking for code relevance
- ✅ Prevents hallucinations with verified technical information
- ✅ Use when implementing unfamiliar APIs/frameworks

**When to Use:**
- ✅ Finding code examples from internet (e.g., "React hook for authentication")
- ✅ Understanding API syntax from docs (e.g., "Stripe API create customer")
- ✅ Learning implementation patterns (e.g., "JWT token validation in Express")
- ✅ Finding configuration examples (e.g., "Terraform AWS ECS task definition")
- ✅ Understanding library-specific patterns (e.g., "TanStack Query mutation")
- ✅ Looking up best practices (e.g., "secure password hashing in Node.js")
- ✅ Finding solutions to technical errors
- ✅ Understanding development setup/tooling

**When NOT to Use:**
- ❌ General information (use `web_search`)
- ❌ News/events (use `web_search` with `"news"` category)
- ❌ Company information (use `web_search`)
- ❌ Non-technical documentation (use `web_search`)

**Important:**
This searches **the web**, NOT the current repository. For searching code in the current project, use `lov-search-files`.

---

## `lov-fetch-website`

Download webpage content (markdown, HTML, screenshot) for analysis.

**Signature:**
```typescript
lov-fetch-website(
  url: string,
  formats: string
): string[]
```

**Parameters:**
- `url` (required): Website URL to fetch
  - Examples: `"https://docs.lovable.dev/features/cloud"`, `"https://github.com/user/repo"`, `"https://stripe.com/pricing"`
- `formats` (required): Comma-separated format list
  - Options: `"markdown"`, `"html"`, `"screenshot"`
  - Examples: `"markdown"`, `"markdown,screenshot"`, `"markdown,html,screenshot"`

**Returns:** Paths to fetched content in `tmp://fetched-websites/[domain-timestamp]/`

**Usage:**
```typescript
// Fetch documentation as markdown
lov-fetch-website("https://docs.stripe.com/api/payment_intents", "markdown")

// Returns: tmp://fetched-websites/docs.stripe.com-20251114-120000/content.md

// Fetch with screenshot for design reference
lov-fetch-website("https://stripe.com/pricing", "markdown,screenshot")

// Returns:
// - tmp://fetched-websites/stripe.com-20251114-120000/content.md
// - tmp://fetched-websites/stripe.com-20251114-120000/screenshot.png

// Get raw HTML for parsing
lov-fetch-website("https://example.com", "html")

// Fetch all formats
lov-fetch-website("https://tailwindcss.com", "markdown,html,screenshot")
```

**Fetched Content Structure:**
```
tmp://fetched-websites/
└── domain-timestamp/
    ├── content.md          # Markdown (if requested)
    ├── page.html          # Raw HTML (if requested)
    └── screenshot.png     # Screenshot (if requested)
```

**When to Use:**
- ✅ User references specific documentation URL
- ✅ Need to analyze page content in detail
- ✅ Design reference from existing website
- ✅ Extracting structured data from web pages
- ✅ Reading long-form content (articles, docs)

**Critical Rules:**
- ✅ Results stored in `tmp://fetched-websites/[domain-timestamp]/`
- ❌ Cannot access password-protected pages
- ❌ Cannot access localhost or private networks
- ✅ Respects robots.txt
- ✅ Markdown conversion preserves structure (headings, lists, code blocks)
- ✅ Screenshots captured at standard desktop viewport

---

## `lov-download-to-repo`

Download file from URL directly into project repository.

**Signature:**
```typescript
lov-download-to-repo(
  source_url: string,
  target_path: string
): void
```

**Parameters:**
- `source_url` (required): URL of file to download
  - Examples: `"https://example.com/logo.png"`, `"https://cdn.example.com/font.woff2"`
- `target_path` (required): Where to save in project
  - **Prefer `src/assets/`** for React component imports (ES6 modules)
  - **Use `public/`** for direct references in CSS/HTML/meta tags
  - Examples: `"src/assets/logo.png"`, `"public/images/hero.jpg"`, `"public/fonts/custom.woff2"`

**Returns:** Success message

**Usage:**
```typescript
// Download image to assets (React import)
lov-download-to-repo(
  "https://example.com/logo.png",
  "src/assets/logo.png"
)
// Then use: import logo from '@/assets/logo.png'

// Download to public (direct reference)
lov-download-to-repo(
  "https://example.com/hero.jpg",
  "public/images/hero.jpg"
)
// Then use in CSS: background-image: url('/images/hero.jpg')

// Download font
lov-download-to-repo(
  "https://fonts.example.com/custom-font.woff2",
  "public/fonts/custom-font.woff2"
)

// Download icon
lov-download-to-repo(
  "https://example.com/favicon.ico",
  "public/favicon.ico"
)

// Download library file
lov-download-to-repo(
  "https://unpkg.com/library@1.0.0/dist/library.min.js",
  "public/vendor/library.min.js"
)
```

**Asset Path Guidelines:**

**Use `src/assets/` when:**
- Importing in React components as ES6 modules
- Need bundler optimization (compression, hashing)
- Want type safety for assets
- Example: `import heroImage from '@/assets/hero.png'`

**Use `public/` when:**
- Referencing directly in CSS
- Using in HTML `<link>` or `<meta>` tags
- Serving static files at root level (favicon, robots.txt)
- Example: `<link rel="icon" href="/favicon.ico" />`

**Critical Rules:**
- ❌ **DO NOT** use for user-uploaded images in chat (follow image upload instructions)
- ✅ Downloaded files ready to use immediately
- ✅ Use for external assets (logos, fonts, libraries)
- ✅ Verify URL is accessible and file exists
- ✅ Check file type matches target path extension
- ⚠️ Large files (>10MB) may take time to download

**After Downloading (src/assets/):**
```typescript
// MUST import in component:
import logo from '@/assets/logo.png'

// Then use:
<img src={logo} alt="Logo" />
```

**After Downloading (public/):**
```typescript
// Reference directly (no import):
<img src="/images/logo.png" alt="Logo" />

// Or in CSS:
background-image: url('/images/hero.jpg');
```

---

## Workflow Patterns

### Research New Library

```typescript
// 1. Search for documentation and examples
websearch--web_code_search("React Hook Form validation with Zod")

// 2. Fetch official docs
lov-fetch-website("https://react-hook-form.com/get-started", "markdown")

// 3. Read and implement based on examples
```

### Implement External API

```typescript
// 1. Search for API documentation
websearch--web_code_search("Stripe Payment Intent API TypeScript implementation")

// 2. Fetch API reference
lov-fetch-website("https://stripe.com/docs/api/payment_intents", "markdown")

// 3. Implement based on documentation
```

### Add Design Assets

```typescript
// 1. Download logo
lov-download-to-repo(
  "https://client-website.com/logo.svg",
  "src/assets/logo.svg"
)

// 2. Download brand images
lov-download-to-repo(
  "https://client-website.com/hero.jpg",
  "public/images/hero.jpg"
)

// 3. Import and use
import logo from '@/assets/logo.svg'
```

### Research Current Best Practices

```typescript
// 1. Search for recent practices (use current year)
websearch--web_search("React best practices 2025")

// 2. Search for code examples
websearch--web_code_search("React Server Components data fetching patterns")

// 3. Fetch detailed guides
lov-fetch-website("https://react.dev/learn", "markdown")
```

---

## Best Practices

**Choose Right Search Tool:**
- **Technical code:** `websearch--web_code_search`
- **General info:** `websearch--web_search`
- **Specific page:** `lov-fetch-website`

**Always Check Current Date:**
When searching for best practices, frameworks, or tools, use the current year from instructions to get recent information.

**Download Assets Efficiently:**
- Use `src/assets/` for React imports
- Use `public/` for direct references
- Don't download user chat images with this tool

**Fetch Documentation Smartly:**
- Use markdown format for text content
- Add screenshot when design matters
- HTML format when need raw structure

**Search Queries:**
- Be specific about technology/framework
- Include version numbers when relevant
- Use `site:` to filter to quality sources
- Exclude terms with `-` when needed

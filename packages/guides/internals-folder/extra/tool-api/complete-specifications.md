# Complete Tool API Specifications

## All 31 Tools with Full Parameters

---

## File Operations (7 tools)

### `lov-view`
Read file contents with optional line range.

**Signature:**
```typescript
lov-view(file_path: string, lines?: string): string
```

**Parameters:**
- `file_path` (required): Path relative to project root or virtual filesystem
  - Examples: `"src/App.tsx"`, `"user-uploads://design.png"`, `"tool-results://scan.json"`
- `lines` (optional): Line ranges to read
  - Format: `"1-100"` or `"1-100, 200-300"`
  - Default: First 500 lines if not specified

**Returns:** File contents as string

**Usage:**
```typescript
// Read entire file (first 500 lines)
lov-view("src/components/Header.tsx")

// Read specific lines
lov-view("src/App.tsx", "1-50, 100-150")

// Read from virtual filesystem
lov-view("user-uploads://design.png")
lov-view("parsed-documents://doc-123/content.md")
```

**Rules:**
- ❌ NEVER read files already in `<current-code>` or `<useful-context>`
- ✅ Can read from virtual filesystems (tmp://, user-uploads://, parsed-documents://, tool-results://)
- ✅ Images display in chat when viewed

---

### `lov-write`
Create new file or completely overwrite existing file.

**Signature:**
```typescript
lov-write(file_path: string, content: string): void
```

**Parameters:**
- `file_path` (required): Path relative to project root
<!-- SUPABASE DISABLED:   - Examples: `"src/components/NewComponent.tsx"`, `"supabase/functions/api/index.ts"` -->
- `content` (required): Complete file content
  - For large files, use `// ... keep existing code` for unchanged sections

**Returns:** Success or error message

**Usage:**
```typescript
// Create new component
lov-write("src/components/Button.tsx", `
import React from 'react';

export const Button = ({ children }) => {
  return <button>{children}</button>;
};
`)

// Create edge function
<!-- SUPABASE DISABLED: lov-write("supabase/functions/hello/index.ts", ` -->
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  return new Response("Hello World");
});
`)
```

**Rules:**
- ⚠️ PREFER `lov-line-replace` for modifications to existing files
- ✅ Use for new files or complete rewrites
- ❌ NEVER use on read-only files (package.json, tsconfig.json, etc.)
- ✅ Use `// ... keep existing code` for large unchanged sections

---

### `lov-line-replace`
Modify specific lines in an existing file (PREFERRED for edits).

**Signature:**
```typescript
lov-line-replace(
  file_path: string,
  search: string,
  first_replaced_line: number,
  last_replaced_line: number,
  replace: string
): void
```

**Parameters:**
- `file_path` (required): Path to file being modified
- `search` (required): Content to find (can use ellipsis `...` for large sections)
- `first_replaced_line` (required): Starting line number (1-indexed)
- `last_replaced_line` (required): Ending line number (1-indexed)
- `replace` (required): New content to replace with

**Returns:** Success or error message

**Usage:**
```typescript
// Small replacement
lov-line-replace(
  "src/App.tsx",
  "const [count, setCount] = useState(0);",
  15,
  15,
  "const [count, setCount] = useState<number>(0);"
)

// Large replacement with ellipsis
lov-line-replace(
  "src/components/UserCard.tsx",
  `<div className="user-card">
  <img src={user.avatar} />
...
  </div>`,
  22,
  42,
  `<div className="user-card-enhanced">
  <UserAvatar user={user} />
  <UserDetails user={user} />
</div>`
)
```

**Rules:**
- ✅ PREFERRED method for editing existing files
- ✅ Use ellipsis `...` for sections >6 lines
- ✅ Include enough context before/after ellipsis for unique matching
- ⚠️ When multiple edits to same file: use ORIGINAL line numbers (not adjusted)

---

### `lov-search-files`
Regex-based search across project files.

**Signature:**
```typescript
lov-search-files(
  query: string,
  include_pattern: string,
  exclude_pattern?: string,
  case_sensitive?: boolean
): SearchResult[]
```

**Parameters:**
- `query` (required): Regex pattern to search for
  - Examples: `"useState\\("`, `"class=\\".*\\""`, `"TODO|FIXME"`
- `include_pattern` (required): Glob pattern for files to search
  - Examples: `"src/**"`, `"src/**/*.tsx"`, `"**/*.ts"`
- `exclude_pattern` (optional): Glob pattern for files to exclude
  - Examples: `"**/*.test.tsx"`, `"node_modules/**"`
- `case_sensitive` (optional): Whether to match case (default: false)

**Returns:** Array of matches with file paths, line numbers, and context

**Usage:**
```typescript
// Find all useState calls
lov-search-files("useState\\(", "src/**")

// Find TODO comments in TypeScript files
lov-search-files("TODO|FIXME", "src/**/*.ts")

// Find API_KEY references, exclude tests
lov-search-files("API_KEY", "src/**", "**/*.test.*")

// Case-sensitive search
lov-search-files("UserProfile", "src/**", undefined, true)
```

**Rules:**
- ✅ Use `\\` to escape special regex characters
- ✅ Results may be stored in `tool-results://` if very large
- ✅ Can search virtual filesystems: `"tool-results://**"`

---

### `lov-delete`
Delete a file from the project.

**Signature:**
```typescript
lov-delete(file_path: string): void
```

**Parameters:**
- `file_path` (required): Path to file to delete

**Returns:** Success or error message

**Usage:**
```typescript
// Delete old component
lov-delete("src/components/OldComponent.tsx")

// Delete unused utility
lov-delete("src/utils/deprecated.ts")
```

**Rules:**
- ⚠️ Destructive operation - file cannot be recovered except via version history
- ❌ CANNOT delete read-only files
- ✅ Update imports in other files after deleting

---

### `lov-rename`
Rename or move a file (REQUIRED for renaming - don't create new + delete old).

**Signature:**
```typescript
lov-rename(original_file_path: string, new_file_path: string): void
```

**Parameters:**
- `original_file_path` (required): Current file path
- `new_file_path` (required): New file path

**Returns:** Success or error message

**Usage:**
```typescript
// Rename file
lov-rename("src/components/Button.tsx", "src/components/PrimaryButton.tsx")

// Move file
lov-rename("src/utils/helper.ts", "src/lib/helper.ts")

// Rename and move
lov-rename("src/components/old/Button.tsx", "src/components/new/ActionButton.tsx")
```

**Rules:**
- ✅ MUST use this instead of create + delete
- ✅ Update all imports in other files after renaming
- ❌ CANNOT rename read-only files

---

### `lov-copy`
Copy a file to a new location.

**Signature:**
```typescript
lov-copy(source_file_path: string, destination_file_path: string): void
```

**Parameters:**
- `source_file_path` (required): Original file path (can be virtual filesystem)
- `destination_file_path` (required): Where to copy to

**Returns:** Success or error message

**Usage:**
```typescript
// Copy component for variation
lov-copy("src/components/Button.tsx", "src/components/IconButton.tsx")

// Copy from user uploads to project
lov-copy("user-uploads://logo.png", "public/images/logo.png")

// Copy parsed document images
lov-copy("parsed-documents://doc-123/images/diagram.png", "docs/architecture.png")
```

**Rules:**
- ✅ Useful for copying from virtual filesystems to project
- ✅ Can copy between directories
- ⚠️ If destination exists, it will be overwritten

---

## Backend Integration (6 tools)

<!-- SUPABASE DISABLED: ### `supabase--enable` -->
<!-- SUPABASE DISABLED: Enable Lovable Cloud (provisions Supabase backend). -->

**Signature:**
```typescript
<!-- SUPABASE DISABLED: supabase--enable(): void -->
```

**Parameters:** None

**Returns:** Success message with setup instructions

**Usage:**
```typescript
// Enable backend
<!-- SUPABASE DISABLED: supabase--enable() -->

// User must approve in UI → WAIT for confirmation
// After approval, backend is provisioned automatically
```

**Rules:**
- ⚠️ Requires user confirmation (human-in-the-loop)
- ✅ MUST enable before using database, auth, storage, edge functions
- ✅ Only call if backend not already enabled
- ✅ After enabling, educate user about Cloud features

**What Gets Provisioned:**
- PostgreSQL database
<!-- SUPABASE DISABLED: - Supabase Auth -->
- Storage buckets
- Edge functions runtime
- Realtime subscriptions
- Auto-generated types

---

### `secrets--add_secret`
Add secure environment variables (displays modal for user to enter values).

**Signature:**
```typescript
secrets--add_secret(secret_names: string[]): void
```

**Parameters:**
- `secret_names` (required): Array of secret keys to add
  - Examples: `["OPENAI_API_KEY"]`, `["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"]`

**Returns:** Confirmation when user completes entry

**Usage:**
```typescript
// Add single secret
secrets--add_secret(["OPENAI_API_KEY"])

// Add multiple secrets
secrets--add_secret(["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"])

// User enters values in secure modal → WAIT
// After entry, secrets available in edge functions via Deno.env.get()
```

**Rules:**
- ⚠️ Requires user interaction (human-in-the-loop)
- ✅ NEVER ask user to provide secret values in chat
<!-- SUPABASE DISABLED: - ✅ Secrets are encrypted and stored in Supabase -->
- ✅ Only accessible in edge functions, not frontend
- ❌ NEVER store secrets in frontend code (except publishable keys)

---

### `secrets--update_secret`
Update existing secret values.

**Signature:**
```typescript
secrets--update_secret(secret_names: string[]): void
```

**Parameters:**
- `secret_names` (required): Array of secret keys to update

**Returns:** Confirmation when user completes update

**Usage:**
```typescript
// Update API key
secrets--update_secret(["OPENAI_API_KEY"])

// Update multiple
secrets--update_secret(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"])
```

**Rules:**
- ⚠️ Requires user confirmation
- ✅ Only updates USER-CREATED secrets
<!-- SUPABASE DISABLED: - ❌ CANNOT update Supabase internal secrets -->

---

### `secrets--delete_secret`
Delete secrets (requires user confirmation).

**Signature:**
```typescript
secrets--delete_secret(secret_names: string[]): void
```

**Parameters:**
- `secret_names` (required): Array of secret keys to delete

**Returns:** Confirmation after user approves deletion

**Usage:**
```typescript
// Delete no longer needed API key
secrets--delete_secret(["OLD_API_KEY"])

// Delete multiple
secrets--delete_secret(["DEPRECATED_KEY_1", "DEPRECATED_KEY_2"])
```

**Rules:**
- ⚠️ Requires user confirmation (destructive operation)
- ✅ Only deletes USER-CREATED secrets
<!-- SUPABASE DISABLED: - ❌ CANNOT delete Supabase system secrets (SUPABASE_URL, SUPABASE_ANON_KEY, etc.) -->

---

### `stripe--enable_stripe`
Enable Stripe integration (prompts user for API key).

**Signature:**
```typescript
stripe--enable_stripe(): void
```

**Parameters:** None

**Returns:** Success after user enters Stripe keys

**Usage:**
```typescript
// Enable Stripe
stripe--enable_stripe()

// User enters keys in modal → WAIT
// After entry, Stripe SDK available in project
```

**Rules:**
- ⚠️ Requires user interaction
- ✅ Adds STRIPE_SECRET_KEY to secrets
- ✅ May add Stripe SDK dependency automatically

---

### `shopify--enable_shopify`
Enable Shopify integration.

**Signature:**
```typescript
shopify--enable_shopify(): void
```

**Parameters:** None

**Returns:** Success after user configures Shopify

**Usage:**
```typescript
// Enable Shopify
shopify--enable_shopify()

// User connects Shopify store → WAIT
```

**Rules:**
- ⚠️ Requires user interaction
- ✅ Sets up Shopify API access

---

## Debugging Tools (4 tools)

### `lov-read-console-logs`
Read browser console output (logs, warnings, errors).

**Signature:**
```typescript
lov-read-console-logs(search?: string): string
```

**Parameters:**
- `search` (optional): Filter logs by search term
  - Examples: `"error"`, `"warning"`, `"React"`

**Returns:** Console output (may be stored in tool-results:// if large)

**Usage:**
```typescript
// Get all console logs
lov-read-console-logs()

// Filter for errors only
lov-read-console-logs("error")

// Filter for specific component
lov-read-console-logs("UserProfile")
```

**Rules:**
- ✅ Use FIRST when debugging bugs
- ⚠️ Logs are snapshot from when user sent message (don't update during your response)
- ✅ Large outputs stored in tool-results://console-logs-[timestamp].txt
- ❌ CANNOT execute this more than once per turn (same logs)

---

### `lov-read-network-requests`
Read all network activity (API calls, responses, timing).

**Signature:**
```typescript
lov-read-network-requests(search?: string): NetworkRequest[]
```

**Parameters:**
- `search` (optional): Filter requests by URL or other criteria
  - Examples: `"api"`, `"error"`, `"/users"`

**Returns:** Array of network requests with headers, payloads, status codes

**Usage:**
```typescript
// Get all network requests
lov-read-network-requests()

// Filter for API calls only
lov-read-network-requests("api")

// Filter for failed requests
lov-read-network-requests("error")
```

**Rules:**
- ✅ Use when debugging API issues or performance
- ✅ Shows request/response headers, bodies, timing
- ✅ Large outputs stored in tool-results://network-requests-[timestamp].json
- ⚠️ Snapshot from when user sent message

---

### `project_debug--sandbox-screenshot`
Capture screenshot of the app sandbox.

**Signature:**
```typescript
project_debug--sandbox-screenshot(path: string): string
```

**Parameters:**
- `path` (required): Route to capture
  - Examples: `"/"`, `"/dashboard"`, `"/profile"`

**Returns:** Path to screenshot image

**Usage:**
```typescript
// Screenshot homepage
project_debug--sandbox-screenshot("/")

// Screenshot specific page
project_debug--sandbox-screenshot("/dashboard")

// Screenshot with query params
project_debug--sandbox-screenshot("/products?id=123")
```

**Rules:**
- ✅ Useful for visual debugging
- ⚠️ Cannot access auth-protected pages (shows login instead)
- ✅ Only captures top of page (standard viewport)
- ✅ Use to verify UI fixes worked

---

### `project_debug--sleep`
Wait for specified seconds (for async operations to complete).

**Signature:**
```typescript
project_debug--sleep(seconds: number): void
```

**Parameters:**
- `seconds` (required): How long to wait (max 60 seconds)

**Returns:** Success after waiting

**Usage:**
```typescript
// Wait for edge function deployment
project_debug--sleep(5)

// Wait for database operation
project_debug--sleep(3)
```

**Rules:**
- ⚠️ Use sparingly (adds latency)
- ✅ Useful for edge function deployments, cache invalidation
- ❌ Max 60 seconds

---

## Security Tools (4 tools)

### `security--run_security_scan`
Run comprehensive security audit on backend.

**Signature:**
```typescript
security--run_security_scan(): void
```

**Parameters:** None

**Returns:** Scan completion message (results via separate tool)

**Usage:**
```typescript
// Start security scan
security--run_security_scan()

// Takes 30-60 seconds
// Then retrieve results with security--get_security_scan_results()
```

**Rules:**
- ⚠️ Takes 30-60 seconds to complete
- ✅ Scans all tables, RLS policies, auth flows, input validation
- ✅ Results retrieved separately

---

### `security--get_security_scan_results`
Get findings from security scan.

**Signature:**
```typescript
security--get_security_scan_results(force: boolean): SecurityFindings
```

**Parameters:**
- `force` (required): Whether to return results even if scan is running
  - `true`: Return partial results if scan in progress
  - `false`: Wait for scan to complete

**Returns:** Security findings (may be in tool-results:// if large)

**Usage:**
```typescript
// Get results (wait if scanning)
security--get_security_scan_results(false)

// Get partial results immediately
security--get_security_scan_results(true)
```

**Rules:**
- ✅ Large results stored in tool-results://security-scan-[timestamp].json
- ✅ Contains findings by severity (error/warn/info)
- ✅ Includes SQL fixes and remediation steps

---

### `security--get_table_schema`
Get complete database schema (all tables, columns, policies).

**Signature:**
```typescript
security--get_table_schema(): DatabaseSchema
```

**Parameters:** None

**Returns:** Complete schema (may be in tool-results:// if large)

**Usage:**
```typescript
// Get full database schema
security--get_table_schema()

// Returns all tables, columns, types, indexes, RLS policies, functions
```

**Rules:**
- ✅ Large output stored in tool-results://table-schema-[timestamp].json
- ✅ Use when planning RLS policies or database changes

---

### `security--manage_security_finding`
Create, update, or delete security findings.

**Signature:**
```typescript
security--manage_security_finding(operations: FindingOperation[]): void
```

**Parameters:**
- `operations` (required): Array of operations to perform
  ```typescript
  interface FindingOperation {
    operation: "create" | "update" | "delete";
    internal_id?: string;  // Required for update/delete
    scanner_name?: string; // Optional, defaults to "agent_security"
    finding?: {            // Required for create, optional for update
      id: string;
      internal_id: string;
      name: string;
      description: string;
      level: "error" | "warn" | "info";
      details?: string;
      remediation_difficulty?: string;
      link?: string;
      ignore?: boolean;
      ignore_reason?: string;
    };
  }
  ```

**Returns:** Success message

**Usage:**
```typescript
// Delete resolved finding
security--manage_security_finding({
  operations: [{
    operation: "delete",
    internal_id: "missing_rls_users"
  }]
})

// Update unfixable finding
security--manage_security_finding({
  operations: [{
    operation: "update",
    internal_id: "complex_issue",
    finding: {
      remediation_difficulty: "high",
      details: "Cannot fix because [reason]. Requires [changes]."
    }
  }]
})

// Create new finding
security--manage_security_finding({
  operations: [{
    operation: "create",
    finding: {
      id: "NEW_SECURITY_ISSUE",
      internal_id: "unique_id",
      name: "Issue title",
      description: "Description",
      level: "error",
      remediation_difficulty: "medium"
    }
  }]
})
```

**Rules:**
- ✅ ALWAYS delete findings after fixing them
- ✅ Update findings that cannot be fixed with explanation
- ✅ Can batch multiple operations

---

## External Resources (4 tools)

### `websearch--web_search`
Search the web (Google) for information.

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
  - Examples: `"React 18 new features"`, `"Stripe API documentation 2025"`
  - Use `site:domain.com` to filter domains
  - Use `"exact phrase"` for exact matches
  - Use `-word` to exclude terms
- `numResults` (optional): Number of results (default: 5)
- `category` (optional): Filter results by category
  - Options: `"news"`, `"linkedin profile"`, `"pdf"`, `"github"`, `"personal site"`, `"financial report"`
- `links` (optional): Number of links to return per result
- `imageLinks` (optional): Number of image links per result

**Returns:** Array of search results with text content

**Usage:**
```typescript
// General search
websearch--web_search("React Server Components tutorial")

// Search specific domain
websearch--web_search("site:docs.lovable.dev authentication")

// Get more results
websearch--web_search("TypeScript best practices 2025", 10)

// Find GitHub repos
websearch--web_search("React form library", 5, "github")

// Get recent news
websearch--web_search("Next.js 15 release", 5, "news")
```

**Rules:**
- ✅ Use when user asks about recent events/docs beyond training cutoff
- ✅ Use when user references specific websites
- ❌ Don't use for general knowledge (waste of resources)
- ✅ Account for current date when searching (e.g., "2025" not "2024")

---

### `websearch--web_code_search`
Search technical documentation and code examples (optimized for coding).

**Signature:**
```typescript
websearch--web_code_search(query: string, tokensNum?: string): string
```

**Parameters:**
- `query` (required): Technical search query
<!-- SUPABASE DISABLED:   - Examples: `"React hook form validation"`, `"Supabase RLS policies examples"` -->
  - Be specific about tech/framework
  - Include language when relevant
- `tokensNum` (optional): Tokens to return
  - Options: `"dynamic"` (default) or number (50-100000)

**Returns:** Highly relevant code examples and technical context

**Usage:**
```typescript
// Find React patterns
websearch--web_code_search("React useCallback optimization patterns")

<!-- SUPABASE DISABLED: // Find Supabase examples -->
<!-- SUPABASE DISABLED: websearch--web_code_search("Supabase edge function streaming response") -->

// Find API documentation
websearch--web_code_search("Stripe Payment Intent API TypeScript")

// Get more comprehensive results
websearch--web_code_search("Next.js 14 app router data fetching", "1000")
```

**Rules:**
- ✅ ALWAYS use for technical information (not regular web_search)
- ✅ Searches GitHub, Stack Overflow, official docs, technical blogs
- ✅ Returns dense, relevant code snippets
- ✅ Use when implementing unfamiliar APIs/frameworks

---

### `lov-fetch-website`
Download webpage content (markdown, HTML, screenshot).

**Signature:**
```typescript
lov-fetch-website(url: string, formats: string): string[]
```

**Parameters:**
- `url` (required): Website URL to fetch
  - Examples: `"https://docs.lovable.dev/features/cloud"`, `"https://github.com/user/repo"`
- `formats` (required): Comma-separated format list
  - Options: `"markdown"`, `"html"`, `"screenshot"`
  - Examples: `"markdown"`, `"markdown,screenshot"`, `"markdown,html,screenshot"`

**Returns:** Paths to fetched content in tmp://fetched-websites/

**Usage:**
```typescript
// Fetch documentation
lov-fetch-website("https://docs.stripe.com/api/payment_intents", "markdown")

// Fetch with screenshot for design reference
lov-fetch-website("https://stripe.com/pricing", "markdown,screenshot")

// Get raw HTML
lov-fetch-website("https://example.com", "html")
```

**Rules:**
- ✅ Results stored in tmp://fetched-websites/[domain-timestamp]/
- ✅ Use when user references specific documentation
- ❌ Cannot access password-protected pages
- ❌ Cannot access localhost or private networks
- ✅ Respects robots.txt

---

### `lov-download-to-repo`
Download file from URL directly to project.

**Signature:**
```typescript
lov-download-to-repo(source_url: string, target_path: string): void
```

**Parameters:**
- `source_url` (required): URL of file to download
- `target_path` (required): Where to save in project
  - Prefer `src/assets/` for React imports
  - Use `public/` for CSS/HTML references

**Returns:** Success message

**Usage:**
```typescript
// Download image asset
lov-download-to-repo(
  "https://example.com/logo.png",
  "src/assets/logo.png"
)

// Download to public folder
lov-download-to-repo(
  "https://example.com/hero.jpg",
  "public/images/hero.jpg"
)
```

**Rules:**
- ✅ Prefer src/assets/ for React components (ES6 imports)
- ✅ Use public/ for CSS/HTML direct references
- ❌ Don't use for user-uploaded files (those are in user-uploads://)

---

## Dependencies (2 tools)

### `lov-add-dependency`
Install npm package.

**Signature:**
```typescript
lov-add-dependency(package: string): void
```

**Parameters:**
- `package` (required): npm package name with optional version
  - Examples: `"lodash@latest"`, `"zod@^3.20.0"`, `"@tanstack/react-query"`

**Returns:** Success message

**Usage:**
```typescript
// Add latest version
lov-add-dependency("axios@latest")

// Add specific version
lov-add-dependency("react-hook-form@^7.0.0")

// Add scoped package
lov-add-dependency("@radix-ui/react-dialog@latest")
```

**Rules:**
- ✅ ONLY way to modify package.json (read-only file)
- ✅ Always use @latest unless specific version needed
- ✅ Can add multiple in parallel

---

### `lov-remove-dependency`
Uninstall npm package.

**Signature:**
```typescript
lov-remove-dependency(package: string): void
```

**Parameters:**
- `package` (required): npm package name (no version)
  - Examples: `"lodash"`, `"moment"`, `"@types/node"`

**Returns:** Success message

**Usage:**
```typescript
// Remove package
lov-remove-dependency("moment")

// Remove type definitions
lov-remove-dependency("@types/lodash")
```

**Rules:**
- ✅ Remove unused dependencies to reduce bundle size
- ✅ Search project first to ensure not used
- ⚠️ May need to remove imports from code

---

## Image Generation (2 tools)

### `imagegen--generate_image`
Generate image from text prompt using AI.

**Signature:**
```typescript
imagegen--generate_image(
  prompt: string,
  target_path: string,
  width?: number,
  height?: number,
  model?: string
): void
```

**Parameters:**
- `prompt` (required): Text description of desired image
  - Examples: `"Hero image of sunset over mountains, 16:9 aspect ratio, ultra high resolution"`
- `target_path` (required): Where to save image
  - Prefer: `"src/assets/hero-image.jpg"`
- `width` (optional): Width in pixels (512-1920, multiple of 32)
  - Default: 1024
- `height` (optional): Height in pixels (512-1920, multiple of 32)
  - Default: 1024
- `model` (optional): Which AI model to use
  - Options: `"flux.schnell"` (default, fast), `"flux.dev"` (high quality, slow)

**Returns:** Success message

**Usage:**
```typescript
// Generate hero image
imagegen--generate_image(
  "Modern minimalist hero image with geometric shapes, 16:9, ultra high resolution",
  "src/assets/hero-image.jpg",
  1920,
  1080,
  "flux.dev"
)

// Generate small icon (use fast model)
imagegen--generate_image(
  "Simple user profile icon, circular, minimal",
  "src/assets/profile-icon.png",
  512,
  512,
  "flux.schnell"
)
```

**Rules:**
- ✅ Dimensions must be 512-1920 and multiples of 32
- ✅ Use flux.schnell for small/simple images (default)
- ✅ Use flux.dev for large/important images (hero, banners)
- ✅ Mention aspect ratio in prompt for best results
- ✅ MUST import generated images in code (ES6 imports)
- ❌ Don't replace user-uploaded images unless explicitly asked

---

### `imagegen--edit_image`
Edit or merge existing images using AI.

**Signature:**
```typescript
imagegen--edit_image(
  image_paths: string[],
  prompt: string,
  target_path: string
): void
```

**Parameters:**
- `image_paths` (required): Array of image paths to edit/merge
  - Single image: `["src/assets/photo.jpg"]`
  - Multiple images: `["src/assets/photo1.jpg", "src/assets/photo2.jpg"]`
- `prompt` (required): How to edit or merge
  - Edit examples: `"make it rainy"`, `"add snow"`, `"sunset lighting"`
  - Merge examples: `"blend these seamlessly"`, `"combine foreground of first with background of second"`
- `target_path` (required): Where to save result

**Returns:** Success message

**Usage:**
```typescript
// Edit single image
imagegen--edit_image(
  ["src/assets/landscape.jpg"],
  "add dramatic sunset lighting with orange sky",
  "src/assets/landscape-sunset.jpg"
)

// Merge multiple images
imagegen--edit_image(
  ["src/assets/background.jpg", "src/assets/character.png"],
  "place character in center of background, matching lighting",
  "src/assets/final-scene.jpg"
)

// Change weather
imagegen--edit_image(
  ["src/assets/photo.jpg"],
  "make it snowy winter scene",
  "src/assets/photo-winter.jpg"
)
```

**Rules:**
- ✅ Great for character/object consistency across scenes
- ✅ Use for tweaking existing images instead of regenerating
- ✅ Can work with user-uploaded images
- ✅ MUST import edited images in code

---

## Document Parsing (1 tool)

### `document--parse_document`
Extract content from PDFs, Office docs, audio files.

**Signature:**
```typescript
document--parse_document(file_path: string): string
```

**Parameters:**
- `file_path` (required): Path to document (usually in user-uploads://)
  - Supported: PDF, DOCX, PPTX, XLSX, MP3, WAV, M4A
  - Examples: `"user-uploads://requirements.pdf"`, `"user-uploads://meeting.mp3"`

**Returns:** Path to parsed content in parsed-documents://

**Usage:**
```typescript
// Parse PDF
document--parse_document("user-uploads://project-requirements.pdf")

// Results in: parsed-documents://project-requirements-[timestamp]/
//   - content.md (full text)
//   - page-*.png (page screenshots)
//   - images/ (extracted images)

// Parse audio (transcription)
document--parse_document("user-uploads://meeting-recording.mp3")

// Results in: parsed-documents://meeting-recording-[timestamp]/
//   - content.md (full transcription)
```

**Rules:**
- ✅ Maximum 50 pages for documents
- ✅ Performs OCR on scanned pages
- ✅ Extracts all embedded images
- ✅ Takes 30-60 seconds for large documents
- ❌ DON'T use for plain text files (use lov-view directly)
- ❌ DON'T use for source code files (use lov-view directly)
- ✅ Results stored in parsed-documents://

---

## Analytics (1 tool)

### `analytics--read_project_analytics`
Read production usage analytics.

**Signature:**
```typescript
analytics--read_project_analytics(
  startdate: string,
  enddate: string,
  granularity: string
): AnalyticsData
```

**Parameters:**
- `startdate` (required): Start date (RFC3339 or YYYY-MM-DD)
  - Examples: `"2025-01-01"`, `"2025-01-01T00:00:00Z"`
- `enddate` (required): End date (RFC3339 or YYYY-MM-DD)
  - Examples: `"2025-01-31"`, `"2025-01-31T23:59:59Z"`
- `granularity` (required): Data granularity
  - Options: `"hourly"`, `"daily"`

**Returns:** Analytics data (page views, unique visitors, etc.)

**Usage:**
```typescript
// Get daily analytics for January
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
```

**Rules:**
- ✅ Only for production apps
- ✅ Use when user asks about app usage/traffic
- ✅ Can help identify performance issues or popular features

---

## See Also

- **Execution Model:** How these tools are called in workflows
- **Workflows:** Decision trees showing when to use each tool
- **Prompt Patterns:** How tool calls are structured in AI instructions

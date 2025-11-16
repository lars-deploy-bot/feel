# File Operations Tools

7 tools for reading, writing, modifying, and managing project files.

---

## `lov-view`

Read file contents with optional line range selection.

**Signature:**
```typescript
lov-view(file_path: string, lines?: string): string
```

**Parameters:**
- `file_path` (required): Path relative to project root or virtual filesystem
  - Project files: `"src/App.tsx"`, `"package.json"`
  - Virtual: `"user-uploads://design.png"`, `"tool-results://scan.json"`, `"parsed-documents://doc-123/content.md"`
- `lines` (optional): Line ranges to read
  - Format: `"1-100"` or `"1-100, 200-300"`
  - Default: First 500 lines if not specified

**Returns:** File contents as string (images display in chat)

**Usage:**
```typescript
// Read entire file (first 500 lines)
lov-view("src/components/Header.tsx")

// Read specific lines for large files
lov-view("src/App.tsx", "1-50, 100-150")

// Read from virtual filesystems
lov-view("user-uploads://design.png")
lov-view("parsed-documents://doc-123/content.md")
lov-view("tool-results://security-scan.json")
```

**Critical Rules:**
- ❌ **NEVER** read files already in `<current-code>` or `<useful-context>`
- ✅ Can read from all virtual filesystems (tmp://, user-uploads://, parsed-documents://, tool-results://)
- ✅ Images automatically display in chat when viewed
- ✅ Default 500-line limit prevents token waste for large files

---

## `lov-write`

Create new file or completely overwrite existing file.

**Signature:**
```typescript
lov-write(file_path: string, content: string): void
```

**Parameters:**
- `file_path` (required): Path relative to project root
  - Examples: `"src/components/NewComponent.tsx"`, `"supabase/functions/api/index.ts"`
- `content` (required): Complete file content
  - Use `// ... keep existing code` for unchanged sections in large files

**Returns:** Success or error message

**Usage:**
```typescript
// Create new component
lov-write("src/components/Button.tsx", `
import React from 'react';

export const Button = ({ children, onClick }) => {
  return (
    <button className="btn-primary" onClick={onClick}>
      {children}
    </button>
  );
};
`)

// Create edge function
lov-write("supabase/functions/hello/index.ts", `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ message: "Hello World" }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
`)

// Use "keep existing" for large files
lov-write("src/App.tsx", `
import React from 'react';
import './App.css';

function App() {
  // ... keep existing code (all UI components)
  
  // Only adding new footer
  const Footer = () => (
    <footer>New Footer Component</footer>
  );
  
  return (
    <div className="App">
      // ... keep existing code (main content)
      <Footer />
    </div>
  );
}

export default App;
`)
```

**Critical Rules:**
- ⚠️ **PREFER** `lov-line-replace` for modifications to existing files
- ✅ Use for new files or complete rewrites only
- ❌ **NEVER** use on read-only files (package.json, tsconfig.json, .gitignore, etc.)
- ✅ Use `// ... keep existing code` for large unchanged sections (>5 lines)
- ✅ Create parallel writes when creating multiple new files

---

## `lov-line-replace`

Modify specific lines in an existing file. **PREFERRED METHOD** for all file edits.

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
- `search` (required): Content to find (use ellipsis `...` for large sections)
- `first_replaced_line` (required): Starting line number (1-indexed)
- `last_replaced_line` (required): Ending line number (1-indexed)
- `replace` (required): New content to replace with

**Returns:** Success or error message

**Usage:**
```typescript
// Small single-line replacement
lov-line-replace(
  "src/App.tsx",
  "const [count, setCount] = useState(0);",
  15,
  15,
  "const [count, setCount] = useState<number>(0);"
)

// Multi-line replacement
lov-line-replace(
  "src/components/Header.tsx",
  `<header>
  <h1>Welcome</h1>
  <nav>Navigation</nav>
</header>`,
  10,
  13,
  `<header className="site-header">
  <h1 className="site-title">Welcome to Our Site</h1>
  <nav className="main-nav">
    <Link to="/">Home</Link>
    <Link to="/about">About</Link>
  </nav>
</header>`
)

// Large replacement with ellipsis (>6 lines)
lov-line-replace(
  "src/components/UserCard.tsx",
  `<div className="user-card">
  <img src={user.avatar} alt="Avatar" />
  <h3>{user.name}</h3>
...
  <span>Status: {user.status}</span>
</div>`,
  22,
  42,
  `<div className="user-card-enhanced">
  <UserAvatar user={user} />
  <UserDetails user={user} />
  <UserStatus user={user} />
</div>`
)
```

**Critical Rules:**
- ✅ **PREFERRED** method for editing existing files (not lov-write)
- ✅ Use ellipsis `...` for sections >6 lines to reduce token usage
- ✅ Include 2-4 lines before and after ellipsis for unique context matching
- ⚠️ When making multiple edits to same file: **ALWAYS** use ORIGINAL line numbers (don't adjust)
- ✅ Validates that search content matches actual file content before replacement
- ❌ Cannot use on read-only files

---

## `lov-search-files`

Regex-based code search across project files with filtering.

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
  - Escape special chars with `\\`: `"useState\\("`, `"class=\\".*\\""`
  - Examples: `"TODO|FIXME"`, `"API_KEY"`, `"interface.*Props"`
- `include_pattern` (required): Glob pattern for files to include
  - Examples: `"src/**"`, `"src/**/*.tsx"`, `"**/*.{ts,tsx}"`
- `exclude_pattern` (optional): Glob pattern for files to exclude
  - Examples: `"**/*.test.tsx"`, `"node_modules/**"`, `"**/ui/**"`
- `case_sensitive` (optional): Whether to match case (default: false)

**Returns:** Array of matches with file paths, line numbers, and surrounding context

**Usage:**
```typescript
// Find all useState calls
lov-search-files("useState\\(", "src/**")

// Find TODO comments in TypeScript files only
lov-search-files("TODO|FIXME", "src/**/*.ts")

// Find API_KEY references, exclude tests
lov-search-files("API_KEY", "src/**", "**/*.test.*")

// Case-sensitive class name search
lov-search-files("UserProfile", "src/**", undefined, true)

// Find all props interfaces
lov-search-files("interface.*Props", "src/**/*.tsx")

// Search in virtual filesystems
lov-search-files("error", "tool-results://**")
```

**Critical Rules:**
- ✅ Use `\\` to escape special regex characters: `(`, `)`, `[`, `]`, `{`, `}`, `.`, `*`, `+`, `?`
- ✅ Results stored in `tool-results://` if very large
- ✅ Can search virtual filesystems: `"tool-results://**"`, `"parsed-documents://**"`
- ⚠️ Don't search already-viewed context (waste of resources)
- ✅ Use for finding all usages before refactoring

---

## `lov-delete`

Delete a file from the project permanently.

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

// Delete temporary files
lov-delete("src/temp-data.json")
```

**Critical Rules:**
- ⚠️ **DESTRUCTIVE** operation - file cannot be recovered except via version history
- ❌ **CANNOT** delete read-only files (package.json, tsconfig.json, etc.)
- ✅ **MUST** update imports in other files after deleting
- ✅ Search for usages before deleting to avoid breaking references
- ✅ Use `lov-search-files` first to find all imports of deleted file

---

## `lov-rename`

Rename or move a file. **REQUIRED** for renaming - never create new + delete old.

**Signature:**
```typescript
lov-rename(original_file_path: string, new_file_path: string): void
```

**Parameters:**
- `original_file_path` (required): Current file path
- `new_file_path` (required): New file path (can be different directory)

**Returns:** Success or error message

**Usage:**
```typescript
// Rename file in same directory
lov-rename("src/components/Button.tsx", "src/components/PrimaryButton.tsx")

// Move file to different directory
lov-rename("src/utils/helper.ts", "src/lib/helper.ts")

// Rename and move simultaneously
lov-rename("src/components/old/Button.tsx", "src/components/new/ActionButton.tsx")
```

**Critical Rules:**
- ✅ **MUST** use this instead of create + delete approach
- ✅ **MUST** update all imports in other files after renaming
- ❌ **CANNOT** rename read-only files
- ✅ Preserves file history (unlike delete + create)
- ✅ Use `lov-search-files` to find all imports before renaming

---

## `lov-copy`

Copy a file to a new location.

**Signature:**
```typescript
lov-copy(source_file_path: string, destination_file_path: string): void
```

**Parameters:**
- `source_file_path` (required): Original file path
  - Can be virtual filesystem: `"user-uploads://file.png"`
- `destination_file_path` (required): Where to copy to

**Returns:** Success or error message

**Usage:**
```typescript
// Copy component for variation
lov-copy("src/components/Button.tsx", "src/components/IconButton.tsx")

// Copy from user uploads to project
lov-copy("user-uploads://logo.png", "public/images/logo.png")

// Copy from parsed document
lov-copy("parsed-documents://doc-123/images/diagram.png", "docs/architecture.png")

// Copy configuration template
lov-copy("templates/config.template.ts", "src/config/app.config.ts")
```

**Critical Rules:**
- ✅ Primary use: Moving files from virtual filesystems to project
- ✅ Can copy from `user-uploads://`, `parsed-documents://`, `tmp://`
- ✅ Source and destination can be same or different filesystems
- ✅ Does not modify the original file
- ⚠️ If destination exists, it will be overwritten

---

## Workflow Patterns

**Reading files:**
1. Check `<useful-context>` first - never read files already provided
2. Use `lov-view` for files not in context
3. Use `lov-search-files` to discover relevant files when unsure

**Modifying files:**
1. **ALWAYS prefer** `lov-line-replace` for edits to existing files
2. Only use `lov-write` for new files or complete rewrites
3. Use ellipsis in `lov-line-replace` for large sections

**Renaming/deleting:**
1. Search for usages first with `lov-search-files`
2. Use `lov-rename` (never delete + create)
3. Update all imports after rename/delete

**Parallel operations:**
- Create multiple new files simultaneously with parallel `lov-write` calls
- Make multiple edits to different files with parallel `lov-line-replace` calls
- Never make sequential calls that can be parallelized

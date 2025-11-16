# Directory Operations Tools

1 tool for exploring project structure and discovering files.

---

## `lov-list-dir`

List all files and directories in a specified directory.

**Signature:**
```typescript
lov-list-dir(dir_path: string): string[]
```

**Parameters:**
- `dir_path` (required): Path to directory relative to project root
  - Examples: `"src"`, `"src/components"`, `"."` (project root)

**Returns:** Array of file and directory names with metadata

**Usage:**
```typescript
// List project root
lov-list-dir(".")

// List components directory
lov-list-dir("src/components")

// List UI components
lov-list-dir("src/components/ui")

// List edge functions
lov-list-dir("supabase/functions")

// List subdirectories
lov-list-dir("src/pages")
```

**Output Format:**
```
src/components/
├── Button.tsx (file, 2.4 KB)
├── Header.tsx (file, 3.1 KB)
├── ui/ (directory)
│   ├── button.tsx (file, 5.2 KB)
│   └── card.tsx (file, 4.8 KB)
└── layout/ (directory)
```

**Critical Rules:**
- ✅ Use to discover files when you don't know exact structure
- ✅ Shows both files and subdirectories
- ✅ Includes file sizes for files
- ⚠️ Does not recursively list subdirectories (list them separately)
- ✅ Use before creating new files to avoid conflicts
- ✅ Use to verify directory structure after refactoring

---

## Common Workflows

**Discovering project structure:**
```typescript
// 1. Start at root
lov-list-dir(".")

// 2. Explore src directory
lov-list-dir("src")

// 3. Check components organization
lov-list-dir("src/components")

// 4. View specific subdirectory
lov-list-dir("src/components/ui")
```

**Before creating new files:**
```typescript
// 1. Check if directory exists
lov-list-dir("src/components/features")

// 2. If not found, create file in existing directory
// 3. Avoid conflicts with existing files
```

**Finding edge functions:**
```typescript
// 1. List all functions
lov-list-dir("supabase/functions")

// 2. View specific function directory
lov-list-dir("supabase/functions/api")
```

**Verifying refactoring:**
```typescript
// After moving/renaming files:
lov-list-dir("src/components")  // Verify old location
lov-list-dir("src/lib")          // Verify new location
```

---

## Use Cases

**1. Unknown Project Structure:**
When starting work on unfamiliar project, use to map out structure before making changes.

**2. Before File Operations:**
Use before `lov-write`, `lov-rename`, or `lov-copy` to:
- Verify target directory exists
- Avoid filename conflicts
- Choose appropriate location

**3. After Refactoring:**
Verify that file moves/renames completed successfully and structure is clean.

**4. Finding Configuration:**
Locate configuration files and their organization:
```typescript
lov-list-dir(".")                    // Find root configs
lov-list-dir("src")                  // Find src-level configs
lov-list-dir("supabase")             // Find backend configs
```

**5. Discovering Features:**
Map out feature organization:
```typescript
lov-list-dir("src/features")
lov-list-dir("src/components")
lov-list-dir("src/pages")
```

# Virtual File Systems

## What Are Virtual File Systems?

These are **temporary storage locations** that exist only during AI execution. They store results from tool operations and are automatically cleaned up after the conversation ends.

## Why Virtual File Systems?

1. **Isolation**: Keep temporary data separate from your project
2. **Automatic Cleanup**: No clutter in your project
3. **Performance**: Fast access to tool results
4. **Security**: Parsed documents don't pollute your repo

## Available Virtual File Systems

```
tmp://                     → Temporary general storage
user-uploads://            → Files you upload to the chat
parsed-documents://        → Extracted content from PDFs, DOCX, etc.
tool-results://            → Output from tool executions
```

## Structure Examples

### `tmp://fetched-websites/`

When AI uses `alive-fetch-website(url, formats)`:

```
tmp://fetched-websites/
├── example-com-20250127-142301/
│   ├── content.md          → Markdown content
│   ├── content.html        → Raw HTML
│   └── screenshot.png      → Visual capture
├── docs-Alive-dev-20250127-142405/
│   └── content.md
└── ...
```

**Usage:**
```typescript
// AI calls:
alive-fetch-website("https://docs.Alive.dev/features/cloud", "markdown,screenshot")

// Results stored in:
// tmp://fetched-websites/docs-Alive-dev-[timestamp]/
```

### `user-uploads://`

When you upload files to chat:

```
user-uploads://
├── design-mockup.png       → Image you uploaded
├── requirements.pdf        → PDF you uploaded
├── data.csv               → CSV you uploaded
└── ...
```

**Usage:**
```typescript
// You upload design-mockup.png in chat

// AI can access:
alive-view("user-uploads://design-mockup.png")

// AI can copy to project:
alive-copy("user-uploads://design-mockup.png", "src/assets/mockup.png")
```

**Limits:**
- Max file size: 20MB per file
- Max files per message: 10 files

### `parsed-documents://`

When AI uses `document--parse_document(file_path)`:

```
parsed-documents://
├── project-requirements-20250127/
│   ├── content.md          → Extracted text
│   ├── page-1.png         → Page 1 screenshot
│   ├── page-2.png         → Page 2 screenshot
│   ├── images/
│   │   ├── diagram-1.png  → Extracted image
│   │   ├── logo.png       → Extracted image
│   │   └── chart.jpg      → Extracted image
│   └── metadata.json      → Document info
└── ...
```

**Usage:**
```typescript
// AI calls:
document--parse_document("user-uploads://requirements.pdf")

// Results:
// - Full text extraction (with OCR if needed)
// - All embedded images extracted
// - Page screenshots for reference
// - Preserves tables, structure
// - First 50 pages only
```

**What Gets Parsed:**
- ✅ PDF (complex formatting, images, tables)
- ✅ DOCX, PPTX, XLSX (Microsoft Office)
- ✅ MP3, WAV, M4A (audio transcription)
- ❌ Plain text (use `alive-view` directly)
- ❌ Source code (use `alive-view` directly)

### `tool-results://`

When tool output is too large for chat:

```
tool-results://
├── security-scan-20250127-142301.json
├── network-requests-20250127-142405.json
├── console-logs-20250127-142510.txt
└── ...
```

**Usage:**
```typescript
// AI calls:
security--run_security_scan()

// If output is huge, stored in:
// tool-results://security-scan-[timestamp].json

// AI can read full content:
alive-view("tool-results://security-scan-[timestamp].json")

// User sees: "Result truncated in chat. Full output in tool-results://..."
```

## Lifecycle

```
1. You start conversation
2. You upload file → Goes to user-uploads://
3. AI fetches website → Goes to tmp://fetched-websites/
4. AI parses document → Goes to parsed-documents://
5. AI runs security scan → Large output to tool-results://
6. You end conversation → All virtual filesystems CLEARED
```

## Accessing Virtual Files

### In AI Context

```typescript
// AI can read:
alive-view("user-uploads://design.png")
alive-view("parsed-documents://doc-123/content.md")
alive-view("tool-results://scan-456.json")

// AI can copy to project:
alive-copy("user-uploads://logo.png", "public/images/logo.png")
alive-copy("parsed-documents://doc-123/images/diagram.png", "src/assets/diagram.png")

// AI can search:
alive-search-files(query="error", include_pattern="tool-results://**")
```

### In Your Project

❌ **You cannot directly access virtual file systems**

Virtual file systems exist only in the AI's execution context. To use files:

1. **Images/Assets**: Ask AI to copy to your project
   ```
   "Copy that uploaded image to src/assets/"
   ```

2. **Parsed Content**: AI reads it and implements based on it
   ```
   "Read the requirements PDF and create the feature"
   ```

3. **Tool Results**: AI analyzes and fixes issues
   ```
   "Check the security scan and fix vulnerabilities"
   ```

## Examples in This Folder

```
virtual-fs/
├── README.md (this file)
├── tmp-fetched-websites/
│   └── example-structure.md
├── user-uploads/
│   └── example-structure.md
├── parsed-documents/
│   └── example-structure.md
└── tool-results/
    └── example-structure.md
```

## Common Questions

**Q: Where are these files stored?**  
A: In Alive's infrastructure, isolated per conversation. Not in your project.

**Q: Can I access them after the conversation ends?**  
A: No, they're automatically cleaned up. Copy important files to your project.

**Q: Why not just put everything in my project?**  
A: Keeps your repo clean. Temporary files shouldn't pollute version control.

**Q: How do I save a parsed document?**  
A: Ask AI: "Copy the extracted images to src/assets/" or "Implement based on the parsed requirements"

**Q: Can I see the virtual file system structure?**  
A: Not directly. Ask AI: "What files are in user-uploads://" and it can list them.

## See Also

- **File Upload Limits**: Max 20MB per file, 10 files per message
- **Document Parsing**: First 50 pages only
- **Tool Results**: Automatically created when output is large

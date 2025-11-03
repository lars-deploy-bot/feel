# File Upload and Parsing Guide

## Upload Constraints

Alive has specific limits for file uploads in the chat interface:

### Size and Quantity Limits
- **Maximum file size**: 20MB per individual file
- **Maximum files per message**: 10 files at once
- **Total message size**: Subject to reasonable limits

These limits ensure optimal performance and prevent system overload.

## File Type Handling Strategy

Different file types require different handling approaches. Using the correct method is crucial for efficiency and accuracy.

### Text-Based Files: Use `lov-view` Directly

**When to use**: Any file you can open and read in a standard text editor.

**File types include**:
- Plain text: `.txt`, `.md`, `.log`, `README`
- Source code: `.js`, `.ts`, `.tsx`, `.py`, `.go`, `.java`, `.cpp`, `.html`, `.css`
- Configuration: `.json`, `.yaml`, `.yml`, `.toml`, `.env`, `.ini`
- Data formats: `.csv`, `.xml`, `.sql`
- Build files: `Dockerfile`, `.gitignore`, `Makefile`

**Why this matters**: 
- Text files load instantly with `lov-view`
- No parsing overhead required
- Content is immediately available
- **Never use `document--parse_document` for text files** - it's wasteful and slow

**Example**:
```typescript
// ✅ Correct for text files
lov-view("src/components/Header.tsx")

// ❌ Wrong - don't parse text files
document--parse_document("src/components/Header.tsx")
```

### Binary Documents: Use `document--parse_document`

**When to use**: Complex documents with formatting, structure, or embedded content.

**File types include**:
- PDF files (especially with tables, images, forms)
- Microsoft Office: `.docx`, `.xlsx`, `.pptx`
- Legacy Office: `.doc`, `.xls`, `.ppt`
- Audio files: `.mp3`, `.wav`, `.m4a` (provides transcription)
- OpenDocument: `.odt`, `.ods`, `.odp`

**Why this matters**:
- Preserves document structure and formatting
- Extracts embedded images
- Performs OCR on scanned content
- Converts tables to readable format
- Transcribes audio to text

**Example**:
```typescript
// ✅ Correct for binary documents
document--parse_document("reports/quarterly-analysis.pdf")
document--parse_document("audio/meeting-recording.mp3")
```

### Images: Use `lov-view` to Display

**Supported formats**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg`

**Example**:
```typescript
// ✅ Display images
lov-view("designs/mockup.png")
```

**Special case - HEIC format**:
- Not supported in browsers
- Ask users to convert to JPG or PNG
- Provide clear guidance on conversion

### Unsupported Binary Files

**File types**:
- Executables: `.exe`, `.dll`, `.so`
- Archives: `.zip`, `.rar`, `.7z`, `.tar`
- Video files: `.mp4`, `.mov`, `.avi` (not yet supported)
- Proprietary formats: Various specialized file types

**Important rule**: **Be transparent with users**
- Clearly inform when you cannot read a file's contents
- Explain limitations honestly
- You can still use the file in projects (copy, move, reference)
- You just cannot analyze what's inside

## Document Parsing Details

### Capabilities

The `document--parse_document` tool provides:

**Content Extraction**:
- Full text extraction with structure preservation
- Heading and paragraph detection
- List and table extraction
- Footnote and metadata parsing

**Image Handling**:
- Extracts all embedded images
- Saves to `parsed-documents://` virtual directory
- Provides image paths for further use
- Performs OCR on image-based text

**Page Processing**:
- Captures full page screenshots
- Processes up to 50 pages maximum
- Maintains page order and structure
- Handles multi-column layouts

### Limitations

**Page Limit**:
- Only first **50 pages** are processed
- Longer documents are truncated
- Plan accordingly for large files

**Processing Time**:
- Large documents may take 30-60 seconds
- Complex layouts take longer
- Multiple images increase processing time

**Memory Constraints**:
- Very large PDFs may fail
- Consider splitting massive documents
- Optimize file size before upload

### Handling Truncated Results

When working with parsed content:

**Understanding truncation**:
- Chat display may cut off long results
- This is for UI readability only
- **Complete content is ALWAYS saved** to `tool-results://` file

**Best practices**:
```typescript
// 1. Parse the document
const result = document--parse_document("large-file.pdf")

// 2. If display is truncated, view full results
lov-view("tool-results://parse-result-xyz.txt")

// 3. Search for specific content
lov-search("specific keyword", "tool-results://parse-result-xyz.txt")
```

**Important**: Never re-run `parse_document` in the same conversation turn. The result is already available - just access the saved file.

## Practical Workflows

### Scenario 1: Code Import

```typescript
// User uploads: config.json, App.tsx, utils.ts

// ✅ Correct approach - view all text files
lov-view("user-uploads://config.json")
lov-view("user-uploads://App.tsx") 
lov-view("user-uploads://utils.ts")

// Then copy to project
lov-copy("user-uploads://config.json", "src/config.json")
```

### Scenario 2: Requirements Document

```typescript
// User uploads: requirements.pdf (150 pages)

// ✅ Parse (first 50 pages)
document--parse_document("user-uploads://requirements.pdf")

// View full results
lov-view("tool-results://requirements-parsed.txt")

// Extract key sections
lov-search("authentication", "tool-results://requirements-parsed.txt")
```

### Scenario 3: Design Assets

```typescript
// User uploads: logo.svg, hero.png, icon.webp

// ✅ View images
lov-view("user-uploads://logo.svg")
lov-view("user-uploads://hero.png")

// Copy to project assets
lov-copy("user-uploads://logo.svg", "src/assets/logo.svg")
```

### Scenario 4: Meeting Recording

```typescript
// User uploads: team-meeting.mp3

// ✅ Parse audio for transcription
document--parse_document("user-uploads://team-meeting.mp3")

// Access transcription
lov-view("tool-results://meeting-transcription.txt")
```

## Error Handling

### File Too Large
```
Error: File exceeds 20MB limit
Solution: Ask user to compress or split the file
```

### Too Many Files
```
Error: Maximum 10 files per message
Solution: Upload in multiple messages
```

### Unsupported Format
```
Error: Cannot parse .xyz format
Solution: Ask for conversion to supported format
```

### Parse Timeout
```
Error: Document parsing timeout
Solution: Try with smaller file or fewer pages
```

## Best Practices

### Efficiency
- Always choose the right tool for the file type
- Never parse text files
- Batch related files in one message
- Use search on parsed results instead of re-parsing

### User Communication
- Clearly explain what you can and cannot read
- Provide file size before requesting uploads
- Suggest alternative formats when needed
- Set expectations for processing time

### Organization
- Copy uploaded files to appropriate project locations
- Use descriptive paths
- Clean up temporary files when done
- Maintain clear file structure

---

**Key Principle**: Choose the simplest tool that works. Text files need `lov-view`, complex documents need parsing, and everything else should be handled transparently with users.

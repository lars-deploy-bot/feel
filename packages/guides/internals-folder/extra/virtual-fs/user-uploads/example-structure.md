# user-uploads:// Structure

## What Goes Here

Files that YOU upload to the Alive chat interface.

## Example Structure

```
user-uploads://
├── design-mockup.png           [Image: 2.3 MB]
├── project-requirements.pdf    [PDF: 1.8 MB]
├── api-schema.json            [JSON: 45 KB]
├── sample-data.csv            [CSV: 120 KB]
├── logo.svg                   [SVG: 12 KB]
├── architecture-diagram.png   [Image: 5.1 MB]
└── audio-recording.mp3        [Audio: 8.7 MB]
```

## How Files Get Here

1. **You click the upload button** in Alive chat
2. **Select files** from your computer (max 10 files, 20MB each)
3. **Files upload** to `user-uploads://`
4. **AI can now access** them via `alive-view("user-uploads://filename.ext")`

## What AI Can Do With These Files

### Text Files (TXT, MD, JSON, CSV, etc.)
```typescript
// Read directly
alive-view("user-uploads://requirements.txt")
alive-view("user-uploads://config.json")

// Copy to project
alive-copy("user-uploads://config.json", "src/config/default.json")
```

### Images (PNG, JPG, SVG, WEBP)
```typescript
// View (displays in chat)
alive-view("user-uploads://logo.png")

// Copy to project
alive-copy("user-uploads://logo.png", "public/images/logo.png")
alive-copy("user-uploads://hero.jpg", "src/assets/hero.jpg")
```

### Documents (PDF, DOCX, PPTX, XLSX)
```typescript
// Parse to extract content
document--parse_document("user-uploads://requirements.pdf")

// Results go to: parsed-documents://requirements-[timestamp]/
// - content.md (full text)
// - images/ (extracted images)
// - page-*.png (page screenshots)
```

### Audio (MP3, WAV, M4A)
```typescript
// Parse to transcribe
document--parse_document("user-uploads://meeting-recording.mp3")

// Results go to: parsed-documents://meeting-recording-[timestamp]/
// - content.md (full transcription)
```

### Source Code Files
```typescript
// Read directly (no parsing needed)
alive-view("user-uploads://legacy-component.tsx")

// Copy to project
alive-copy("user-uploads://legacy-component.tsx", "src/components/Legacy.tsx")
```

## Example Workflow

### Scenario: User Uploads Design Mockup

```
1. User uploads: design-mockup.png

2. AI receives notification:
   "New file in user-uploads://design-mockup.png"

3. User asks: "Implement this design"

4. AI reads:
   alive-view("user-uploads://design-mockup.png")

5. AI sees the image and implements:
   alive-write("src/pages/Landing.tsx", component_matching_design)

6. AI optionally copies image to project:
   alive-copy("user-uploads://design-mockup.png", "docs/design-reference.png")
```

## Limits

- **Max file size**: 20 MB per file
- **Max files per message**: 10 files
- **Supported formats**: 
  - Text: TXT, MD, JSON, XML, CSV, YAML, etc.
  - Images: PNG, JPG, WEBP, SVG, GIF
  - Documents: PDF, DOCX, PPTX, XLSX
  - Audio: MP3, WAV, M4A
  - Code: JS, TS, TSX, PY, HTML, CSS, etc.

## Common Patterns

### Upload → Copy Pattern
```
User: [uploads logo.png]
User: "Add this logo to the header"

AI: alive-copy("user-uploads://logo.png", "src/assets/logo.png")
AI: alive-line-replace("src/components/Header.tsx", add_logo_import)
```

### Upload → Parse → Implement Pattern
```
User: [uploads requirements.pdf]
User: "Build the features described in this PDF"

AI: document--parse_document("user-uploads://requirements.pdf")
AI: [reads parsed content from parsed-documents://]
AI: [implements features based on requirements]
```

### Upload → Reference Pattern
```
User: [uploads api-schema.json]
User: "Generate TypeScript types for this API"

AI: alive-view("user-uploads://api-schema.json")
AI: alive-write("src/types/api.ts", generated_types)
```

## Cleanup

- Files persist **only for the current conversation**
- When you close the chat or start a new conversation: **DELETED**
- To keep files: Ask AI to copy them to your project

## See Also

- **Parsed Documents**: See `parsed-documents/example-structure.md`
- **File Limits**: Max 20MB, 10 files per message
- **Document Parsing**: First 50 pages for PDFs/Office docs

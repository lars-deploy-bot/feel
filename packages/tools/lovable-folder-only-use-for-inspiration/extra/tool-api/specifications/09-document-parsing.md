# Document Parsing Tools

1 tool for extracting content from documents and audio files.

---

## `document--parse_document`

Extract text, images, and perform OCR on PDFs, Office documents, and transcribe audio files.

**Signature:**
```typescript
document--parse_document(file_path: string): string
```

**Parameters:**
- `file_path` (required): Path to document (usually in `user-uploads://`)
  - **Supported formats:**
    - **Documents:** PDF, DOCX (Word), PPTX (PowerPoint), XLSX (Excel)
    - **Audio:** MP3, WAV, M4A, FLAC, OGG
  - Examples: `"user-uploads://requirements.pdf"`, `"user-uploads://meeting.mp3"`, `"user-uploads://presentation.pptx"`

**Returns:** Path to parsed content directory in `parsed-documents://[filename-timestamp]/`

**Usage:**

### Parse PDF
```typescript
// Parse PDF document
document--parse_document("user-uploads://project-requirements.pdf")

// Creates: parsed-documents://project-requirements-20251114-120000/
//   ├── content.md           # Full text content
//   ├── page-1.png          # Screenshot of page 1
//   ├── page-2.png          # Screenshot of page 2
//   └── images/
//       ├── diagram-1.png   # Extracted image 1
//       └── chart-1.png     # Extracted image 2
```

### Parse Word Document
```typescript
// Parse DOCX
document--parse_document("user-uploads://specification.docx")

// Creates: parsed-documents://specification-20251114-120000/
//   ├── content.md          # Full text with formatting
//   └── images/            # Embedded images
//       └── logo.png
```

### Parse PowerPoint
```typescript
// Parse PPTX presentation
document--parse_document("user-uploads://pitch-deck.pptx")

// Creates: parsed-documents://pitch-deck-20251114-120000/
//   ├── content.md          # Text from all slides
//   ├── slide-1.png        # Screenshot of slide 1
//   ├── slide-2.png        # Screenshot of slide 2
//   └── images/            # Extracted images
```

### Parse Excel
```typescript
// Parse XLSX spreadsheet
document--parse_document("user-uploads://data.xlsx")

// Creates: parsed-documents://data-20251114-120000/
//   └── content.md          # Tables converted to markdown
```

### Transcribe Audio
```typescript
// Transcribe audio recording
document--parse_document("user-uploads://meeting-recording.mp3")

// Creates: parsed-documents://meeting-recording-20251114-120000/
//   └── content.md          # Full transcription with timestamps
```

**Output Structure:**

### Document Output
```
parsed-documents://[filename-timestamp]/
├── content.md              # Extracted text content
├── page-*.png             # Page screenshots (PDF/PPTX)
└── images/                # Extracted/embedded images
    ├── image-1.png
    ├── image-2.png
    └── diagram-1.png
```

### Audio Output
```
parsed-documents://[filename-timestamp]/
└── content.md              # Transcription with timestamps
```

**Content.md Format:**

**For documents:**
```markdown
# Document Title

## Section 1

Extracted text content preserved with formatting.

- Lists are maintained
- Bullet points preserved

## Section 2

Tables converted to markdown:

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |

![Extracted Image](images/diagram-1.png)
```

**For audio:**
```markdown
# Transcription: meeting-recording.mp3

[00:00:00] Speaker 1: Welcome everyone to today's meeting...

[00:00:15] Speaker 2: Thanks for having me. Let's start with...

[00:05:30] Speaker 1: Great points. To summarize...
```

**Features:**

**OCR (Optical Character Recognition):**
- Automatically performed on scanned PDFs
- Extracts text from images in documents
- Handles handwriting (with varying accuracy)

**Structure Preservation:**
- Maintains headings hierarchy
- Preserves lists and bullet points
- Converts tables to markdown format
- Keeps image references

**Image Extraction:**
- Extracts all embedded images
- Creates page screenshots for PDFs/PPTX
- Images saved in `images/` subdirectory
- Referenced in content.md

**Audio Transcription:**
- Accurate speech-to-text
- Speaker detection (when possible)
- Timestamps for navigation
- Supports multiple languages

**Use Cases:**

### 1. Project Requirements
```typescript
// User uploads requirements PDF
document--parse_document("user-uploads://requirements.pdf")

// Read extracted content
lov-view("parsed-documents://requirements-20251114-120000/content.md")

// Implement features based on requirements
```

### 2. Design Specifications
```typescript
// Parse design document
document--parse_document("user-uploads://design-spec.pdf")

// View extracted images
lov-view("parsed-documents://design-spec-20251114-120000/images/mockup-1.png")

// Copy images to project
lov-copy(
  "parsed-documents://design-spec-20251114-120000/images/mockup-1.png",
  "docs/design/mockup-1.png"
)
```

### 3. Meeting Notes
```typescript
// Transcribe meeting
document--parse_document("user-uploads://meeting.mp3")

// Read transcription
lov-view("parsed-documents://meeting-20251114-120000/content.md")

// Extract action items and implement features
```

### 4. Data Import
```typescript
// Parse Excel spreadsheet
document--parse_document("user-uploads://data.xlsx")

// Read converted markdown tables
lov-view("parsed-documents://data-20251114-120000/content.md")

// Use data to populate database
```

### 5. Technical Documentation
```typescript
// Parse technical PDF
document--parse_document("user-uploads://api-docs.pdf")

// Read content
lov-view("parsed-documents://api-docs-20251114-120000/content.md")

// Implement based on documentation
```

**Critical Rules:**
- ✅ Maximum **50 pages** for documents (performance limit)
- ✅ Performs OCR automatically on scanned/image PDFs
- ✅ Extracts all embedded images
- ✅ Takes 30-60 seconds for large documents
- ❌ **DON'T** use for plain text files (use `lov-view` directly instead)
- ❌ **DON'T** use for source code files (use `lov-view` directly instead)
- ❌ **DON'T** use for images (use `lov-view` to display directly)
- ✅ Results stored in `parsed-documents://[filename-timestamp]/`
- ✅ Content persists for entire session
- ✅ Can reference extracted images in project

**Performance:**
- **Small documents** (<10 pages): 10-20 seconds
- **Medium documents** (10-30 pages): 30-45 seconds
- **Large documents** (30-50 pages): 45-60 seconds
- **Audio files:** ~1-2 seconds per minute of audio

---

## Workflow Patterns

### Process Requirements Document
```typescript
// 1. Parse uploaded PDF
document--parse_document("user-uploads://requirements.pdf")

// 2. Read extracted content
lov-view("parsed-documents://requirements-20251114-120000/content.md")

// 3. Extract key requirements

// 4. Implement features based on requirements

// 5. Reference design images if included
lov-copy(
  "parsed-documents://requirements-20251114-120000/images/wireframe.png",
  "docs/wireframe.png"
)
```

### Transcribe and Implement from Meeting
```typescript
// 1. Transcribe meeting recording
document--parse_document("user-uploads://client-meeting.mp3")

// 2. Read transcription
lov-view("parsed-documents://client-meeting-20251114-120000/content.md")

// 3. Identify action items and feature requests

// 4. Implement requested features

// 5. Document decisions made in meeting
```

### Extract Data from Spreadsheet
```typescript
// 1. Parse Excel file
document--parse_document("user-uploads://product-data.xlsx")

// 2. Read converted markdown tables
lov-view("parsed-documents://product-data-20251114-120000/content.md")

// 3. Create database schema based on data structure

// 4. Populate database with extracted data
```

### Use Design Assets
```typescript
// 1. Parse design document
document--parse_document("user-uploads://design-guide.pdf")

// 2. List extracted images
lov-list-dir("parsed-documents://design-guide-20251114-120000/images")

// 3. Copy needed assets to project
lov-copy(
  "parsed-documents://design-guide-20251114-120000/images/logo.png",
  "src/assets/logo.png"
)

// 4. Implement design based on specifications
```

---

## Best Practices

**Check File Type First:**
```typescript
// ✅ Use parse_document for:
- PDFs
- Word documents (DOCX)
- PowerPoint (PPTX)
- Excel (XLSX)
- Audio files (MP3, WAV, etc.)

// ❌ Don't use for:
- Plain text files (.txt) - use lov-view
- Source code (.js, .ts, etc.) - use lov-view
- Images (.png, .jpg) - use lov-view (displays directly)
- JSON/CSV - use lov-view
```

**Handle Large Documents:**
```typescript
// For 50+ page documents:
// 1. Ask user to split into smaller files
// 2. Or parse most relevant sections separately
// 3. Maximum 50 pages processed
```

**Use Extracted Images:**
```typescript
// Don't just read about images in content.md
// Actually copy and use them in the project

// 1. Parse document
document--parse_document("user-uploads://design.pdf")

// 2. List extracted images
lov-list-dir("parsed-documents://design-20251114-120000/images")

// 3. Copy to project
lov-copy(
  "parsed-documents://design-20251114-120000/images/mockup.png",
  "src/assets/mockup.png"
)

// 4. Use in code
import mockup from '@/assets/mockup.png'
```

**Audio Transcriptions:**
```typescript
// Use timestamps to find specific topics
// Search transcription for keywords
lov-search-files("feature request", "parsed-documents://**")

// Extract action items systematically
// Look for phrases like "we need to", "action item", "todo"
```

**Performance Considerations:**
```typescript
// Large document parsing takes time
// Set expectations with user
// "Parsing your 40-page document, this will take about 45 seconds..."

// Then wait for completion before accessing results
project_debug--sleep(45)
```

**Verify Extraction Quality:**
```typescript
// After parsing, quickly scan content.md
// Check if OCR was needed and worked well
// For poor quality scans, warn user that accuracy may be lower
```

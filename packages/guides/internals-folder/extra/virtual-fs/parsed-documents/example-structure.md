# parsed-documents:// Structure

## What Goes Here

Extracted content from documents after AI uses `document--parse_document()`.

## Example Structure

```
parsed-documents://
├── requirements-20250127-142301/
│   ├── content.md                 [Full extracted text with structure]
│   ├── metadata.json              [Document info: pages, size, type]
│   ├── page-1.png                 [Screenshot of page 1]
│   ├── page-2.png                 [Screenshot of page 2]
│   ├── page-3.png                 [Screenshot of page 3]
│   └── images/
│       ├── diagram-architecture.png   [Extracted from document]
│       ├── logo-company.png          [Extracted from document]
│       └── chart-revenue.jpg         [Extracted from document]
│
├── presentation-20250127-143015/
│   ├── content.md                 [All slide text]
│   ├── metadata.json
│   ├── slide-1.png
│   ├── slide-2.png
│   └── images/
│       ├── product-screenshot.png
│       └── team-photo.jpg
│
└── meeting-audio-20250127-144520/
    ├── content.md                 [Full transcription]
    └── metadata.json              [Duration, format, etc.]
```

## How Files Get Here

1. **User uploads document** → Goes to `user-uploads://`
2. **AI calls** `document--parse_document("user-uploads://doc.pdf")`
3. **Lovable's parser**:
   - Extracts all text (preserves structure)
   - Performs OCR on images/scanned pages
   - Extracts embedded images
   - Takes screenshots of each page
   - Transcribes audio if MP3/WAV
4. **Results stored** in `parsed-documents://doc-[timestamp]/`

## What Gets Parsed

### Documents (PDF, DOCX, PPTX, XLSX)
```
Input:  user-uploads://project-plan.pdf (25 pages)
Output: parsed-documents://project-plan-[timestamp]/
        ├── content.md         → Full text with headers, lists, tables
        ├── page-1.png         → Visual reference
        ├── page-2.png
        ├── ...
        ├── page-25.png
        └── images/
            ├── gantt-chart.png    → Extracted diagram
            └── team-org.png       → Extracted org chart
```

### Audio Files (MP3, WAV, M4A)
```
Input:  user-uploads://meeting-recording.mp3 (45 minutes)
Output: parsed-documents://meeting-recording-[timestamp]/
        ├── content.md         → Full transcription with timestamps
        └── metadata.json      → Duration, format, size
```

### Plain Text Files
```
NOT PARSED via document--parse_document()

Use lov-view() directly:
lov-view("user-uploads://notes.txt")
lov-view("user-uploads://code.tsx")
```

## Parsing Limits

- **Maximum pages**: 50 pages (for PDF/Office docs)
- **Processing time**: 30-60 seconds for large documents
- **OCR**: Automatically performed on scanned pages and embedded images
- **Image extraction**: All embedded images extracted

## Example: content.md Structure

```markdown
# Project Requirements Document

## 1. Executive Summary

The project aims to build a task management system with the following key features:
- User authentication and authorization
- Real-time task updates
- Team collaboration features
- Mobile-responsive design

## 2. Technical Architecture

[Diagram: Architecture Overview - see images/diagram-architecture.png]

The system will use the following stack:
- Frontend: React with TypeScript
<!-- SUPABASE DISABLED: - Backend: Supabase (PostgreSQL + Edge Functions) -->
<!-- SUPABASE DISABLED: - Authentication: Supabase Auth -->
<!-- SUPABASE DISABLED: - Real-time: Supabase Realtime -->

## 3. Database Schema

| Table | Columns | Description |
|-------|---------|-------------|
| users | id, email, name, avatar_url | User accounts |
| tasks | id, title, status, user_id | Task records |
| teams | id, name, owner_id | Team groups |

[Chart: Database ERD - see images/chart-erd.png]

## 4. Features

### 4.1 User Management
- Sign up with email/password
- Email verification
- Password reset flow
- Profile management

### 4.2 Task Management
...

## 5. Timeline

Week 1-2: Setup and authentication
Week 3-4: Core task features
Week 5-6: Team collaboration
Week 7-8: Polish and testing

[Gantt Chart - see images/gantt-chart.png]
```

## How AI Uses Parsed Documents

### Read the Content
```typescript
// AI automatically reads content.md
const content = await lov-view("parsed-documents://requirements-123/content.md")

// AI can now implement features based on requirements
```

### Extract Images to Project
```typescript
// Copy extracted diagrams to project
lov-copy(
  "parsed-documents://requirements-123/images/diagram-architecture.png",
  "docs/architecture.png"
)

// Use in documentation or UI
lov-line-replace("README.md", add_architecture_diagram)
```

### Reference Page Screenshots
```typescript
// Look at specific page
lov-view("parsed-documents://requirements-123/page-5.png")

// Implement feature shown on that page
```

## Example Workflow

### Scenario: User Uploads Requirements PDF

```
1. User uploads: project-requirements.pdf (38 pages)

2. User asks: "Read this PDF and implement the features"

3. AI calls:
   document--parse_document("user-uploads://project-requirements.pdf")

4. Parser creates:
   parsed-documents://project-requirements-20250127-142301/
   ├── content.md (full text, structured)
   ├── page-1.png ... page-38.png
   └── images/
       ├── mockup-dashboard.png
       ├── mockup-login.png
       └── diagram-flow.png

5. AI reads:
   lov-view("parsed-documents://project-requirements-20250127-142301/content.md")

6. AI extracts key requirements:
   - Feature list
   - Technical stack
   - Design mockups
   - Database schema

7. AI implements features:
   lov-write("src/pages/Dashboard.tsx", ...)
   lov-write("src/components/Login.tsx", ...)
   [creates database schema SQL]

8. AI copies mockups for reference:
   lov-copy("parsed-documents://.../images/mockup-dashboard.png", "docs/mockup-dashboard.png")
```

## Parsed Content Quality

### Text Extraction
- ✅ Preserves headers, lists, tables
- ✅ Maintains document structure
- ✅ Includes alt text from images
- ✅ OCR on scanned pages
- ⚠️ Complex layouts may need manual review

### Image Extraction
- ✅ All embedded images extracted
- ✅ Original resolution maintained
- ✅ Filenames indicate content when possible
- ⚠️ Very large images may be resized

### Audio Transcription
- ✅ Speaker diarization (who said what)
- ✅ Timestamps for navigation
- ✅ Punctuation and formatting
- ⚠️ Accuracy depends on audio quality

## Common Questions

**Q: Why not just read the PDF directly?**  
A: PDFs are binary. Parsing extracts readable text and images.

**Q: Can I parse a 100-page document?**  
A: Only first 50 pages are processed. Split large documents.

**Q: Where do extracted images go?**  
A: `parsed-documents://[doc-name]/images/` folder.

**Q: Can I keep parsed content?**  
A: Copy to your project before conversation ends. Virtual FS is temporary.

**Q: Does parsing cost credits?**  
A: Document parsing is included in your message credits.

## See Also

- **User Uploads**: See `user-uploads/example-structure.md`
- **File Limits**: Max 20MB per file
- **Parsing Limits**: First 50 pages only

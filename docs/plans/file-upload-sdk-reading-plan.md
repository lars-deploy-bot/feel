# File Upload & SDK Reading Plan

**Goal:** Enable users to upload files that the Claude Agent SDK can read and reason about.

**Date:** 2025-12-07

---

## The Simple Truth

The SDK already has a `Read` tool. It reads files from the workspace. Done.

**The only missing piece:** Getting user-uploaded files INTO the workspace.

---

## Current Architecture

```
/srv/webalive/sites/example.com/
└── user/
    └── src/           ← SDK workspace root (Read/Write/Edit operate here)
        ├── index.ts
        ├── styles.css
        └── ...
```

The SDK's `Read` tool can read any file within the workspace. It already supports:
- Text files
- Images (returns visual content)
- PDFs (extracts text + images per page)
- Jupyter notebooks

**We don't need to teach the SDK anything new. We just need to put files where it can find them.**

---

## Solution

### Step 1: Create Upload API

New endpoint: `POST /api/files/upload`

```typescript
// apps/web/app/api/files/upload/route.ts

export async function POST(request: NextRequest) {
  // 1. Auth & workspace resolution (existing patterns)
  const user = await requireSessionUser()
  const formData = await request.formData()
  const workspace = await verifyWorkspaceAccess(user, formData)

  // 2. Get workspace path + ownership
  const { root: workspaceRoot, uid, gid } = getWorkspace(host)

  // 3. Get the file
  const file = formData.get("file") as File

  // 4. Determine save path within workspace
  // Use .uploads/ subdirectory to keep organized
  const uploadsDir = path.join(workspaceRoot, ".uploads")
  const filename = sanitizeFilename(file.name)
  const savePath = path.join(uploadsDir, filename)

  // 5. Security: ensure path stays within workspace
  ensurePathWithinWorkspace(savePath, workspaceRoot)

  // 6. Ensure uploads directory exists
  await fs.mkdir(uploadsDir, { recursive: true })
  await fs.chown(uploadsDir, uid, gid)

  // 7. Write file with proper ownership
  const buffer = Buffer.from(await file.arrayBuffer())
  writeAsWorkspaceOwner(savePath, buffer, { uid, gid })

  // 8. Return the path relative to workspace root
  return Response.json({
    ok: true,
    path: `.uploads/${filename}`,  // Path SDK can use with Read tool
  })
}
```

### Step 2: Frontend Upload Hook

Extend existing `useAttachments` to handle file uploads:

```typescript
// New attachment type
interface UploadedFileAttachment {
  kind: "uploaded-file"
  id: string
  workspacePath: string  // e.g., ".uploads/design.png"
  originalName: string
  fileType: string
  uploadProgress: number
}
```

### Step 3: Prompt Builder

Tell Claude where the file is:

```typescript
function buildPromptWithAttachments(message: string, attachments: Attachment[]): string {
  const uploadedFiles = attachments.filter(a => a.kind === "uploaded-file")

  if (uploadedFiles.length === 0) {
    return message
  }

  const fileList = uploadedFiles
    .map(f => `- ${f.originalName}: \`${f.workspacePath}\``)
    .join("\n")

  return `<uploaded_files>
The user has uploaded ${uploadedFiles.length} file(s) for you to analyze:

${fileList}

Use the Read tool to access and analyze these files.
</uploaded_files>

${message}`
}
```

### Step 4: That's It

Claude receives:
```
<uploaded_files>
The user has uploaded 1 file(s) for you to analyze:

- screenshot.png: `.uploads/screenshot.png`

Use the Read tool to access and analyze these files.
</uploaded_files>

What's wrong with my layout?
```

Claude uses the Read tool:
```typescript
Read({ file_path: ".uploads/screenshot.png" })
```

SDK returns image content. Claude reasons about it. Done.

---

## File Organization

```
/srv/webalive/sites/example.com/user/src/
├── .uploads/              ← User uploads (auto-created)
│   ├── screenshot.png
│   └── requirements.pdf
├── .gitignore            ← Add: .uploads/
├── index.ts
└── ...
```

Add to template `.gitignore`:
```
# User uploads (temporary files for Claude analysis)
.uploads/
```

---

## Cleanup (Optional, Phase 2)

Simple cron or on-demand cleanup:

```typescript
// Clean files older than 24 hours
async function cleanOldUploads(workspaceRoot: string) {
  const uploadsDir = path.join(workspaceRoot, ".uploads")
  const files = await fs.readdir(uploadsDir)
  const now = Date.now()
  const maxAge = 24 * 60 * 60 * 1000  // 24 hours

  for (const file of files) {
    const stats = await fs.stat(path.join(uploadsDir, file))
    if (now - stats.mtimeMs > maxAge) {
      await fs.unlink(path.join(uploadsDir, file))
    }
  }
}
```

---

## Security Checklist

- [x] `ensurePathWithinWorkspace()` - prevents path traversal
- [x] `writeAsWorkspaceOwner()` - correct file ownership
- [x] `sanitizeFilename()` - prevent directory injection
- [ ] File size limit (10MB?)
- [ ] File type allowlist (images, PDFs, text, code)

---

## Implementation Tasks

1. **Create `/api/files/upload` endpoint** (~30 min)
   - Use existing `getWorkspace()` and `writeAsWorkspaceOwner()` patterns
   - Add file size and type validation

2. **Add `uploaded-file` attachment type** (~30 min)
   - Extend `Attachment` union type
   - Add type guard `isUploadedFile()`

3. **Wire up frontend** (~1 hour)
   - Add upload handling to `useAttachments`
   - Update `buildPromptWithAttachments`

4. **Update template `.gitignore`** (~5 min)
   - Add `.uploads/` pattern

5. **Test** (~30 min)
   - Upload image → Claude describes it
   - Upload PDF → Claude summarizes it
   - Path traversal attempt → rejected

---

## What We're NOT Doing

- **No multimodal API content** - SDK handles this internally via Read tool
- **No base64 encoding in messages** - files live on disk
- **No external storage** - workspace IS the storage
- **No new SDK configuration** - Read tool already works
- **No additionalDirectories** - workspace is already accessible

---

## Why This Fits

| Existing Pattern | This Solution |
|-----------------|---------------|
| Files in workspace | Files in workspace |
| `writeAsWorkspaceOwner()` | Uses `writeAsWorkspaceOwner()` |
| `ensurePathWithinWorkspace()` | Uses `ensurePathWithinWorkspace()` |
| SDK Read tool | SDK Read tool |
| Prompt includes paths | Prompt includes paths |

Same sheep. Same herd.

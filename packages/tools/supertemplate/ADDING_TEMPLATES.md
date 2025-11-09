# How to Add New Alive Super Templates

This guide explains the complete process for adding a new template to the Alive Super Templates system, including both the backend (MCP tool) and frontend (UI browser) registration.

## Quick Overview

**Two Systems:**
1. **Backend (MCP Tool)**: Auto-discovers templates in `packages/tools/supertemplate/templates/*/` - no registration needed
2. **Frontend (UI Browser)**: Requires manual registration in 4 files for templates to show in the UI

**If you only add the `.md` file, the template WILL work via tool calls but WON'T appear in the UI browser.**

---

## Step-by-Step Process

### Step 1: Create the Template Markdown File

**Location:** `packages/tools/supertemplate/templates/{category}/{template-name}-v{version}.md`

**Naming convention:**
```
{feature-name}-v{major}.{minor}.{patch}.md
```

**Examples:**
- `carousel-thumbnails-v1.0.0.md`
- `vite-api-plugin-v1.0.0.md`
- `map-basic-markers-v1.0.0.md`

**Categories (subdirectories):**
- `photo-sliders/` - Image carousels, galleries, lightboxes
- `maps/` - Interactive maps, geocoding, markers
- `forms-and-inputs/` - Upload, validation, multi-step forms
- `backend/` - API servers, databases, backend logic
- `ui-components/` - Buttons, modals, accordions, UI patterns

**Template Requirements:**
- Follow ALL items in `TEMPLATE_CHECKLIST.md`
- Include exact metadata block (see checklist)
- 100% copy-paste ready code
- Comprehensive troubleshooting section
- Success criteria for each step

**Example:**
```markdown
# Vite API Plugin - Backend Server in Vite Dev Server

**Category:** Backend
**Complexity:** Medium
**Files:** 4
**Dependencies:** better-sqlite3
**Estimated Time:** 8-12 minutes
**Framework:** Vite 5+
**Min Node Version:** 18.0.0

## Description

[2-3 sentences]

## Step-by-Step Implementation

### Step 1: Install Dependencies
...
```

### Step 2: Register the Template ID

**File:** `apps/web/data/template-ids.ts`

**Add to `TEMPLATE_IDS` constant:**
```typescript
export const TEMPLATE_IDS = {
  CAROUSEL_THUMBNAILS: "carousel-thumbnails",
  MAP_BASIC_MARKERS: "map-basic-markers",
  // ... existing entries
  VITE_API_PLUGIN: "vite-api-plugin",  // ADD THIS
} as const
```

**Add to `TEMPLATE_VERSION_REGISTRY`:**
```typescript
export const TEMPLATE_VERSION_REGISTRY = {
  [TEMPLATE_IDS.CAROUSEL_THUMBNAILS]: ["v1.0.0"] as const,
  // ... existing entries
  [TEMPLATE_IDS.VITE_API_PLUGIN]: ["v1.0.0"] as const,  // ADD THIS
} as const
```

**Why:** This creates type-safe IDs and version tracking.

### Step 3: Add Template Entry to UI Data

**File:** `apps/web/data/templates.ts`

**1. Add category to type union (if new category):**
```typescript
export interface Template {
  // ...
  category: "sliders" | "maps" | "file-upload" | "blog" | "backend"  // Add "backend"
  // ...
}
```

**2. Add template entry to `templates` array:**
```typescript
export const templates: Template[] = [
  // ... existing entries

  // BACKEND (or your category)
  {
    id: TEMPLATE_IDS.VITE_API_PLUGIN,
    templateId: versionedId(TEMPLATE_IDS.VITE_API_PLUGIN, "v1.0.0"),
    name: "Vite API Plugin",
    category: "backend",
    description: "Add a full backend API to your Vite project without a separate server. Includes SQLite database and REST endpoints.",
    previewImage: "/templates/previews/placeholder.svg",  // Or actual preview URL
    tags: ["backend", "api", "sqlite", "vite"],
    complexity: 2,  // 1=Simple, 2=Medium, 3=Complex
    fileCount: 4,
    dependencies: ["better-sqlite3"],
    estimatedTime: "8-12 minutes",
    estimatedTokens: 85,  // Rough estimate (used for hidden metrics)
  },
]
```

**Field Guidelines:**
- `id`: Use `TEMPLATE_IDS.{YOUR_TEMPLATE}` constant
- `templateId`: Use `versionedId()` helper
- `category`: Must match category type union
- `description`: 1-2 sentences, clear and specific
- `previewImage`: Use placeholder or upload to `/public/templates/previews/`
- `tags`: 3-5 relevant keywords
- `complexity`: Based on time and difficulty (1/2/3)
- `fileCount`: Number of files created in template
- `dependencies`: Array of npm packages (just names, no versions)
- `estimatedTime`: Match template's time estimate
- `estimatedTokens`: Rough token count (for future usage tracking)

### Step 4: Add Category to Modal (if new category)

**File:** `apps/web/components/modals/SuperTemplatesModal.tsx`

**1. Add to `Category` type:**
```typescript
type Category = "sliders" | "maps" | "file-upload" | "blog" | "backend"  // Add "backend"
```

**2. Add to `categoryLabels`:**
```typescript
const categoryLabels: Record<Category, string> = {
  sliders: "Photo Sliders",
  maps: "Maps",
  "file-upload": "File Upload",
  blog: "Blog",
  backend: "Backend",  // ADD THIS
}
```

**Why:** This makes the category appear as a tab in the UI browser.

### Step 5: Update Backend Category List

**File:** `packages/tools/src/tools/templates/get-template.ts`

**Update `TEMPLATE_CATEGORIES` constant:**
```typescript
export const TEMPLATE_CATEGORIES = ["sliders", "maps", "file-upload", "blog", "backend"] as const
```

**Why:** Keeps the MCP tool's category list in sync (currently unused but good for future validation).

### Step 6: Verify Everything Works

**Backend (MCP Tool) Test:**
```typescript
// In Claude Code chat, user types:
"Use template: vite-api-plugin-v1.0.0"

// Claude should call get_alive_super_template and receive the full template
```

**Frontend (UI Browser) Test:**
1. Open Claude Code UI
2. Click template browser button (book icon)
3. Navigate to "Backend" tab (or your category)
4. Verify your template card appears
5. Click card to view preview
6. Click "Use Template" to insert into chat

**Expected Result:**
- Template JSON inserted into chat input
- Auto-detected and converted to attachment chip
- Clicking sends "Use template: {id}" to Claude
- Claude retrieves and implements template

---

## File Checklist

When adding a new template, you MUST update these files:

- [ ] `packages/tools/supertemplate/templates/{category}/{name}-v{version}.md` - The actual template
- [ ] `apps/web/data/template-ids.ts` - Add to TEMPLATE_IDS and TEMPLATE_VERSION_REGISTRY
- [ ] `apps/web/data/templates.ts` - Add category type (if new), add template entry
- [ ] `apps/web/components/modals/SuperTemplatesModal.tsx` - Add category type and label (if new)
- [ ] `packages/tools/src/tools/templates/get-template.ts` - Add to TEMPLATE_CATEGORIES (if new)
- [ ] `packages/tools/supertemplate/README.md` - Update total count, add category description (if new)

---

## Common Mistakes

### ❌ Mistake 1: Only Creating the .md File

**Problem:** Template works via tool but doesn't show in UI

**Solution:** Follow all 6 steps above

### ❌ Mistake 2: Mismatched Category Names

**Problem:** Template shows in wrong category or not at all

**Solution:** Ensure category name matches exactly in:
- Template .md metadata (`**Category:** Backend`)
- templates.ts entry (`category: "backend"`)
- SuperTemplatesModal.tsx type union
- Folder name (`backend/`)

### ❌ Mistake 3: Wrong Version Format

**Problem:** Tool can't find template

**Solution:** Filename MUST be `{name}-v{major}.{minor}.{patch}.md`
- ✅ Correct: `vite-api-plugin-v1.0.0.md`
- ❌ Wrong: `vite-api-plugin.md`
- ❌ Wrong: `vite-api-plugin-1.0.0.md`
- ❌ Wrong: `vite-api-plugin-v1.md`

### ❌ Mistake 4: Invalid Template ID Constant Name

**Problem:** TypeScript errors, broken references

**Solution:** Use SCREAMING_SNAKE_CASE:
- ✅ Correct: `VITE_API_PLUGIN: "vite-api-plugin"`
- ❌ Wrong: `viteApiPlugin: "vite-api-plugin"`

### ❌ Mistake 5: Not Testing Both Systems

**Problem:** Works in one place but not the other

**Solution:** Test BOTH:
1. UI browser (click through categories)
2. Direct tool call (type "Use template: {id}")

---

## Preview Images

**Options:**

1. **Use placeholder** (quickest):
```typescript
previewImage: "/templates/previews/placeholder.svg"
```

2. **Upload to terminal.goalive.nl** (recommended):
```typescript
previewImage: "https://terminal.goalive.nl/_images/t/protino.alive.best/o/{hash}/v/orig.webp"
```

3. **Add to public folder**:
```
apps/web/public/templates/previews/vite-api-plugin.png
```
```typescript
previewImage: "/templates/previews/vite-api-plugin.png"
```

**Image Guidelines:**
- Aspect ratio: 16:9 or 4:3
- Format: PNG, JPG, WebP, SVG
- Size: Max 500KB
- Content: Screenshot of end result or diagram

---

## Versioning Strategy

### When to Bump Versions

**Patch (v1.0.0 → v1.0.1):**
- Fix typos or errors
- Clarify existing instructions
- Update troubleshooting
- No code changes

**Minor (v1.0.0 → v1.1.0):**
- Add optional features
- Improve code quality
- Add more examples
- Backwards compatible

**Major (v1.0.0 → v2.0.0):**
- Breaking changes
- Different architecture
- Incompatible with v1.x
- Requires migration

### How to Add New Versions

1. **Create new file**: `{name}-v{new-version}.md`
2. **Update `TEMPLATE_VERSION_REGISTRY`**:
```typescript
[TEMPLATE_IDS.VITE_API_PLUGIN]: ["v1.0.0", "v1.1.0"] as const,
```
3. **Add new entry to `templates` array** with new `versionedId`
4. **Optional:** Mark old version as deprecated in description

**Users will see both versions in UI and can choose.**

---

## Testing Checklist

Before considering a template "done":

- [ ] Template file passes all checklist requirements
- [ ] TypeScript compiles without errors (`bun run build` in apps/web)
- [ ] Template appears in UI browser under correct category
- [ ] Can preview template in modal
- [ ] "Use Template" button inserts correct ID
- [ ] MCP tool successfully retrieves template
- [ ] Followed template myself from scratch (zero-knowledge test)
- [ ] All dependencies install without errors
- [ ] All code blocks work without modification
- [ ] Success criteria for each step verified
- [ ] Edge cases tested and documented

---

## Automation Opportunity

**Future Improvement:** Create a CLI script to automate registration:

```bash
bun run add-template vite-api-plugin v1.0.0 backend "Vite API Plugin" \
  --description "Add backend API to Vite" \
  --dependencies "better-sqlite3" \
  --complexity 2 \
  --files 4 \
  --time "8-12 minutes"
```

This could auto-generate entries in all 5 files.

---

## Questions?

If you're unsure about:
- **Category placement:** Check `TEMPLATE_CHECKLIST.md` for category descriptions
- **Complexity level:** 1=Simple (1 file, no deps), 2=Medium (2-5 files, 1-2 deps), 3=Complex (6+ files, 3+ deps)
- **Token estimate:** Count lines × 4 (rough approximation)

**Template not showing up?**
1. Check browser console for errors
2. Verify category names match exactly (case-sensitive)
3. Restart dev server (`bun run dev`)
4. Hard refresh browser (Ctrl+Shift+R)

---

**Last Updated:** 2025-11-09
**Process Version:** 1.0.0

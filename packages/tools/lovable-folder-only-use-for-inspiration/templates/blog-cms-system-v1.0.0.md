# Complete Blog CMS

**Category:** Blog
**Complexity:** Complex
**Files:** 12
**Dependencies:** react-markdown, date-fns, zustand
**Estimated Time:** 15-20 minutes

## Description

Full blog content management system with posts, categories, tags, and publishing workflow.

## Implementation

Create a complete blog CMS with publishing workflow:

### Files to create:

- `pages/admin/BlogCMS.tsx` - Main CMS dashboard
- `components/PostList.tsx` - List of all posts with filters
- `components/PostEditor.tsx` - Post editor (markdown or rich text)
- `components/CategoryManager.tsx` - Manage categories
- `components/TagManager.tsx` - Manage tags
- `components/PublishingControls.tsx` - Draft/published/scheduled controls
- `components/SEOSettings.tsx` - Meta tags, OG images
- `hooks/usePostManagement.ts` - Post CRUD operations
- `hooks/useBlogStore.ts` - Global blog state (Zustand)
- `utils/slugify.ts` - URL slug generation
- `utils/dateUtils.ts` - Date formatting
- `types/blog.ts` - Complete TypeScript interfaces

### Requirements:

**Post management:**
- Create, edit, delete posts
- Save as draft or publish
- Schedule posts for future publishing
- Duplicate post

**Rich metadata:**
- Title, slug (auto-generated, editable)
- Author, publish date
- Featured image
- Excerpt
- SEO title, meta description
- Open Graph tags

**Organization:**
- Categories (hierarchical)
- Tags (autocomplete)
- Filter posts by status, category, tag, author
- Search posts
- Sort by date, title, views

**Publishing states:**
- Draft (gray)
- Published (green)
- Scheduled (blue)
- Archived (red)

**Bulk actions:**
- Select multiple posts
- Bulk delete, publish, categorize

**Additional features:**
- View count tracking
- Comment moderation (optional)
- Dark mode admin panel

### Install dependencies:

```bash
npm install react-markdown date-fns zustand
```

**Goal:** This should feel like a mini WordPress admin.

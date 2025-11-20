# React Component Duplicate Code Analysis

## Executive Summary

**Total Estimated Duplicate Lines:** ~1,800+ lines
**Files Analyzed:** 100+ component files
**Priority Level:** HIGH - Significant impact on bundle size and maintainability

---

## Critical Duplications (100% Identical Code)

### 1. Template Card Components - EXACT DUPLICATES
**Impact:** 2 files, ~85 lines
**Priority:** CRITICAL - These are literally the same component

**Files:**
- `components/ui/TemplateCard.tsx` (88 lines)
- `components/ui/SuperTemplateCard.tsx` (88 lines)

**Difference:** NONE - 100% identical code, just different names

**Action:** DELETE SuperTemplateCard.tsx entirely, rename imports to TemplateCard

---

### 2. Template Preview Components - EXACT DUPLICATES
**Impact:** 2 files, ~68 lines
**Priority:** CRITICAL

**Files:**
- `components/ui/TemplatePreview.tsx` (69 lines)
- `components/ui/SuperTemplatePreview.tsx` (69 lines)

**Difference:** NONE - 100% identical

**Action:** DELETE SuperTemplatePreview.tsx entirely, rename imports

---

### 3. Template Confirm Dialogs - EXACT DUPLICATES
**Impact:** 2 files, ~50 lines
**Priority:** CRITICAL

**Files:**
- `components/modals/TemplateConfirmDialog.tsx` (52 lines)
- `components/modals/SuperTemplateConfirmDialog.tsx` (52 lines)

**Difference:** NONE - 100% identical

**Action:** DELETE SuperTemplateConfirmDialog.tsx entirely

---

## High Priority Duplications

### 4. Template Modal Pattern (95% Duplicate)
**Impact:** 2 files, ~160 lines
**Priority:** HIGH

**Files:**
- `components/modals/TemplatesModal.tsx` (184 lines)
- `components/modals/SuperTemplatesModal.tsx` (170 lines)

**Differences:**
- Different category labels
- One has confirmation step, one doesn't
- Different template type in JSON

**Solution:**
Create unified modal with configuration:
```typescript
interface TemplatesModalProps {
  templateType: 'template' | 'supertemplate'
  categories: string[]
  showConfirmation?: boolean
  onInsert: (template: Template) => void
}
```

---

### 5. Modal Overlay Pattern
**Impact:** 8 files, ~250-300 lines
**Priority:** HIGH

**Files with duplicate modal pattern:**
- `components/modals/DeleteModal.tsx`
- `components/modals/ConfirmModal.tsx`
- `components/modals/AddWorkspaceModal.tsx`
- `components/modals/FeedbackModal.tsx`
- `components/modals/TemplatesModal.tsx`
- `components/modals/SuperTemplatesModal.tsx`
- `features/photobook/components/modals/ImageZoomModal.tsx`
- `features/photobook/components/modals/GalleryOverlay.tsx`

**Common Pattern:**
```tsx
<div
  className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
  onClick={onClose}
  role="dialog"
  aria-modal="true"
>
  <div
    className="bg-white dark:bg-[#1a1a1a] rounded-lg ..."
    onClick={e => e.stopPropagation()}
  >
    {children}
  </div>
</div>
```

**Solution:**
Create base `<Modal>` component:
```tsx
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  closeOnBackdrop?: boolean
  closeOnEsc?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

export function Modal({ isOpen, onClose, children, ...props }: ModalProps)
```

**Features to include:**
- Backdrop click handling
- ESC key listener
- Focus trap
- Animation variants
- Portal rendering
- Scroll lock

---

### 6. Tool Input Components Pattern
**Impact:** 6 files, ~150 lines
**Priority:** HIGH

**Files:**
- `components/ui/chat/tools/read/ReadInput.tsx`
- `components/ui/chat/tools/write/WriteInput.tsx`
- `components/ui/chat/tools/edit/EditInput.tsx`
- `components/ui/chat/tools/glob/GlobInput.tsx`
- `components/ui/chat/tools/grep/GrepInput.tsx`
- `components/ui/chat/tools/bash/BashInput.tsx`

**Common Patterns:**
```tsx
// File name extraction (repeated 6 times)
const fileName = file_path.split("/").pop() || file_path

// Label styling (repeated 20+ times)
<div className="text-black/50 dark:text-white/50 mb-1">Label:</div>

// Value display (repeated 20+ times)
<div className="text-black/70 dark:text-white/70 font-diatype-mono truncate">
  {value}
</div>

// Code block (repeated 10+ times)
<div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded p-2">
  <code>{content}</code>
</div>
```

**Solution:**
Create utility components:
```tsx
// components/ui/chat/tools/common/ToolInputLabel.tsx
export function ToolInputLabel({ children }: { children: React.ReactNode })

// components/ui/chat/tools/common/ToolInputValue.tsx
export function ToolInputValue({ children }: { children: React.ReactNode })

// components/ui/chat/tools/common/CodeBlock.tsx
export function CodeBlock({ code, language }: { code: string; language?: string })

// lib/utils/path.ts
export function getFileName(path: string): string
```

---

### 7. Tool Output Components Pattern
**Impact:** 6 files, ~80 lines
**Priority:** HIGH

**Files:**
- `components/ui/chat/tools/read/ReadOutput.tsx`
- `components/ui/chat/tools/write/WriteOutput.tsx`
- `components/ui/chat/tools/edit/EditOutput.tsx`
- `components/ui/chat/tools/glob/GlobOutput.tsx`
- `components/ui/chat/tools/grep/GrepOutput.tsx`
- `components/ui/chat/tools/bash/BashOutput.tsx`

**Common Patterns:**
```tsx
// Success status (repeated 6 times)
<div className="text-xs text-blue-700 dark:text-blue-400 font-normal p-2 bg-blue-50/30">
  ✓ Success message
</div>

// Error status (repeated 6 times)
<div className="text-xs text-red-600 dark:text-red-400 font-normal p-2 bg-red-50/50">
  {error}
</div>

// Metadata (repeated 6 times)
<div className="text-xs text-black/40 dark:text-white/40 font-normal">
  count • metadata
</div>
```

**Solution:**
Create status component:
```tsx
// components/ui/chat/tools/common/ToolOutputStatus.tsx
export function ToolOutputStatus({
  variant,
  children,
}: {
  variant: 'success' | 'error' | 'info' | 'metadata'
  children: React.ReactNode
})
```

---

## Medium Priority Duplications

### 8. Dropdown/Select Pattern
**Impact:** 2 files, ~120 lines
**Priority:** MEDIUM

**Files:**
- `components/workspace/WorkspaceSwitcher.tsx` (186 lines)
- `components/workspace/OrganizationSwitcher.tsx` (125 lines)

**Common Pattern (~70% similar):**
```tsx
const [isOpen, setIsOpen] = useState(false)

<button onClick={() => setIsOpen(!isOpen)}>
  <span>{selected || "select"}</span>
  <ChevronDown className={isOpen ? "rotate-180" : ""} />
</button>

{isOpen && (
  <>
    <button className="fixed inset-0" onClick={() => setIsOpen(false)} />
    <div className="absolute top-full left-0 ...">
      {loading && <Spinner />}
      {error && <ErrorWithRetry error={error} onRetry={retry} />}
      {items.map(...)}
    </div>
  </>
)}
```

**Solution:**
Create generic `<Dropdown>` component:
```tsx
interface DropdownProps<T> {
  items: T[]
  selected?: T
  onSelect: (item: T) => void
  loading?: boolean
  error?: string
  onRetry?: () => void
  renderItem: (item: T) => React.ReactNode
  searchable?: boolean
  grouped?: boolean
}
```

---

### 9. Form Input Field Pattern
**Impact:** 5 files, ~200 lines
**Priority:** MEDIUM

**Files:**
- `components/ui/primitives/Input.tsx` (102 lines)
- `components/ui/primitives/EmailField.tsx` (86 lines)
- `components/ui/primitives/PasswordField.tsx` (94 lines)
- `features/deployment/components/SlugInput.tsx` (158 lines)
- `features/deployment/components/SiteIdeasTextarea.tsx` (89 lines)

**Common Patterns:**
```tsx
// Framer motion wrapper (repeated 5 times)
<motion.div variants={fieldVariants}>
  <label>...</label>
  <motion.input
    whileFocus="focus"
    variants={fieldVariants}
    className={/* state-based classes */}
  />
  {error && <motion.p animate={{ opacity: 1, y: 0 }}>...</motion.p>}
</motion.div>

// State-based styling (repeated 5 times)
className={`
  ${error ? "border-red-300 bg-red-50" :
    success ? "border-green-300 bg-green-50" :
    "border-gray-200 bg-gray-50"}
`}
```

**Solution:**
Enhance existing `<Input>` component:
- Better react-hook-form integration
- Extract `fieldVariants` to shared config
- Create `<FormField>` wrapper for label + input + error

---

### 10. Loading Spinner Pattern
**Impact:** 10+ files, ~50 lines
**Priority:** MEDIUM

**Inline spinner repeated 20+ times:**
```tsx
<div className="w-3 h-3 border border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
```

**Files:**
- `WorkspaceSwitcher.tsx`
- `OrganizationSwitcher.tsx`
- `page.tsx` (app root)
- `SettingsModal.tsx`
- `manager/page.tsx`
- And 5+ more

**Solution:**
Create `<Spinner>` component:
```tsx
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}
```

---

### 11. Error Display Pattern
**Impact:** 15+ files, ~60 lines
**Priority:** MEDIUM

**Repeated in many components:**
```tsx
{error && (
  <div className="text-xs text-red-600 dark:text-red-400">
    {error}
  </div>
)}

// With retry button
{error && (
  <div className="flex items-center gap-2">
    <span className="text-red-600">{error}</span>
    <button onClick={retry} className="bg-red-100 text-red-700">
      retry
    </button>
  </div>
)}
```

**Solution:**
```tsx
interface ErrorDisplayProps {
  error: string
  onRetry?: () => void
  variant?: 'inline' | 'banner' | 'modal'
}
```

---

### 12. Button Loading State Pattern
**Impact:** 15+ files, ~100 lines
**Priority:** MEDIUM

**Note:** Existing `Button` component at `components/ui/primitives/Button.tsx` already supports loading state!

**Issue:** Not consistently used - many components implement inline:
```tsx
<button disabled={loading}>
  {loading ? (
    <>
      <Loader2 className="animate-spin" />
      Loading...
    </>
  ) : (
    "Action"
  )}
</button>
```

**Solution:** Enforce usage of existing `<Button loading={...}>` component

---

### 13. Card Hover Effect Pattern
**Impact:** 5+ files, ~40 lines
**Priority:** LOW-MEDIUM

**Files:**
- `TemplateCard.tsx`
- `ImageCard.tsx` (photobook)
- Various manager cards

**Pattern:**
```tsx
<div className="group relative hover:shadow-lg transition-all">
  <div className="relative">
    <img src={...} />
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10">
      <span className="opacity-0 group-hover:opacity-100">
        View Details
      </span>
    </div>
  </div>
</div>
```

**Solution:**
```tsx
interface HoverCardProps {
  children: React.ReactNode
  overlay?: React.ReactNode
  onHover?: () => void
}
```

---

## Low Priority (But Tedious)

### 14. Dark Mode Class Pattern
**Impact:** 1000+ lines across entire codebase
**Priority:** LOW (quality of life improvement)

**Repeated everywhere:**
```tsx
className="text-black/60 dark:text-white/60 bg-white dark:bg-[#1a1a1a] border-black/10 dark:border-white/10"
```

**Solution:**
Create Tailwind utility classes:
```css
/* globals.css or tailwind config */
.text-muted { @apply text-black/60 dark:text-white/60; }
.bg-card { @apply bg-white dark:bg-[#1a1a1a]; }
.border-subtle { @apply border-black/10 dark:border-white/10; }
```

---

## Good News: Existing Patterns

### 15. useFetch Hook (Already Exists!)
**Location:** `lib/hooks/useFetch.ts`

**Features:**
- Loading states
- Error handling with retry
- Race condition protection
- Automatic cleanup

**Issue:** Not consistently used - many components still use `useState` + `useEffect` for fetching

**Action:** Enforce `useFetch` usage throughout codebase

---

## Refactoring Priority List

### Phase 1: Critical - Immediate Deletion
**Estimated Time:** 2 hours
**Impact:** ~250 lines removed, improved clarity

1. Delete `SuperTemplateCard.tsx` → use `TemplateCard`
2. Delete `SuperTemplatePreview.tsx` → use `TemplatePreview`
3. Delete `SuperTemplateConfirmDialog.tsx` → use `TemplateConfirmDialog`
4. Update all imports
5. Test template functionality

---

### Phase 2: High Priority - Component Consolidation
**Estimated Time:** 1 week
**Impact:** ~500 lines saved, better UX consistency

6. Create base `<Modal>` component (1 day)
   - Migrate 8 modal components
   - Test accessibility and animations

7. Consolidate template modals (1 day)
   - Create unified `TemplatesModal` with config
   - Remove duplicate

8. Create tool component utilities (2 days)
   - `ToolInputLabel`, `ToolInputValue`, `CodeBlock`
   - `ToolOutputStatus` with variants
   - Migrate 12 tool components

9. Create `<Spinner>` component (2 hours)
   - Replace 20+ inline spinners

---

### Phase 3: Medium Priority - UI Patterns
**Estimated Time:** 1 week
**Impact:** ~400 lines saved, improved DX

10. Create `<Dropdown>` component (2 days)
    - Migrate WorkspaceSwitcher and OrganizationSwitcher

11. Create `<ErrorDisplay>` component (1 day)
    - Migrate 15+ error displays

12. Enhance `<Input>` component (1 day)
    - Extract fieldVariants
    - Create FormField wrapper

13. Enforce `<Button>` usage (1 day)
    - Replace inline loading states

---

### Phase 4: Quality of Life
**Estimated Time:** 3 days
**Impact:** Improved readability

14. Create dark mode utility classes
15. Enforce `useFetch` hook usage
16. Create `<HoverCard>` component

---

## New Component Structure

```
components/
├── ui/
│   ├── primitives/
│   │   ├── Button.tsx          # Enhanced with loading
│   │   ├── Input.tsx           # Enhanced with FormField
│   │   ├── Modal.tsx           # NEW - base modal
│   │   ├── Dropdown.tsx        # NEW - generic dropdown
│   │   ├── Spinner.tsx         # NEW - loading spinner
│   │   └── ErrorDisplay.tsx    # NEW - error component
│   ├── chat/
│   │   └── tools/
│   │       ├── common/         # NEW folder
│   │       │   ├── ToolInputLabel.tsx
│   │       │   ├── ToolInputValue.tsx
│   │       │   ├── CodeBlock.tsx
│   │       │   └── ToolOutputStatus.tsx
│   │       ├── read/
│   │       ├── write/
│   │       └── ...
│   ├── TemplateCard.tsx        # Keep
│   ├── TemplatePreview.tsx     # Keep
│   └── HoverCard.tsx           # NEW
├── modals/
│   ├── TemplatesModal.tsx      # Unified version
│   ├── TemplateConfirmDialog.tsx  # Keep
│   └── ...
└── ...
```

---

## Testing Strategy

For each refactored component:
1. Create Storybook story (if applicable)
2. Test all variants/states
3. Test accessibility (keyboard nav, screen readers)
4. Visual regression test
5. E2E test for critical flows

---

## Migration Checklist

- [ ] Phase 1: Delete duplicate template components (2 hours)
- [ ] Phase 2: Create base Modal component (1 week)
- [ ] Phase 3: Create UI pattern components (1 week)
- [ ] Phase 4: Quality of life improvements (3 days)
- [ ] Update documentation
- [ ] Update contributing guide
- [ ] Create component usage examples

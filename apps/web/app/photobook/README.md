# Photobook Component

A modern, accessible photo gallery with drag-and-drop upload, optimistic UI updates, and workspace-scoped image management.

## Architecture

### Directory Structure

```
photobook/
├── components/          # Reusable UI components
│   ├── DeleteConfirmModal.tsx
│   ├── ImageCard.tsx
│   ├── ImageZoomModal.tsx
│   ├── LoadingState.tsx
│   ├── MessageBanner.tsx
│   ├── UploadCard.tsx
│   └── index.ts
├── hooks/              # Custom React hooks
│   ├── useCopyToClipboard.ts
│   ├── useImageManagement.ts
│   ├── useWorkspace.ts
│   └── index.ts
├── page.tsx           # Main page component
└── README.md
```

### Components

#### `<ImageCard />` (Memoized)
- Displays a single image with thumbnail
- Delete button with confirmation
- Copy-to-clipboard functionality
- Click to zoom
- **Performance**: Memoized to prevent unnecessary re-renders

#### `<DeleteConfirmModal />`
- Beautiful confirmation dialog
- No browser alerts
- Accessible with ARIA labels
- Click outside to cancel

#### `<ImageZoomModal />`
- Full-screen image view
- Click to close
- Accessible modal dialog

#### `<UploadCard />`
- Shows selected files count
- Upload progress state
- Responsive layout

#### `<LoadingState />`
- Reusable loading indicator
- Pulsing animation
- Screen reader friendly

#### `<MessageBanner />`
- Error and success messages
- Color-coded (red/green)
- Auto-dismissible via state

### Custom Hooks

#### `useWorkspace()`
Manages workspace detection and terminal mode.

```typescript
const { workspace, isTerminal, mounted } = useWorkspace()
```

**Returns:**
- `workspace`: Current workspace ID
- `isTerminal`: Boolean for terminal.* domain
- `mounted`: Client-side hydration flag

#### `useImageManagement(isTerminal, workspace)`
Handles all image CRUD operations with optimistic updates.

```typescript
const {
  images,
  loadingImages,
  uploading,
  error,
  success,
  loadImages,
  uploadImages,
  deleteImage,
  clearMessages,
} = useImageManagement(isTerminal, workspace)
```

**Features:**
- Optimistic deletion (instant UI, rollback on error)
- Batch uploads with Promise.all
- Automatic sorting by upload date
- Error handling with user-friendly messages

#### `useCopyToClipboard()`
Copy-to-clipboard with visual feedback.

```typescript
const { copyToClipboard, isCopied } = useCopyToClipboard()

copyToClipboard(text, itemId)
const copied = isCopied(itemId)
```

**Features:**
- 2-second feedback duration
- Multiple items tracking
- Auto-reset after timeout

## Features

### 1. Drag and Drop Upload
- Drop anywhere on the page
- Visual feedback (blue overlay)
- Multi-file support

### 2. Optimistic UI Updates
- Images disappear immediately on delete
- Restored if deletion fails
- No waiting for server responses

### 3. Accessibility (WCAG 2.1)
- ARIA labels on all interactive elements
- Keyboard navigation (Enter/Space on buttons)
- Screen reader announcements for state changes
- Focus management in modals
- Semantic HTML

### 4. Performance Optimizations
- `React.memo()` on ImageCard (prevents re-renders)
- `useCallback()` for stable function references
- Lazy loading images with `loading="lazy"`
- Proper dependency arrays (no React warnings)

### 5. Workspace Support
- Multi-tenant architecture
- Terminal mode (custom workspaces)
- Standard mode (domain-based)

### 6. Error Handling
- User-friendly error messages
- Graceful fallbacks
- Network error recovery

## Usage

### Basic Usage

```tsx
import PhotobookPage from './app/photobook/page'

// Use as a page component (Next.js App Router)
export default PhotobookPage
```

### Using Individual Components

```tsx
import { ImageCard, DeleteConfirmModal } from './components'

<ImageCard
  image={image}
  onDelete={handleDelete}
  onZoom={handleZoom}
  onCopy={handleCopy}
  isCopied={false}
/>
```

### Using Hooks

```tsx
import { useImageManagement } from './hooks'

function MyComponent() {
  const { images, uploadImages, deleteImage } = useImageManagement(false, '')

  // Use the hook methods
}
```

## API Endpoints

The component expects these API endpoints:

- `GET /api/images/list` - List images (with optional workspace param)
- `POST /api/images/upload` - Upload image (FormData with file + workspace)
- `DELETE /api/images/delete` - Delete image (JSON with key + workspace)

## Environment

- **Next.js**: 16+ (App Router)
- **React**: 19+ (Concurrent features)
- **TypeScript**: 5+

## Maintainability Improvements

### Before (Single 447-line file)
- ❌ Hard to test individual parts
- ❌ Difficult to reuse components
- ❌ Mixed concerns (UI + business logic)
- ❌ No code splitting potential

### After (Modular architecture)
- ✅ Testable hooks and components
- ✅ Reusable across the app
- ✅ Separated concerns
- ✅ Tree-shakeable imports
- ✅ Better code organization
- ✅ Easy to onboard new developers

## Future Enhancements

- [ ] Infinite scroll for large galleries
- [ ] Image compression before upload
- [ ] Multi-select for batch operations
- [ ] Image editing (crop, rotate)
- [ ] Shareable gallery links
- [ ] PWA offline support
- [ ] Unit tests with Vitest
- [ ] E2E tests with Playwright

## Contributing

When adding features:
1. Extract new UI as separate components
2. Extract logic into custom hooks
3. Add TypeScript types
4. Include accessibility features
5. Update this README

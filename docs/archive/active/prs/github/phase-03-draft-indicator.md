# Phase 3: Draft Indicator UI

**Time:** 3 hours
**Depends on:** Phase 2
**Deliverable:** Draft indicator in chat header (mocked)

---

## Goal

Add a draft indicator to the chat header. Shows current branch (main or draft name) with status indicators. Uses mock API.

---

## Files to Create/Modify

### 1. Extend Mock API

```typescript
// apps/web/lib/github/mock-api.ts (add to existing)
interface MockState {
  connected: boolean;
  username: string | null;
  repo: { owner: string; name: string } | null;
  onMain: boolean;
  isDirty: boolean;
  activeDraft: { id: string; name: string } | null;
}

// Update getStatus to include draft info
async getStatus(): Promise<GitStatus> {
  await delay(200);
  const state = getState();
  return {
    enabled: true,
    connected: state.connected,
    username: state.username ?? undefined,
    repo: state.repo ? {
      ...state.repo,
      url: `https://github.com/${state.repo.owner}/${state.repo.name}`,
    } : undefined,
    onMain: state.onMain ?? true,
    isDirty: state.isDirty ?? false,
    changedFiles: state.isDirty ? 3 : 0,
    activeDraft: state.activeDraft ?? undefined,
    behindMain: 0,
  };
},

// Add method to simulate dirty state (for testing)
simulateDirty(isDirty: boolean): void {
  const state = getState();
  setState({ ...state, isDirty });
},
```

### 2. Component

```typescript
// apps/web/components/git/DraftIndicator.tsx
'use client';

import { GitBranch, Circle } from 'lucide-react';
import { useGitHubStatus } from '@/hooks/use-github-status';
import { useUser } from '@/hooks/use-user';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import { cn } from '@/lib/utils';

interface DraftIndicatorProps {
  workspace: string;
  onNewDraft?: () => void;
  onOpenPanel?: () => void;
}

export function DraftIndicator({ workspace, onNewDraft, onOpenPanel }: DraftIndicatorProps) {
  const { data: user } = useUser();
  const { data: status, isLoading } = useGitHubStatus(workspace, user?.email);

  // Feature flag check - requires BOTH admin site AND admin user
  if (!isGitHubEnabled(workspace, user?.email)) {
    return null;
  }

  if (isLoading) {
    return <div className="w-24 h-8 bg-muted animate-pulse rounded" />;
  }

  // Not connected - don't show indicator
  if (!status?.connected) {
    return null;
  }

  // On main branch
  if (status.onMain) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground">
          <GitBranch className="w-4 h-4" />
          <span>main</span>
          {status.isDirty && (
            <Circle className="w-2 h-2 fill-orange-500 text-orange-500" title="Unsaved changes" />
          )}
        </div>

        {onNewDraft && (
          <button
            onClick={onNewDraft}
            className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
          >
            + New Draft
          </button>
        )}
      </div>
    );
  }

  // On a draft
  return (
    <button
      onClick={onOpenPanel}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
        'bg-blue-50 border-blue-200 hover:bg-blue-100'
      )}
    >
      <GitBranch className="w-4 h-4 text-blue-600" />
      <span className="font-medium text-blue-900 max-w-[150px] truncate">
        {status.activeDraft?.name ?? 'Draft'}
      </span>

      {status.isDirty && (
        <Circle className="w-2 h-2 fill-orange-500 text-orange-500" title="Unsaved changes" />
      )}

      {status.behindMain > 0 && (
        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
          {status.behindMain} behind
        </span>
      )}
    </button>
  );
}
```

### 3. Integrate into Header

```typescript
// apps/web/components/chat/ChatHeader.tsx (add to existing)
import { DraftIndicator } from '@/components/git/DraftIndicator';

// Inside the header component, add:
<DraftIndicator
  workspace={workspace}
  onNewDraft={() => setShowNewDraftDialog(true)}
  onOpenPanel={() => setShowDraftPanel(true)}
/>
```

---

## AI Tests

```typescript
// apps/web/components/git/__tests__/DraftIndicator.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftIndicator } from '../DraftIndicator';

vi.mock('@/lib/github/feature-flag', () => ({
  isGitHubEnabled: vi.fn((workspace) => workspace === 'huurmatcher.alive.best'),
}));

vi.mock('@/hooks/use-github-status', () => ({
  useGitHubStatus: vi.fn(() => ({
    data: {
      enabled: true,
      connected: true,
      onMain: true,
      isDirty: false,
    },
    isLoading: false,
  })),
}));

describe('DraftIndicator', () => {
  it('renders nothing for non-admin workspace', () => {
    const { container } = render(<DraftIndicator workspace="random.site.com" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders main branch indicator when connected', () => {
    render(<DraftIndicator workspace="huurmatcher.alive.best" />);
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('shows New Draft button when onNewDraft provided', () => {
    render(<DraftIndicator workspace="huurmatcher.alive.best" onNewDraft={() => {}} />);
    expect(screen.getByText('+ New Draft')).toBeInTheDocument();
  });
});
```

**Run:** `bun test apps/web/components/git/__tests__/DraftIndicator.test.tsx`

---

## Human Tests

1. Go to `https://huurmatcher.alive.best`
2. Connect GitHub in Settings (if not connected)
3. **Verify:** Header shows "main" with git branch icon
4. **Verify:** "New Draft" button visible next to main
5. Open browser DevTools → Console
6. Run: `localStorage.setItem('mock-git-state', JSON.stringify({connected:true,username:'demo',repo:{owner:'demo',name:'site'},isDirty:true,onMain:true}))`
7. Refresh page
8. **Verify:** Orange dot appears next to "main" indicating unsaved changes

---

## Definition of Done

- [ ] `DraftIndicator.tsx` component exists
- [ ] Shows "main" when on main branch
- [ ] Shows orange dot when dirty
- [ ] Shows "New Draft" button
- [ ] Hidden for non-admin workspaces
- [ ] Hidden when not connected
- [ ] Unit tests pass

# Phase 4: Draft Panel UI

**Time:** 3 hours
**Depends on:** Phase 3
**Deliverable:** Draft panel with create/switch/submit actions (mocked)

---

## Goal

Build the full draft management panel: create drafts, switch between them, submit for review, and conflict resolution UI. All mocked.

**Security:** All components check BOTH admin site AND admin user.

---

## Files to Create/Modify

### 0. Add useDrafts Hook

```typescript
// apps/web/hooks/use-github-status.ts (add to existing file)
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { gitApi } from '@/lib/github/api';
import { isGitHubEnabledForSite } from '@/lib/github/feature-flag';
import type { Draft, GitStatus } from '@/lib/github/types';

// Existing hook
export function useGitHubStatus(workspace: string, userEmail?: string) {
  return useSWR<GitStatus>(
    isGitHubEnabledForSite(workspace) && userEmail ? ['git-status', workspace] : null,
    () => gitApi.getStatus(workspace),
    { refreshInterval: 30_000 }
  );
}

// New hook for drafts
export function useDrafts(workspace: string, userEmail?: string) {
  const { data, mutate, isLoading } = useSWR<{ drafts: Draft[] }>(
    isGitHubEnabledForSite(workspace) && userEmail ? ['git-drafts', workspace] : null,
    () => gitApi.getDrafts(workspace)
  );

  const { trigger: createDraft, isMutating: isCreating } = useSWRMutation(
    ['git-drafts', workspace],
    (_key, { arg }: { arg: string }) => gitApi.createDraft(workspace, arg),
    { onSuccess: () => mutate() }
  );

  const { trigger: switchDraft } = useSWRMutation(
    ['git-drafts', workspace],
    (_key, { arg }: { arg: string }) => gitApi.switchDraft(workspace, arg),
    { onSuccess: () => mutate() }
  );

  const { trigger: switchToMain } = useSWRMutation(
    ['git-drafts', workspace],
    () => gitApi.switchToMain(workspace),
    { onSuccess: () => mutate() }
  );

  const { trigger: submitDraft, isMutating: isSubmitting } = useSWRMutation(
    ['git-drafts', workspace],
    (_key, { arg }: { arg: string }) => gitApi.submitDraft(workspace, arg),
    { onSuccess: () => mutate() }
  );

  const { trigger: deleteDraft } = useSWRMutation(
    ['git-drafts', workspace],
    (_key, { arg }: { arg: string }) => gitApi.deleteDraft(workspace, arg),
    { onSuccess: () => mutate() }
  );

  return {
    drafts: data?.drafts ?? [],
    isLoading,
    createDraft,
    isCreating,
    switchDraft,
    switchToMain,
    submitDraft,
    isSubmitting,
    deleteDraft,
    mutate,
  };
}
```

### 1. Extend Mock API

```typescript
// apps/web/lib/github/mock-api.ts (extend)
interface MockDraft {
  id: string;
  name: string;
  status: 'editing' | 'submitted' | 'merged' | 'closed';
  prNumber?: number;
  prUrl?: string;
  behindBy: number;
  hasConflicts: boolean;
  conflictingFiles: string[];
}

interface MockState {
  // ... existing fields
  drafts: MockDraft[];
  activeDraftId: string | null;
}

// Add these methods to mockGitApi:
async getDrafts(): Promise<{ drafts: MockDraft[] }> {
  await delay(200);
  const state = getState();
  return {
    drafts: state.drafts.map(d => ({
      ...d,
      isActive: d.id === state.activeDraftId,
    })),
  };
},

async createDraft(name: string): Promise<MockDraft> {
  await delay(800);
  const state = getState();
  const draft: MockDraft = {
    id: `draft-${Date.now()}`,
    name,
    status: 'editing',
    behindBy: 0,
    hasConflicts: false,
    conflictingFiles: [],
  };
  state.drafts = [...(state.drafts || []), draft];
  state.activeDraftId = draft.id;
  state.onMain = false;
  setState(state);
  return draft;
},

async switchDraft(draftId: string): Promise<void> {
  await delay(500);
  const state = getState();
  state.activeDraftId = draftId;
  state.onMain = false;
  setState(state);
},

async switchToMain(): Promise<void> {
  await delay(500);
  const state = getState();
  state.activeDraftId = null;
  state.onMain = true;
  setState(state);
},

async submitDraft(draftId: string): Promise<{ prNumber: number; prUrl: string }> {
  await delay(1200);
  const state = getState();
  const draft = state.drafts.find(d => d.id === draftId);
  if (draft) {
    draft.status = 'submitted';
    draft.prNumber = Math.floor(Math.random() * 100) + 1;
    draft.prUrl = `https://github.com/${state.repo?.owner}/${state.repo?.name}/pull/${draft.prNumber}`;
    setState(state);
    return { prNumber: draft.prNumber, prUrl: draft.prUrl };
  }
  throw new Error('Draft not found');
},

async deleteDraft(draftId: string): Promise<void> {
  await delay(500);
  const state = getState();
  state.drafts = state.drafts.filter(d => d.id !== draftId);
  if (state.activeDraftId === draftId) {
    state.activeDraftId = null;
    state.onMain = true;
  }
  setState(state);
},

// For conflict testing
simulateBehind(draftId: string, commits: number): void {
  const state = getState();
  const draft = state.drafts.find(d => d.id === draftId);
  if (draft) {
    draft.behindBy = commits;
    setState(state);
  }
},

simulateConflict(draftId: string, files: string[]): void {
  const state = getState();
  const draft = state.drafts.find(d => d.id === draftId);
  if (draft) {
    draft.hasConflicts = true;
    draft.conflictingFiles = files;
    setState(state);
  }
},
```

### 2. New Draft Dialog

```typescript
// apps/web/components/git/NewDraftDialog.tsx
'use client';

import { useState } from 'react';
import { useDrafts } from '@/hooks/use-github-status';
import { useUser } from '@/hooks/use-user';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface NewDraftDialogProps {
  workspace: string;
  open: boolean;
  onClose: () => void;
}

export function NewDraftDialog({ workspace, open, onClose }: NewDraftDialogProps) {
  const [name, setName] = useState('');
  const { data: user } = useUser();
  const { createDraft, isCreating } = useDrafts(workspace, user?.email);

  // Feature flag check - requires BOTH admin site AND admin user
  if (!isGitHubEnabled(workspace, user?.email)) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createDraft(name.trim());
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Draft</DialogTitle>
          <DialogDescription>
            Create a draft to work on changes without affecting your live site.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <label className="block text-sm font-medium mb-2">
              What are you working on?
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Add contact form"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Draft'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Draft Panel

```typescript
// apps/web/components/git/DraftPanel.tsx
'use client';

import { ExternalLink, GitPullRequest, Trash2 } from 'lucide-react';
import { useDrafts, useGitHubStatus } from '@/hooks/use-github-status';
import { useUser } from '@/hooks/use-user';
import { isGitHubEnabled } from '@/lib/github/feature-flag';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DraftPanelProps {
  workspace: string;
  open: boolean;
  onClose: () => void;
  onNewDraft: () => void;
}

export function DraftPanel({ workspace, open, onClose, onNewDraft }: DraftPanelProps) {
  const { data: user } = useUser();
  const { data: status } = useGitHubStatus(workspace, user?.email);
  const { drafts, submitDraft, switchDraft, switchToMain, deleteDraft, isSubmitting } = useDrafts(workspace, user?.email);

  // Feature flag check - requires BOTH admin site AND admin user
  if (!isGitHubEnabled(workspace, user?.email)) {
    return null;
  }

  const activeDraft = drafts?.find(d => d.isActive);
  const otherDrafts = drafts?.filter(d => !d.isActive) ?? [];

  return (
    <div className="w-80 divide-y">
      {/* Current Draft */}
      {activeDraft && (
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-medium">{activeDraft.name}</h3>
            <StatusBadge status={activeDraft.status} />
          </div>

          {/* Behind warning */}
          {activeDraft.behindBy > 0 && activeDraft.status === 'editing' && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
              Main branch has {activeDraft.behindBy} new commits
            </div>
          )}

          {/* PR Link */}
          {activeDraft.prUrl && (
            <a
              href={activeDraft.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <GitPullRequest className="w-4 h-4" />
              Pull Request #{activeDraft.prNumber}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Submit button */}
          {activeDraft.status === 'editing' && (
            <button
              onClick={() => submitDraft(activeDraft.id)}
              disabled={isSubmitting}
              className="w-full py-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          )}
        </div>
      )}

      {/* Other Drafts */}
      {otherDrafts.length > 0 && (
        <div className="p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Other Drafts</p>
          {otherDrafts.map(draft => (
            <div key={draft.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
              <button onClick={() => { switchDraft(draft.id); onClose(); }} className="flex-1 text-left">
                <p className="text-sm font-medium truncate">{draft.name}</p>
                <StatusBadge status={draft.status} small />
              </button>
              {(draft.status === 'merged' || draft.status === 'closed') && (
                <button onClick={() => deleteDraft(draft.id)} className="p-1 text-muted-foreground hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="p-4 space-y-2">
        <button onClick={onNewDraft} className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded">
          + New Draft
        </button>
        <button onClick={() => { switchToMain(); onClose(); }} className="w-full py-2 text-sm text-muted-foreground hover:bg-muted rounded">
          Back to main
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const styles: Record<string, string> = {
    editing: 'bg-gray-100 text-gray-700',
    submitted: 'bg-yellow-100 text-yellow-700',
    merged: 'bg-green-100 text-green-700',
    closed: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    editing: 'Editing',
    submitted: 'In Review',
    merged: 'Merged',
    closed: 'Closed',
  };
  return (
    <span className={`inline-block rounded ${styles[status] ?? styles.editing} ${small ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1 mt-1'}`}>
      {labels[status] ?? status}
    </span>
  );
}
```

### 4. Conflict Dialog

```typescript
// apps/web/components/git/ConflictDialog.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle, FileCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { ConflictResolution } from '@/lib/github/types';

interface ConflictDialogProps {
  files: string[];
  open: boolean;
  onResolve: (resolutions: ConflictResolution[]) => void;
  onClose: () => void;
}

export function ConflictDialog({ files, open, onResolve, onClose }: ConflictDialogProps) {
  const [choices, setChoices] = useState<Record<string, 'mine' | 'theirs'>>({});
  const allChosen = files.every(f => choices[f]);

  const handleResolve = () => {
    const resolutions = Object.entries(choices).map(([file, choice]) => ({ file, choice }));
    onResolve(resolutions);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Resolve Conflicts
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          These files were changed on both your draft and the live site. Choose which version to keep.
        </p>

        <div className="space-y-3 max-h-64 overflow-y-auto py-4">
          {files.map(file => (
            <div key={file} className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <FileCode className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-sm truncate">{file}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setChoices(c => ({ ...c, [file]: 'mine' }))}
                  className={`p-2 rounded border text-sm ${choices[file] === 'mine' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  Keep my version
                </button>
                <button
                  onClick={() => setChoices(c => ({ ...c, [file]: 'theirs' }))}
                  className={`p-2 rounded border text-sm ${choices[file] === 'theirs' ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                >
                  Use live version
                </button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
          <button
            onClick={handleResolve}
            disabled={!allChosen}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Continue
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## AI Tests

```typescript
// apps/web/components/git/__tests__/DraftPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftPanel } from '../DraftPanel';

vi.mock('@/hooks/use-github-status', () => ({
  useGitHubStatus: vi.fn(() => ({ data: { connected: true } })),
  useDrafts: vi.fn(() => ({
    drafts: [{ id: '1', name: 'Test Draft', status: 'editing', isActive: true }],
    submitDraft: vi.fn(),
    switchDraft: vi.fn(),
    switchToMain: vi.fn(),
    deleteDraft: vi.fn(),
    isSubmitting: false,
  })),
}));

describe('DraftPanel', () => {
  it('renders active draft name', () => {
    render(<DraftPanel workspace="test" open={true} onClose={() => {}} onNewDraft={() => {}} />);
    expect(screen.getByText('Test Draft')).toBeInTheDocument();
  });

  it('shows submit button for editing drafts', () => {
    render(<DraftPanel workspace="test" open={true} onClose={() => {}} onNewDraft={() => {}} />);
    expect(screen.getByText('Submit for Review')).toBeInTheDocument();
  });
});
```

**Run:** `bun test apps/web/components/git/__tests__/DraftPanel.test.tsx`

---

## Human Tests

1. Connect GitHub (if not connected)
2. Click "New Draft" button
3. **Verify:** Dialog appears with name input
4. Enter "Add contact form" and click Create
5. **Verify:** Header changes from "main" to show draft name
6. Click draft indicator in header
7. **Verify:** Panel opens showing draft details
8. **Verify:** "Submit for Review" button visible
9. Click "Submit for Review"
10. **Verify:** Loading state, then PR link appears
11. Click "New Draft" again, create "Fix header"
12. **Verify:** Can see both drafts, can switch between them
13. Click "Back to main"
14. **Verify:** Header shows "main" again

---

## Definition of Done

- [ ] NewDraftDialog component works
- [ ] DraftPanel component works
- [ ] ConflictDialog component works
- [ ] Can create drafts
- [ ] Can switch between drafts
- [ ] Can submit draft (mock PR)
- [ ] Can switch back to main
- [ ] Can delete merged/closed drafts
- [ ] Unit tests pass

# Phase 2: Connect Button UI

**Time:** 2 hours
**Depends on:** Phase 1
**Deliverable:** "Connect GitHub" button in Settings (mocked)

---

## Goal

Add a GitHub section to Settings with a connect button. Uses mock API - no real GitHub integration yet.

---

## Files to Create

### 1. Mock API

```typescript
// apps/web/lib/github/mock-api.ts
import type { GitStatus, Draft } from './types';

const STORAGE_KEY = 'mock-git-state';

interface MockState {
  connected: boolean;
  username: string | null;
  repo: { owner: string; name: string } | null;
}

function getState(): MockState {
  if (typeof window === 'undefined') {
    return { connected: false, username: null, repo: null };
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : { connected: false, username: null, repo: null };
}

function setState(state: MockState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const mockGitApi = {
  async connect(): Promise<void> {
    await delay(1500);
    setState({
      connected: true,
      username: 'demo-user',
      repo: { owner: 'demo-user', name: 'my-website' },
    });
  },

  async disconnect(): Promise<void> {
    await delay(500);
    setState({ connected: false, username: null, repo: null });
  },

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
      onMain: true,
      isDirty: false,
      changedFiles: 0,
      behindMain: 0,
    };
  },

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
```

### 2. API Wrapper

```typescript
// apps/web/lib/github/api.ts
import { mockGitApi } from './mock-api';

// Always use mock for now - real API added in Phase 5
export const gitApi = mockGitApi;
```

### 3. Hook

```typescript
// apps/web/hooks/use-github-status.ts
'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { gitApi } from '@/lib/github/api';
import { isGitHubEnabled } from '@/lib/github/feature-flag';

export function useGitHubStatus(workspace: string, userEmail?: string) {
  // Check both site AND user
  const enabled = isGitHubEnabled(workspace, userEmail);

  return useSWR(
    enabled ? ['github-status', workspace] : null,
    () => gitApi.getStatus(),
    { refreshInterval: 5000 }
  );
}

export function useConnectGitHub() {
  return useSWRMutation('connect-github', () => gitApi.connect());
}

export function useDisconnectGitHub() {
  return useSWRMutation('disconnect-github', () => gitApi.disconnect());
}
```

### 4. Component

```typescript
// apps/web/components/settings/GitHubSettings.tsx
'use client';

import { useState } from 'react';
import { Github, ExternalLink, Loader2 } from 'lucide-react';
import { useGitHubStatus, useConnectGitHub, useDisconnectGitHub } from '@/hooks/use-github-status';
import { useUser } from '@/hooks/use-user'; // Your existing user hook
import { isGitHubEnabled } from '@/lib/github/feature-flag';

export function GitHubSettings({ workspace }: { workspace: string }) {
  const { data: user } = useUser();
  const { data: status, isLoading, mutate } = useGitHubStatus(workspace, user?.email);
  const { trigger: connect, isMutating: connecting } = useConnectGitHub();
  const { trigger: disconnect, isMutating: disconnecting } = useDisconnectGitHub();
  const [showConfirm, setShowConfirm] = useState(false);

  // Feature flag check - requires BOTH admin site AND admin user
  if (!isGitHubEnabled(workspace, user?.email)) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="h-20 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // Not connected state
  if (!status?.connected) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <Github className="w-6 h-6" />
          <h3 className="font-medium">GitHub</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Connect to GitHub to create drafts and submit pull requests.
        </p>

        <button
          onClick={async () => {
            await connect();
            mutate();
          }}
          disabled={connecting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {connecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Github className="w-4 h-4" />
          )}
          {connecting ? 'Connecting...' : 'Connect GitHub'}
        </button>
      </div>
    );
  }

  // Connected state
  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Github className="w-6 h-6" />
          <h3 className="font-medium">GitHub</h3>
        </div>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
          Connected
        </span>
      </div>

      {status.repo && (
        <div className="text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Repository</span>
            <a
              href={status.repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline"
            >
              {status.repo.owner}/{status.repo.name}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="text-sm text-red-600 hover:underline"
        >
          Disconnect
        </button>
      ) : (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 mb-2">
            This will remove the GitHub connection.
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await disconnect();
                mutate();
                setShowConfirm(false);
              }}
              disabled={disconnecting}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              {disconnecting ? 'Disconnecting...' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1 text-sm text-muted-foreground hover:bg-muted rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## AI Tests

```typescript
// apps/web/components/settings/__tests__/GitHubSettings.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GitHubSettings } from '../GitHubSettings';

// Mock the feature flag
vi.mock('@/lib/github/feature-flag', () => ({
  isGitHubEnabled: vi.fn((workspace) => workspace === 'huurmatcher.alive.best'),
}));

// Mock SWR hooks
vi.mock('@/hooks/use-github-status', () => ({
  useGitHubStatus: vi.fn(() => ({
    data: { enabled: true, connected: false },
    isLoading: false,
  })),
  useConnectGitHub: vi.fn(() => ({ trigger: vi.fn(), isMutating: false })),
  useDisconnectGitHub: vi.fn(() => ({ trigger: vi.fn(), isMutating: false })),
}));

describe('GitHubSettings', () => {
  it('renders nothing for non-admin workspace', () => {
    const { container } = render(<GitHubSettings workspace="random.site.com" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders connect button for admin workspace', () => {
    render(<GitHubSettings workspace="huurmatcher.alive.best" />);
    expect(screen.getByText('Connect GitHub')).toBeInTheDocument();
  });
});
```

**Run:** `bun test apps/web/components/settings/__tests__/GitHubSettings.test.tsx`

---

## Human Tests

1. Go to `https://huurmatcher.alive.best`
2. Open Settings
3. **Verify:** See "GitHub" section with "Connect GitHub" button
4. Click "Connect GitHub"
5. **Verify:** Button shows loading state for 1.5s
6. **Verify:** Section changes to "Connected" with repo link
7. Click "Disconnect"
8. **Verify:** Confirmation dialog appears
9. Click "Confirm"
10. **Verify:** Back to "Connect GitHub" button

---

## Definition of Done

- [ ] `mock-api.ts` exists
- [ ] `api.ts` exists
- [ ] `use-github-status.ts` hook exists
- [ ] `GitHubSettings.tsx` component exists
- [ ] Component renders nothing for non-admin sites
- [ ] Component renders connect button for admin sites
- [ ] Mock connect/disconnect flow works
- [ ] Unit tests pass

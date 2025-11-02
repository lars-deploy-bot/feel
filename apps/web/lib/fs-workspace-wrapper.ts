/**
 * Filesystem Workspace Wrapper
 *
 * Monkey-patches Node.js fs module to use workspace credential switching
 * for Write and Edit operations initiated by Claude Agent SDK tools.
 *
 * CRITICAL: Only patch when handling Claude SDK requests, restore after.
 */

import * as fs from 'node:fs';
import { writeFileSyncAsWorkspaceUser } from './workspace-credentials';

// Store original functions
const originalWriteFileSync = fs.writeFileSync;
const originalMkdirSync = fs.mkdirSync;

// Current workspace path (set before SDK query, cleared after)
let currentWorkspacePath: string | null = null;

/**
 * Enable workspace-aware filesystem operations
 *
 * CRITICAL: Must be called BEFORE query() and AFTER query completes
 *
 * @param workspacePath - Workspace root path for credential switching
 */
export function enableWorkspaceFs(workspacePath: string): void {
  if (currentWorkspacePath !== null) {
    throw new Error('Workspace FS already enabled. Call disableWorkspaceFs() first.');
  }

  currentWorkspacePath = workspacePath;
  console.log(`[workspace-fs] Enabled for workspace: ${workspacePath}`);

  // Monkey-patch fs.writeFileSync
  (fs as any).writeFileSync = function patchedWriteFileSync(
    file: string,
    data: string | Buffer,
    options?: any
  ): void {
    const filePath = typeof file === 'string' ? file : file.toString();

    // Only intercept if file is within current workspace
    if (currentWorkspacePath && filePath.includes(currentWorkspacePath)) {
      console.log(`[workspace-fs] Intercepted writeFileSync: ${filePath}`);
      writeFileSyncAsWorkspaceUser(filePath, data, currentWorkspacePath);
      return;
    }

    // Otherwise use original
    return originalWriteFileSync.call(fs, file, data, options);
  };

  console.log('[workspace-fs] Patched fs.writeFileSync');
}

/**
 * Restore original filesystem operations
 *
 * CRITICAL: MUST be called after query() completes (in finally block)
 */
export function disableWorkspaceFs(): void {
  if (currentWorkspacePath === null) {
    console.warn('[workspace-fs] Already disabled or never enabled');
    return;
  }

  console.log(`[workspace-fs] Disabling for workspace: ${currentWorkspacePath}`);
  currentWorkspacePath = null;

  // Restore original functions
  (fs as any).writeFileSync = originalWriteFileSync;

  console.log('[workspace-fs] Restored original fs functions');
}

/**
 * Safety check to ensure workspace FS is disabled
 * Call this at module load to ensure clean state
 */
export function ensureWorkspaceFsDisabled(): void {
  if (currentWorkspacePath !== null) {
    console.error('[workspace-fs] CRITICAL: Workspace FS was left enabled! Forcing disable.');
    disableWorkspaceFs();
  }
}

// Ensure clean state at module load
ensureWorkspaceFsDisabled();

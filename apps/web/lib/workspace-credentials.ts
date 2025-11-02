/**
 * Workspace Credential Switching Utilities
 *
 * Provides safe, reversible process credential switching to create files
 * with correct ownership in multi-tenant workspace environments.
 *
 * SECURITY: This module uses seteuid/setegid to temporarily drop privileges
 * during file creation. All operations are synchronous to prevent async
 * interleaving. Multiple safeguards prevent credential leakage.
 */

import { statSync, realpathSync, lstatSync, constants, mkdirSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { dirname, join, sep, resolve, normalize } from 'node:path';

// ============================================================================
// Types & Constants
// ============================================================================

interface Credentials {
  uid: number;
  gid: number;
}

/**
 * Depth counter prevents nested credential switches
 * Global state is acceptable here - process credentials are global
 */
let switchDepth = 0;

// ============================================================================
// Runtime Capability Check
// ============================================================================

/**
 * Verify at module load that runtime supports effective UID/GID switching
 * Throws immediately if not available (fail-fast)
 */
function verifyRuntimeCapabilities(): void {
  if (typeof process.seteuid !== 'function' || typeof process.setegid !== 'function') {
    throw new Error(
      'FATAL: process.seteuid/setegid not available in this runtime. ' +
      'Credential switching requires Node.js with CAP_SETUID/CAP_SETGID capabilities.'
    );
  }

  if (typeof process.geteuid !== 'function' || typeof process.getegid !== 'function') {
    throw new Error(
      'FATAL: process.geteuid/getegid not available. ' +
      'Cannot verify current credentials.'
    );
  }
}

// Run check at module load
verifyRuntimeCapabilities();

// ============================================================================
// Path Security
// ============================================================================

/**
 * Verify a path is within workspace and contains no symlink components
 *
 * SECURITY: Prevents path traversal and symlink attacks
 * - Resolves all paths to real paths (no symlinks)
 * - Verifies target is within workspace boundary
 * - Checks each component of created paths for symlinks
 *
 * @throws Error if path escapes workspace or contains symlinks
 */
function verifyPathSecurity(filePath: string, workspacePath: string): void {
  // Get real path of workspace (resolve any symlinks in workspace itself)
  const wsRoot = realpathSync(workspacePath);

  // CRITICAL: Resolve path logically FIRST to catch path traversal attempts early
  // This catches ../../../etc/evil.txt BEFORE any filesystem operations
  // normalize() collapses .. and . segments WITHOUT touching filesystem
  const absolutePath = filePath.startsWith(sep) ? filePath : join(wsRoot, filePath);
  const normalizedPath = normalize(absolutePath);

  // Check if normalized path is within workspace
  if (!normalizedPath.startsWith(wsRoot + sep) && normalizedPath !== wsRoot) {
    throw new Error(`Path escapes workspace: ${filePath} -> ${normalizedPath} not under ${wsRoot}`);
  }

  // Check if parent directory exists (file may not exist yet for write)
  const dir = dirname(filePath);

  // For existing paths, verify no symlinks
  try {
    const realDir = realpathSync(dir);

    // Must be within workspace (or exactly the workspace root)
    if (!realDir.startsWith(wsRoot + sep) && realDir !== wsRoot) {
      throw new Error(`Path escapes workspace: ${filePath} -> ${realDir} not under ${wsRoot}`);
    }

    // Check file itself if it exists (verify not a symlink)
    try {
      const stat = lstatSync(filePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Refusing to write through symlink: ${filePath}`);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
      // File doesn't exist yet - OK
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // Parent directory doesn't exist - will be created
      // Verify the prefix that does exist is within workspace
      let checkPath = dir;
      while (checkPath.length > wsRoot.length) {
        try {
          const realCheck = realpathSync(checkPath);
          if (!realCheck.startsWith(wsRoot + sep) && realCheck !== wsRoot) {
            throw new Error(`Path prefix escapes workspace: ${checkPath}`);
          }
          break;
        } catch (e: any) {
          if (e.code === 'ENOENT') {
            checkPath = dirname(checkPath);
            continue;
          }
          throw e;
        }
      }
    } else {
      throw err;
    }
  }
}

// ============================================================================
// Workspace Owner Detection
// ============================================================================

/**
 * Get UID/GID of workspace owner by reading directory stats
 *
 * @param workspacePath - Path to workspace directory
 * @returns Credentials object with uid and gid
 * @throws Error if workspace doesn't exist or is inaccessible
 */
export function getWorkspaceCredentials(workspacePath: string): Credentials {
  try {
    const stats = statSync(workspacePath);
    return {
      uid: stats.uid,
      gid: stats.gid,
    };
  } catch (error) {
    throw new Error(`Failed to read workspace credentials for ${workspacePath}`, {
      cause: error,
    });
  }
}

// ============================================================================
// Credential Switching Core
// ============================================================================

/**
 * Execute operation as workspace user (not root)
 *
 * Temporarily switches EFFECTIVE UID/GID to match workspace owner,
 * executes operation, then restores root credentials.
 *
 * CRITICAL REQUIREMENTS:
 * - Process MUST be running as root (UID 0)
 * - Operation MUST be synchronous (no async/await)
 * - Uses seteuid/setegid (effective IDs) NOT setuid/setgid (real IDs)
 * - Sets known umask to ensure predictable file modes
 *
 * SECURITY:
 * - Verifies process is root before switching
 * - Refuses to switch to UID 0
 * - Detects and prevents nested switches
 * - Always restores credentials (finally block)
 * - Exits process if restoration fails (safer than continuing)
 * - Health check after restoration
 *
 * @param workspacePath - Path to workspace (e.g., /srv/webalive/sites/domain.com/user)
 * @param operation - SYNCHRONOUS operation to execute
 * @returns Result of the operation
 * @throws Error if preconditions not met
 */
export function asWorkspaceUser<T>(
  workspacePath: string,
  operation: () => T
): T {
  // ============================================================
  // Pre-flight Checks
  // ============================================================

  // Safety check: must be running as root
  const currentUid = process.getuid();
  if (currentUid !== 0) {
    throw new Error(
      `asWorkspaceUser requires process to run as root (current UID: ${currentUid})`
    );
  }

  // Safety check: detect nested calls
  if (switchDepth > 0) {
    throw new Error(
      'Nested asWorkspaceUser calls are not allowed. ' +
      'Complete current operation before starting another.'
    );
  }

  // Safety check: operation must not be async
  // Note: This doesn't catch sync functions that schedule async work internally
  // Callers must ensure operations are fully synchronous
  if (operation.constructor.name === 'AsyncFunction') {
    throw new Error(
      'asWorkspaceUser does not support async operations. ' +
      'Use synchronous operations only (e.g., writeFileSync instead of writeFile).'
    );
  }

  // Get workspace owner credentials
  const credentials = getWorkspaceCredentials(workspacePath);

  // Safety check: refuse to switch to root
  if (credentials.uid === 0) {
    throw new Error(
      'Refusing to switch to root workspace owner (UID 0). ' +
      'Workspace should be owned by site user, not root.'
    );
  }

  // ============================================================
  // Credential Switch
  // ============================================================

  const originalUid = process.geteuid();
  const originalGid = process.getegid();
  const originalUmask = process.umask();

  // Increment depth (detect reentrancy)
  switchDepth++;

  console.log(
    `[workspace-credentials] Switching from root (${originalUid}:${originalGid}) ` +
    `to workspace user (${credentials.uid}:${credentials.gid})`
  );

  try {
    // Switch to workspace user using EFFECTIVE IDs (reversible)
    // CRITICAL ORDER: setegid MUST come before seteuid (security requirement)
    process.setegid(credentials.gid);
    process.seteuid(credentials.uid);

    // Set known umask to ensure predictable file modes (022 = 644 files, 755 dirs)
    // CRITICAL: Without this, root's umask (often 077) will create 600/700
    process.umask(0o022);

    // Execute operation (files created here will have correct ownership)
    const result = operation();

    return result;
  } catch (error) {
    console.error(
      `[workspace-credentials] Operation failed as user ${credentials.uid}:${credentials.gid}:`,
      error
    );
    throw error;
  } finally {
    // ============================================================
    // Restore Credentials (ALWAYS, even on error)
    // ============================================================

    // Restore umask first
    try {
      process.umask(originalUmask);
    } catch (umaskError) {
      console.error('WARNING: Failed to restore umask:', umaskError);
      // Continue to restore credentials
    }

    // Restore root credentials
    // CRITICAL ORDER: seteuid MUST come before setegid when escalating
    try {
      process.seteuid(originalUid);
      process.setegid(originalGid);

      console.log(
        `[workspace-credentials] Restored root credentials (${originalUid}:${originalGid})`
      );
    } catch (restoreError) {
      // CRITICAL: If we can't restore credentials, process is in bad state
      // Safer to crash than continue with wrong credentials
      console.error(
        'FATAL: Failed to restore root credentials after operation!',
        restoreError
      );
      console.error('Process cannot continue safely. Exiting now.');
      process.exit(1);
    }

    // Decrement depth
    switchDepth--;

    // ============================================================
    // Health Check
    // ============================================================

    // Verify we're actually back to root
    const afterUid = process.geteuid();
    const afterGid = process.getegid();

    if (afterUid !== 0 || afterGid !== 0) {
      console.error(
        `CRITICAL: Not running as root after operation! ` +
        `Current: ${afterUid}:${afterGid}, Expected: 0:0`
      );
      console.error('Credential restoration failed. Exiting for safety.');
      process.exit(1);
    }
  }
}

// ============================================================================
// Safe File Operations
// ============================================================================

/**
 * Create directory with workspace user ownership
 *
 * SECURITY:
 * - Creates with mode 755 (readable/executable by all)
 * - Verifies path is within workspace
 * - Applies chmod after creation (survives umask issues)
 * - Detects symlink attacks
 *
 * @param dirPath - Directory path to create
 * @param workspacePath - Workspace root path
 */
export function mkdirSyncAsWorkspaceUser(
  dirPath: string,
  workspacePath: string
): void {
  verifyPathSecurity(dirPath, workspacePath);

  asWorkspaceUser(workspacePath, () => {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true, mode: 0o755 });
      // Belt & suspenders: explicit chmod to survive weird umasks
      chmodSync(dirPath, 0o755);
    }
  });
}

/**
 * Write file with workspace user ownership
 *
 * SECURITY:
 * - Creates with mode 644 (readable by all, writable by owner)
 * - Verifies path is within workspace
 * - Applies chmod after creation (survives umask issues)
 * - Detects symlink attacks
 * - Creates parent directories if needed
 *
 * @param filePath - File path to write
 * @param content - File content
 * @param workspacePath - Workspace root path
 */
export function writeFileSyncAsWorkspaceUser(
  filePath: string,
  content: string | Buffer,
  workspacePath: string
): void {
  verifyPathSecurity(filePath, workspacePath);

  asWorkspaceUser(workspacePath, () => {
    // Ensure parent directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o755 });
      // Only chmod directories we just created
      chmodSync(dir, 0o755);
    }

    // Write file
    writeFileSync(filePath, content, { mode: 0o644 });

    // Belt & suspenders: explicit chmod to survive weird umasks
    chmodSync(filePath, 0o644);
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  verifyPathSecurity,
  asWorkspaceUser as __asWorkspaceUser_DO_NOT_USE_DIRECTLY,
};

// Export safe wrappers as primary API
export default {
  getWorkspaceCredentials,
  mkdirSyncAsWorkspaceUser,
  writeFileSyncAsWorkspaceUser,
};

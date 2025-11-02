#!/usr/bin/env bun

/**
 * Test Script: Credential Switching for File Ownership
 *
 * This script tests the basic functionality of switching process credentials
 * to create files with correct ownership, before integrating into Claude Bridge.
 *
 * Usage:
 *   bun scripts/test-credential-switch.ts /srv/webalive/sites/one.goalive.nl/user
 *
 * Requirements:
 *   - Must run as root
 *   - Workspace path must exist
 *   - Workspace must be owned by a non-root user
 */

import { statSync, writeFileSync, mkdirSync, readFileSync, unlinkSync, rmdirSync, existsSync } from 'fs';
import { join } from 'path';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logStep(step: number, message: string) {
  log(`\n${colors.bold}${colors.cyan}[Step ${step}] ${message}${colors.reset}`);
}

// Core utility functions (to be moved to lib/workspace-credentials.ts)

interface Credentials {
  uid: number;
  gid: number;
}

function getWorkspaceCredentials(workspacePath: string): Credentials {
  try {
    const stats = statSync(workspacePath);
    return {
      uid: stats.uid,
      gid: stats.gid,
    };
  } catch (error) {
    throw new Error(`Failed to read workspace credentials: ${workspacePath}`, {
      cause: error,
    });
  }
}

function asWorkspaceUser<T>(workspacePath: string, operation: () => T): T {
  // Safety check: must be running as root
  const currentUid = process.getuid();
  if (currentUid !== 0) {
    throw new Error(
      `asWorkspaceUser requires process to run as root (current UID: ${currentUid})`
    );
  }

  // Get workspace owner credentials
  const credentials = getWorkspaceCredentials(workspacePath);

  // Safety check: don't switch to root
  if (credentials.uid === 0) {
    throw new Error('Refusing to switch to root user (UID 0)');
  }

  // Save current credentials (should be root: 0)
  const originalUid = process.getuid();
  const originalGid = process.getgid();

  logInfo(
    `  Switching: root (${originalUid}:${originalGid}) → workspace user (${credentials.uid}:${credentials.gid})`
  );

  try {
    // Switch to workspace user
    // IMPORTANT: Use seteuid/setegid (effective IDs) not setuid/setgid (real IDs)
    // seteuid/setegid are reversible, setuid/setgid are permanent
    // IMPORTANT: setegid MUST come before seteuid (security requirement)
    process.setegid(credentials.gid);
    process.seteuid(credentials.uid);

    logInfo(`  Current effective credentials: UID=${process.geteuid()} GID=${process.getegid()}`);

    // Execute operation (files created here will have correct ownership)
    return operation();
  } finally {
    // ALWAYS restore root credentials, even if operation fails
    // IMPORTANT: seteuid MUST come before setegid when escalating (reverse order)
    process.seteuid(originalUid);
    process.setegid(originalGid);

    logInfo(
      `  Restored: root (${process.geteuid()}:${process.getegid()})`
    );
  }
}

// Test functions

function testBasicFileCreation(workspacePath: string, testDir: string): boolean {
  logStep(1, 'Test Basic File Creation');

  const testFile = join(testDir, 'test-basic.txt');
  const testContent = 'Hello from workspace user!';

  try {
    // Create file as workspace user (with directory)
    asWorkspaceUser(workspacePath, () => {
      mkdirSync(testDir, { recursive: true, mode: 0o755 });
      writeFileSync(testFile, testContent, { mode: 0o644 });
    });

    // Verify file exists
    if (!existsSync(testFile)) {
      logError('File was not created');
      return false;
    }

    // Verify content
    const actualContent = readFileSync(testFile, 'utf-8');
    if (actualContent !== testContent) {
      logError(`Content mismatch: expected "${testContent}", got "${actualContent}"`);
      return false;
    }

    // Verify ownership
    const stats = statSync(testFile);
    const expectedCreds = getWorkspaceCredentials(workspacePath);

    if (stats.uid !== expectedCreds.uid || stats.gid !== expectedCreds.gid) {
      logError(
        `Ownership mismatch: expected ${expectedCreds.uid}:${expectedCreds.gid}, got ${stats.uid}:${stats.gid}`
      );
      return false;
    }

    // Verify mode
    const mode = stats.mode & 0o777;
    if (mode !== 0o644) {
      logError(`Mode mismatch: expected 644, got ${mode.toString(8)}`);
      return false;
    }

    logSuccess('File created with correct ownership and mode');
    logInfo(`  File: ${testFile}`);
    logInfo(`  Owner: ${stats.uid}:${stats.gid}`);
    logInfo(`  Mode: ${mode.toString(8)}`);
    return true;
  } catch (error) {
    logError(`Test failed: ${error}`);
    return false;
  }
}

function testDirectoryCreation(workspacePath: string, testDir: string): boolean {
  logStep(2, 'Test Directory Creation');

  const nestedDir = join(testDir, 'nested', 'deep', 'directory');

  try {
    // Create nested directories as workspace user
    asWorkspaceUser(workspacePath, () => {
      mkdirSync(nestedDir, { recursive: true, mode: 0o755 });
    });

    // Verify all directories exist and have correct ownership
    const expectedCreds = getWorkspaceCredentials(workspacePath);
    const dirsToCheck = [
      join(testDir, 'nested'),
      join(testDir, 'nested', 'deep'),
      nestedDir,
    ];

    for (const dir of dirsToCheck) {
      if (!existsSync(dir)) {
        logError(`Directory not created: ${dir}`);
        return false;
      }

      const stats = statSync(dir);

      if (stats.uid !== expectedCreds.uid || stats.gid !== expectedCreds.gid) {
        logError(
          `Ownership mismatch in ${dir}: expected ${expectedCreds.uid}:${expectedCreds.gid}, got ${stats.uid}:${stats.gid}`
        );
        return false;
      }

      const mode = stats.mode & 0o777;
      if (mode !== 0o755) {
        logError(`Mode mismatch in ${dir}: expected 755, got ${mode.toString(8)}`);
        return false;
      }
    }

    logSuccess('Directories created with correct ownership and mode');
    logInfo(`  Created ${dirsToCheck.length} nested directories`);
    return true;
  } catch (error) {
    logError(`Test failed: ${error}`);
    return false;
  }
}

function testCredentialRestoration(workspacePath: string, testDir: string): boolean {
  logStep(3, 'Test Credential Restoration');

  try {
    const beforeUid = process.geteuid();
    const beforeGid = process.getegid();

    if (beforeUid !== 0 || beforeGid !== 0) {
      logError(`Process not running as root before test: ${beforeUid}:${beforeGid}`);
      return false;
    }

    // Execute operation
    asWorkspaceUser(workspacePath, () => {
      // Just a dummy operation
      return true;
    });

    // Check if credentials were restored
    const afterUid = process.geteuid();
    const afterGid = process.getegid();

    if (afterUid !== 0 || afterGid !== 0) {
      logError(`Credentials not restored to root: ${afterUid}:${afterGid}`);
      return false;
    }

    logSuccess('Credentials correctly restored to root');
    logInfo(`  Before: ${beforeUid}:${beforeGid}`);
    logInfo(`  After: ${afterUid}:${afterGid}`);
    return true;
  } catch (error) {
    logError(`Test failed: ${error}`);
    return false;
  }
}

function testErrorHandlingWithRestore(workspacePath: string, testDir: string): boolean {
  logStep(4, 'Test Error Handling with Credential Restoration');

  try {
    const beforeUid = process.geteuid();
    const beforeGid = process.getegid();

    // Execute operation that throws error
    try {
      asWorkspaceUser(workspacePath, () => {
        throw new Error('Intentional test error');
      });
      logError('Expected error was not thrown');
      return false;
    } catch (error: any) {
      if (!error.message.includes('Intentional test error')) {
        logError(`Wrong error caught: ${error.message}`);
        return false;
      }
    }

    // Check if credentials were restored despite error
    const afterUid = process.geteuid();
    const afterGid = process.getegid();

    if (afterUid !== 0 || afterGid !== 0) {
      logError(`Credentials not restored after error: ${afterUid}:${afterGid}`);
      return false;
    }

    logSuccess('Credentials restored even after error');
    logInfo(`  Before: ${beforeUid}:${beforeGid}`);
    logInfo(`  After error: ${afterUid}:${afterGid}`);
    return true;
  } catch (error) {
    logError(`Test failed: ${error}`);
    return false;
  }
}

function testFileAndDirTogether(workspacePath: string, testDir: string): boolean {
  logStep(5, 'Test File Creation with Directory Creation (Combined)');

  const componentDir = join(testDir, 'components', 'test');
  const componentFile = join(componentDir, 'Component.tsx');
  const componentContent = `export default function TestComponent() {
  return <div>Test</div>;
}`;

  try {
    // Create directory and file in one operation (mimics Claude Write tool behavior)
    asWorkspaceUser(workspacePath, () => {
      mkdirSync(componentDir, { recursive: true, mode: 0o755 });
      writeFileSync(componentFile, componentContent, { mode: 0o644 });
    });

    // Verify directory
    const dirStats = statSync(componentDir);
    const expectedCreds = getWorkspaceCredentials(workspacePath);

    if (dirStats.uid !== expectedCreds.uid || dirStats.gid !== expectedCreds.gid) {
      logError('Directory has wrong ownership');
      return false;
    }

    const dirMode = dirStats.mode & 0o777;
    if (dirMode !== 0o755) {
      logError(`Directory has wrong mode: ${dirMode.toString(8)}`);
      return false;
    }

    // Verify file
    const fileStats = statSync(componentFile);

    if (fileStats.uid !== expectedCreds.uid || fileStats.gid !== expectedCreds.gid) {
      logError('File has wrong ownership');
      return false;
    }

    const fileMode = fileStats.mode & 0o777;
    if (fileMode !== 0o644) {
      logError(`File has wrong mode: ${fileMode.toString(8)}`);
      return false;
    }

    logSuccess('Directory and file created together with correct ownership');
    logInfo(`  Directory: ${componentDir} (755, ${dirStats.uid}:${dirStats.gid})`);
    logInfo(`  File: ${componentFile} (644, ${fileStats.uid}:${fileStats.gid})`);
    return true;
  } catch (error) {
    logError(`Test failed: ${error}`);
    return false;
  }
}

// Cleanup function
function cleanup(testDir: string) {
  logStep(6, 'Cleanup Test Files');

  try {
    if (existsSync(testDir)) {
      // Remove all test files and directories
      const { execSync } = require('child_process');
      execSync(`rm -rf "${testDir}"`, { stdio: 'ignore' });
      logSuccess('Test files cleaned up');
    }
  } catch (error) {
    logWarning(`Cleanup failed: ${error}`);
  }
}

// Main test runner
function main() {
  log('\n' + '='.repeat(60), 'bold');
  log('  Test: Credential Switching for File Ownership', 'bold');
  log('='.repeat(60) + '\n', 'bold');

  // Parse arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    logError('Usage: bun scripts/test-credential-switch.ts <workspace-path>');
    logInfo('Example: bun scripts/test-credential-switch.ts /srv/webalive/sites/one.goalive.nl/user');
    process.exit(1);
  }

  const workspacePath = args[0];

  // Pre-flight checks
  logInfo('Pre-flight checks...');

  // Check if running as root
  if (process.getuid() !== 0) {
    logError(`Must run as root. Current UID: ${process.getuid()}`);
    logInfo('Try: sudo bun scripts/test-credential-switch.ts <workspace-path>');
    process.exit(1);
  }
  logSuccess('Running as root (UID 0)');

  // Check if workspace exists
  if (!existsSync(workspacePath)) {
    logError(`Workspace does not exist: ${workspacePath}`);
    process.exit(1);
  }
  logSuccess(`Workspace exists: ${workspacePath}`);

  // Check workspace ownership
  const workspaceCreds = getWorkspaceCredentials(workspacePath);
  if (workspaceCreds.uid === 0) {
    logError('Workspace is owned by root. Need a workspace owned by a site user.');
    process.exit(1);
  }
  logSuccess(`Workspace owned by: UID ${workspaceCreds.uid}, GID ${workspaceCreds.gid}`);

  // Setup test directory
  const testDir = join(workspacePath, 'test-credential-switch');
  logInfo(`Test directory: ${testDir}\n`);

  // Run tests
  const results: { name: string; passed: boolean }[] = [];

  results.push({
    name: 'Basic File Creation',
    passed: testBasicFileCreation(workspacePath, testDir),
  });

  results.push({
    name: 'Directory Creation',
    passed: testDirectoryCreation(workspacePath, testDir),
  });

  results.push({
    name: 'Credential Restoration',
    passed: testCredentialRestoration(workspacePath, testDir),
  });

  results.push({
    name: 'Error Handling with Restore',
    passed: testErrorHandlingWithRestore(workspacePath, testDir),
  });

  results.push({
    name: 'File and Directory Together',
    passed: testFileAndDirTogether(workspacePath, testDir),
  });

  // Cleanup
  cleanup(testDir);

  // Summary
  log('\n' + '='.repeat(60), 'bold');
  log('  Test Results Summary', 'bold');
  log('='.repeat(60), 'bold');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`  ${icon} ${result.name}`, color);
  });

  log('\n' + '-'.repeat(60), 'bold');
  if (passed === total) {
    logSuccess(`All tests passed! (${passed}/${total})`);
    log('\n✨ Credential switching works correctly!', 'green');
    log('   Ready to integrate into Claude Bridge.\n', 'green');
    process.exit(0);
  } else {
    logError(`Some tests failed: ${passed}/${total} passed`);
    log('\n⚠️  Do not integrate until all tests pass.\n', 'yellow');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

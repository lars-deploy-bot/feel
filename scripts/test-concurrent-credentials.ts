#!/usr/bin/env bun

/**
 * Test: Concurrent Credential Switching
 *
 * Tests whether multiple simultaneous calls to asWorkspaceUser()
 * can cause credential corruption or race conditions.
 */

import { statSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

// Utility functions (same as test-credential-switch.ts)
interface Credentials {
  uid: number;
  gid: number;
}

function getWorkspaceCredentials(workspacePath: string): Credentials {
  const stats = statSync(workspacePath);
  return { uid: stats.uid, gid: stats.gid };
}

function asWorkspaceUser<T>(workspacePath: string, operation: () => T): T {
  const credentials = getWorkspaceCredentials(workspacePath);
  const originalUid = process.getuid();
  const originalGid = process.getgid();

  try {
    process.setegid(credentials.gid);
    process.seteuid(credentials.uid);
    return operation();
  } finally {
    process.seteuid(originalUid);
    process.setegid(originalGid);
  }
}

// Simulate concurrent requests
async function testConcurrentSynchronous(workspace: string) {
  console.log('\n🧪 Test 1: Concurrent Synchronous Operations');
  console.log('   (Should be SAFE - operations cannot interleave)');

  const testDir = join(workspace, 'test-concurrent-sync');

  // Create directory as workspace user to avoid permission issues
  asWorkspaceUser(workspace, () => {
    mkdirSync(testDir, { recursive: true, mode: 0o755 });
  });

  // Start 3 "concurrent" operations
  const promises = [
    Promise.resolve().then(() => {
      console.log('  [Request 1] Starting...');
      asWorkspaceUser(workspace, () => {
        console.log(`    [Request 1] Writing as UID=${process.geteuid()}`);
        writeFileSync(join(testDir, 'file1.txt'), 'Request 1', { mode: 0o644 });
        // Simulate slow operation
        const start = Date.now();
        while (Date.now() - start < 100) {} // Busy wait 100ms
      });
      console.log(`  [Request 1] Completed as UID=${process.geteuid()}`);
    }),

    Promise.resolve().then(() => {
      console.log('  [Request 2] Starting...');
      asWorkspaceUser(workspace, () => {
        console.log(`    [Request 2] Writing as UID=${process.geteuid()}`);
        writeFileSync(join(testDir, 'file2.txt'), 'Request 2', { mode: 0o644 });
        const start = Date.now();
        while (Date.now() - start < 100) {} // Busy wait 100ms
      });
      console.log(`  [Request 2] Completed as UID=${process.geteuid()}`);
    }),

    Promise.resolve().then(() => {
      console.log('  [Request 3] Starting...');
      asWorkspaceUser(workspace, () => {
        console.log(`    [Request 3] Writing as UID=${process.geteuid()}`);
        writeFileSync(join(testDir, 'file3.txt'), 'Request 3', { mode: 0o644 });
        const start = Date.now();
        while (Date.now() - start < 100) {} // Busy wait 100ms
      });
      console.log(`  [Request 3] Completed as UID=${process.geteuid()}`);
    }),
  ];

  await Promise.all(promises);

  // Verify all files created with correct ownership
  const expectedCreds = getWorkspaceCredentials(workspace);
  let allCorrect = true;

  for (let i = 1; i <= 3; i++) {
    const file = join(testDir, `file${i}.txt`);
    const stats = statSync(file);
    const correct = stats.uid === expectedCreds.uid && stats.gid === expectedCreds.gid;

    console.log(`  File ${i}: ${correct ? '✅' : '❌'} Owner=${stats.uid}:${stats.gid}`);
    if (!correct) allCorrect = false;
  }

  // Cleanup
  rmSync(testDir, { recursive: true });

  return allCorrect;
}

async function testConcurrentWithAsync(workspace: string) {
  console.log('\n🧪 Test 2: Concurrent with Async Operations');
  console.log('   (DANGEROUS - operations CAN interleave)');

  const testDir = join(workspace, 'test-concurrent-async');

  // Create directory as workspace user
  asWorkspaceUser(workspace, () => {
    mkdirSync(testDir, { recursive: true, mode: 0o755 });
  });

  let raceConditionDetected = false;

  const promises = [
    (async () => {
      console.log('  [Request A] Starting...');
      try {
        const credentials = getWorkspaceCredentials(workspace);
        const originalUid = process.getuid();

        process.setegid(credentials.gid);
        process.seteuid(credentials.uid);
        console.log(`    [Request A] Switched to UID=${process.geteuid()}`);

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 50));

        const currentUid = process.geteuid();
        console.log(`    [Request A] After await, UID=${currentUid}`);

        if (currentUid !== credentials.uid) {
          console.log('    ⚠️  [Request A] RACE CONDITION! UID changed during async!');
          raceConditionDetected = true;
        }

        writeFileSync(join(testDir, 'fileA.txt'), 'Request A', { mode: 0o644 });

        process.seteuid(originalUid);
        process.setegid(0);
      } catch (error) {
        console.error('    [Request A] Error:', error);
      }
      console.log(`  [Request A] Completed as UID=${process.geteuid()}`);
    })(),

    (async () => {
      // Start shortly after Request A
      await new Promise(resolve => setTimeout(resolve, 10));

      console.log('  [Request B] Starting...');
      try {
        const credentials = getWorkspaceCredentials(workspace);
        const originalUid = process.getuid();

        console.log(`    [Request B] Attempting switch to UID=${credentials.uid}`);
        process.setegid(credentials.gid);
        process.seteuid(credentials.uid);
        console.log(`    [Request B] Switched to UID=${process.geteuid()}`);

        await new Promise(resolve => setTimeout(resolve, 50));

        const currentUid = process.geteuid();
        console.log(`    [Request B] After await, UID=${currentUid}`);

        writeFileSync(join(testDir, 'fileB.txt'), 'Request B', { mode: 0o644 });

        process.seteuid(originalUid);
        process.setegid(0);
      } catch (error) {
        console.error('    [Request B] Error:', error);
      }
      console.log(`  [Request B] Completed as UID=${process.geteuid()}`);
    })(),
  ];

  await Promise.all(promises);

  // Cleanup
  rmSync(testDir, { recursive: true });

  return !raceConditionDetected;
}

// Main
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Test: Concurrent Credential Switching Safety');
  console.log('='.repeat(60));

  const workspace = process.argv[2];
  if (!workspace) {
    console.error('Usage: bun scripts/test-concurrent-credentials.ts <workspace-path>');
    process.exit(1);
  }

  if (process.getuid() !== 0) {
    console.error('❌ Must run as root');
    process.exit(1);
  }

  if (!existsSync(workspace)) {
    console.error(`❌ Workspace not found: ${workspace}`);
    process.exit(1);
  }

  console.log(`\n📁 Workspace: ${workspace}`);
  console.log(`👤 Workspace Owner: UID=${getWorkspaceCredentials(workspace).uid}`);

  const test1 = await testConcurrentSynchronous(workspace);
  const test2 = await testConcurrentWithAsync(workspace);

  console.log('\n' + '='.repeat(60));
  console.log('  Results:');
  console.log('='.repeat(60));
  console.log(`  ${test1 ? '✅' : '❌'} Synchronous operations: ${test1 ? 'SAFE' : 'UNSAFE'}`);
  console.log(`  ${test2 ? '✅' : '❌'} Async operations: ${test2 ? 'SAFE' : 'UNSAFE (EXPECTED)'}`);

  console.log('\n📝 Conclusion:');
  if (test1 && !test2) {
    console.log('   ✅ Synchronous operations are safe for concurrent use');
    console.log('   ⚠️  Async operations CAN cause race conditions');
    console.log('   ➡️  MUST use synchronous operations only!');
  } else if (test1 && test2) {
    console.log('   ✅ Both safe (unexpected - further investigation needed)');
  } else {
    console.log('   ❌ Race conditions detected - implementation unsafe!');
  }

  console.log('');
}

main();

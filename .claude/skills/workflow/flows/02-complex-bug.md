# Skill Workflow: Complex Bug Investigation & Fix

## Scenario
User reports: "There's a bug with [feature] - [symptoms]"
- Root cause unknown or unclear
- Bug is intermittent or hard to reproduce
- Affects multiple files or systems
- Requires investigation and debugging

## Available Skills
- `root-cause-analysis` - Deep problem investigation
- `fix-bug-when-stuck` - Debugging assistance when blocked
- `scout` - Maps related code and dependencies
- `plan-maker` - Creates fix plan
- `testing` - Runs test suite
- `critical-reviewer` - Reviews fix quality

## Decision Tree

```
START: User reports bug with unclear cause
│
├─→ INVESTIGATION PHASE:
│   ├─→ root-cause-analysis: Deep investigation
│   │   └─→ Analyzes:
│   │       - Error messages and logs
│   │       - Stack traces
│   │       - Recent changes (git history)
│   │       - Related code patterns
│   │       - Reproduction steps
│   │       - Environment factors
│   │
│   ├─→ Check: Root cause identified?
│   │   ├─→ YES: Continue to DEPENDENCY MAPPING
│   │   └─→ NO: Continue to DEBUGGING ASSISTANCE
│   │
│   └─→ fix-bug-when-stuck: Unsticking helper
│       └─→ Provides:
│           - Alternative investigation approaches
│           - Common patterns for similar bugs
│           - Diagnostic techniques
│           - Hypothesis generation
│
├─→ DEPENDENCY MAPPING PHASE:
│   └─→ scout: Map affected systems
│       └─→ Identifies:
│           - All files involved in bug
│           - Related functionality
│           - Test files to update
│           - Potential side effects of fix
│
├─→ PLANNING PHASE:
│   └─→ plan-maker: Create fix plan
│       └─→ Plan includes:
│           - Root cause explanation
│           - Fix approach
│           - Test strategy
│           - Risk assessment
│           - Rollback plan if needed
│
├─→ IMPLEMENTATION PHASE:
│   └─→ [Claude implements fix]
│       - Apply fix to all affected files
│       - Add comprehensive tests
│       - Add defensive checks
│       - Update error handling
│
├─→ TESTING PHASE:
│   └─→ testing: Run comprehensive tests
│       ├─→ IF FAIL: Analyze → Fix → Re-test
│       └─→ IF PASS: Continue
│
├─→ REVIEW PHASE:
│   └─→ critical-reviewer: Rigorous review
│       ├─→ Checks:
│       │   - Root cause properly addressed
│       │   - No new bugs introduced
│       │   - Edge cases handled
│       │   - Error handling robust
│       │   - Test coverage sufficient
│       │   - Documentation updated
│       │
│       ├─→ IF MAJOR ISSUES: Loop back to PLANNING
│       ├─→ IF MINOR ISSUES: Fix → Re-review
│       └─→ IF APPROVED: COMPLETE
│
└─→ VERIFICATION PHASE:
    └─→ Verify fix in original bug scenario
        └─→ COMPLETE
```

## Skill Sequence

```
1. root-cause-analysis: Investigate bug deeply
2. IF STUCK: fix-bug-when-stuck: Get unstuck
3. scout: Map all affected code
4. plan-maker: Create comprehensive fix plan
5. [Implement]: Apply fix + comprehensive tests
6. testing: Run full test suite
7. critical-reviewer: Rigorous review
   ├─→ IF MAJOR ISSUES: → plan-maker (loop, iteration 2)
   ├─→ IF MINOR ISSUES: Fix → critical-reviewer
   └─→ IF APPROVED: Continue
8. COMPLETE
```

## Investigation Strategies

### Strategy 1: Error-Driven Investigation
```
1. Collect error messages/stack traces
2. root-cause-analysis analyzes errors
3. Trace execution path backwards from error
4. Identify where data becomes invalid
5. Find root cause
```

### Strategy 2: Reproduction-Based Investigation
```
1. Establish reproduction steps
2. Add logging/debugging at key points
3. root-cause-analysis identifies divergence point
4. Narrow down to specific code section
5. Find root cause
```

### Strategy 3: Differential Analysis
```
1. Compare: "working" vs "broken" scenarios
2. root-cause-analysis identifies differences
3. Isolate the differentiating factor
4. Trace that factor to root cause
```

### Strategy 4: Timeline Analysis
```
1. Check git history: when did bug start?
2. root-cause-analysis examines recent changes
3. Identify likely commit
4. Understand what changed
5. Find root cause
```

## When to Use fix-bug-when-stuck

Invoke fix-bug-when-stuck if:
- Investigation has taken > 15 minutes without clarity
- Multiple hypotheses, unclear which is correct
- Bug is intermittent and hard to reproduce
- Need fresh perspective or alternative approach
- Stack trace is confusing or misleading
- Environment-specific issues suspected

## Parallel Execution Opportunities

**During Investigation:**
```
root-cause-analysis || scout
(Investigate bug while mapping related code)
```

**During Fix:**
```
If bug affects multiple independent modules:
Fix module A || Fix module B || Fix module C
Then: testing reviews all fixes together
```

## Critical Rules

1. **Never guess at root cause** - Investigate thoroughly
2. **Use root-cause-analysis first** - Don't skip investigation
3. **Document findings** - Help future debugging
4. **Test extensively** - Complex bugs need comprehensive tests
5. **Consider edge cases** - Bug might reveal broader issues
6. **Max 3 iterations** - Escalate if still broken after 3 tries
7. **Add defensive code** - Prevent similar bugs
8. **Update documentation** - Explain the fix

## Review Criteria for Complex Fixes

critical-reviewer checks:
- [ ] Root cause thoroughly understood and addressed
- [ ] Fix handles all edge cases
- [ ] Comprehensive test coverage (including regression tests)
- [ ] Error handling improved
- [ ] Logging added for future debugging
- [ ] No performance regressions
- [ ] Documentation updated
- [ ] Similar patterns checked for same bug

## Common Bug Patterns

### Race Conditions
```
Investigation: root-cause-analysis focuses on timing
Fix: Add proper synchronization, locks, or queuing
Test: Add tests with delays and concurrent operations
```

### Memory Leaks
```
Investigation: scout maps lifecycle and cleanup
Fix: Add proper cleanup in unmount/dispose
Test: Add tests that create/destroy multiple times
```

### Null/Undefined Handling
```
Investigation: root-cause-analysis traces data flow
Fix: Add validation and null checks
Test: Add tests with null/undefined inputs
```

### Async Issues
```
Investigation: root-cause-analysis examines promise chains
Fix: Add proper await, error handling
Test: Add tests for async edge cases
```

### State Management Bugs
```
Investigation: scout maps state flow
Fix: Correct state updates, add immutability
Test: Add state transition tests
```

## Common Mistakes

❌ Jumping to fix without understanding root cause
❌ Fixing symptom instead of underlying problem
❌ Not checking for similar bugs elsewhere
❌ Insufficient testing of edge cases
❌ Not adding defensive code to prevent recurrence
❌ Ignoring environment-specific factors
❌ Not documenting the investigation findings
❌ Giving up too early on investigation

## Example: Intermittent Authentication Failure

**Request**: "Users are randomly getting logged out - happens sometimes but not always"

**Execution**:
```
WORKFLOW STATE: Complex Bug Investigation
Stage: 1/8 (Investigation)

1. INVESTIGATION:
   root-cause-analysis:
   - Symptom: Random logouts
   - Not reproducible consistently
   - No error messages in logs
   - Started after recent session changes

   Findings:
   - Session token expiry not being checked correctly
   - Race condition between token refresh and API calls
   - Tokens expiring during long-running requests

2. STUCK CHECK:
   - Root cause becoming clear, no need for fix-bug-when-stuck

3. DEPENDENCY MAPPING:
   scout:
   - Maps all auth-related files
   - Identifies: middleware, session store, token refresh logic
   - Related: 8 files across auth system
   - Test files: 4 files need updates

WORKFLOW STATE: Complex Bug Investigation
Stage: 4/8 (Planning)

4. PLANNING:
   plan-maker:
   Plan:
   - Fix race condition in token refresh
   - Add token expiry buffer (refresh 5min early)
   - Improve error handling in middleware
   - Add retry logic for failed token refreshes
   - Comprehensive logging for debugging

   Test Strategy:
   - Test expired tokens
   - Test concurrent API calls during refresh
   - Test long-running requests
   - Test network failures during refresh

WORKFLOW STATE: Complex Bug Investigation
Stage: 5/8 (Implementation)

5. IMPLEMENTATION:
   Files modified:
   - apps/web/middleware/auth.ts (token refresh logic)
   - apps/web/lib/session.ts (expiry buffer)
   - apps/web/lib/api-client.ts (retry logic)

   Files created:
   - apps/web/lib/__tests__/auth-race-conditions.test.ts

   Changes:
   - Added mutex for token refresh (prevents race)
   - Token refreshes 5min before expiry
   - API calls wait for ongoing refresh
   - Retry up to 3 times on auth failure
   - Comprehensive logging added

WORKFLOW STATE: Complex Bug Investigation
Stage: 6/8 (Testing)

6. TESTING:
   testing:
   - All existing tests: PASS
   - New race condition tests: PASS
   - Edge case tests: PASS
   - Load test with concurrent requests: PASS

WORKFLOW STATE: Complex Bug Investigation
Stage: 7/8 (Review - Iteration 1)

7. REVIEW (Iteration 1):
   critical-reviewer:
   FEEDBACK: Issues found
   - Mutex implementation could deadlock
   - Should use AbortController for request cancellation
   - Missing test for network failure during refresh
   - Logging might leak sensitive tokens

WORKFLOW STATE: Complex Bug Investigation
Stage: 4/8 (Re-planning - Iteration 2)

8. LOOP TO PLANNING (Iteration 2):
   plan-maker:
   Revised plan:
   - Replace mutex with simpler flag + promise caching
   - Add AbortController for clean cancellation
   - Add network failure test
   - Sanitize logs (redact tokens)

9. IMPLEMENTATION (Iteration 2):
   - Simplified synchronization mechanism
   - Added request cancellation
   - Added network failure test
   - Sanitized all log statements

10. TESTING (Iteration 2):
    testing:
    - All tests including new ones: PASS

WORKFLOW STATE: Complex Bug Investigation
Stage: 7/8 (Review - Iteration 2)

11. REVIEW (Iteration 2):
    critical-reviewer:
    APPROVED ✓
    - Race condition eliminated
    - Error handling robust
    - Test coverage comprehensive
    - Logging secure and helpful
    - Code quality excellent

WORKFLOW STATE: Complex Bug Investigation
Stage: 8/8 (Complete)

12. VERIFICATION:
    - Tested original bug scenario: FIXED
    - Monitored for 10 test runs: No random logouts
    - Edge cases working correctly

✓ WORKFLOW COMPLETE

Summary:
- Fixed race condition in token refresh
- Added 5-minute expiry buffer
- Implemented retry logic with cancellation
- Added comprehensive tests (15 new test cases)
- Improved logging (secure, helpful)
- No more random logouts

Files changed: 3 modified, 1 created
Tests added: 15 new test cases
Review iterations: 2
```

## Success Criteria

Complex bug fix is complete when:
- [ ] Root cause thoroughly understood
- [ ] Fix addresses root cause (not symptom)
- [ ] All edge cases handled
- [ ] Comprehensive tests added (including regression)
- [ ] Error handling improved
- [ ] Logging added for future debugging
- [ ] critical-reviewer approved
- [ ] Original bug scenario verified fixed
- [ ] No regressions introduced
- [ ] Documentation updated

## Time Expectations

Complex bug investigations vary widely:
- Investigation: 10-30 minutes
- Planning: 5-10 minutes
- Implementation: 10-30 minutes
- Testing: 5-10 minutes
- Review: 5-10 minutes

**Total: 35-90 minutes** (depending on complexity)

Multiple iterations may extend this significantly.

## When to Escalate

Escalate to user if:
- After 3 iterations, bug still not fixed
- Root cause cannot be determined after thorough investigation
- Fix requires breaking changes or major refactoring
- Bug is in external dependency or system limitation
- Need production data or logs to diagnose
- Requires domain knowledge you don't have

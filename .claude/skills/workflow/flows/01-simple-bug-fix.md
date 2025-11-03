# Skill Workflow: Simple Bug Fix

## Scenario
User reports: "Fix [specific bug] in [file/feature]"
- Bug location is known or easily identified
- Root cause is clear or suspected
- Fix affects < 50 lines in 1-2 files
- Low complexity, low risk

## Available Skills
- `plan-maker` - Creates fix plan
- `testing` - Runs test suite
- `critical-reviewer` - Reviews fix quality

## Decision Tree

```
START: User reports simple bug with known location
│
├─→ VERIFICATION PHASE:
│   ├─→ Check: Can you reproduce/understand the bug?
│   │   ├─→ YES: Continue
│   │   └─→ NO: Switch to 02-complex-bug.md workflow
│   │
│   ├─→ Check: Is fix scope really simple?
│   │   ├─→ Single file, < 50 lines: YES, continue
│   │   └─→ Multiple files or complex: Switch to 02-complex-bug.md
│   │
│   └─→ Check: Do you know the root cause?
│       ├─→ YES: Continue
│       └─→ NO: Switch to 02-complex-bug.md workflow
│
├─→ PLANNING PHASE:
│   └─→ plan-maker: Create fix plan
│       └─→ Plan includes:
│           - Root cause analysis
│           - Proposed fix approach
│           - Test strategy
│           - Potential side effects
│
├─→ IMPLEMENTATION PHASE:
│   └─→ [Claude implements fix]
│       - Apply fix to affected file(s)
│       - Update/add tests
│       - Verify no regressions
│
├─→ TESTING PHASE:
│   └─→ testing: Run test suite
│       ├─→ IF FAIL: Analyze, fix, re-test
│       └─→ IF PASS: Continue
│
├─→ REVIEW PHASE:
│   └─→ critical-reviewer: Review fix
│       ├─→ IF ISSUES: Fix → critical-reviewer (max 2 loops)
│       └─→ IF APPROVED: COMPLETE
│
└─→ COMPLETE
```

## Skill Sequence

```
1. plan-maker: Create fix plan
2. [Implement]: Apply fix + update tests
3. testing: Run test suite
4. critical-reviewer: Review fix
   ├─→ IF ISSUES: Fix → critical-reviewer (max 2 loops)
   └─→ IF APPROVED: COMPLETE
5. COMPLETE
```

## Parallel Execution

For simple bugs, execution is mostly sequential due to dependencies.

**Exception - Multiple Independent Bugs:**
```
If fixing: typo in error message || unused import || console.log removal
These can be fixed in one pass, then:
1. plan-maker (one plan covering all fixes)
2. [Implement all fixes]
3. testing (one test run)
4. critical-reviewer (one review)
```

## Critical Rules

1. **Verify it's actually simple** - If uncertain, use complex-bug workflow
2. **Always create a plan** - Even simple fixes benefit from thinking first
3. **Always add/update tests** - Prevent regression
4. **Never skip testing** - Even "obvious" fixes can break things
5. **Max 2 review iterations** - If stuck after 2, escalate or switch workflows
6. **Check for similar bugs** - Fix might apply to other locations

## When to Switch Workflows

**Switch to 02-complex-bug.md if:**
- Root cause is unclear after 5 minutes
- Fix affects 3+ files
- Bug is intermittent or hard to reproduce
- Multiple potential causes identified
- Involves race conditions, async issues, or timing
- Requires significant refactoring

**Switch to 04-refactoring.md if:**
- Fix reveals larger code quality issues
- "Fixing properly" requires restructuring
- Multiple similar bugs suggest pattern problem

## Review Criteria for Simple Fixes

critical-reviewer checks:
- [ ] Fix addresses root cause (not just symptom)
- [ ] No new bugs introduced
- [ ] Test coverage for the fix
- [ ] Code style consistency
- [ ] Error handling appropriate
- [ ] No security implications

## Common Mistakes

❌ Fixing symptoms instead of root cause
❌ Not adding tests for the bug
❌ Assuming "it's simple" without verification
❌ Not checking for similar bugs elsewhere
❌ Skipping critical-reviewer for "trivial" fixes
❌ Breaking changes without realizing impact
❌ Not testing edge cases

## Examples

### Example 1: Off-by-one Error

**Request**: "Fix the pagination bug where last item is cut off"

**Execution**:
```
1. VERIFICATION:
   - Bug location: src/components/Pagination.tsx:45
   - Root cause: Using < instead of <=
   - Scope: Single line fix
   - Complexity: Simple ✓

2. PLANNING:
   plan-maker:
   - Change `i < total` to `i <= total`
   - Add test for edge case
   - Verify all paginated components

3. IMPLEMENTATION:
   - Fix condition in Pagination.tsx
   - Add test case for last item
   - Manual verification

4. TESTING:
   testing: All tests pass ✓

5. REVIEW:
   critical-reviewer:
   - Fix is correct
   - Test coverage good
   - APPROVED ✓

6. COMPLETE
```

### Example 2: Typo in API Response

**Request**: "Fix typo in error message: 'sucessful' → 'successful'"

**Execution**:
```
1. VERIFICATION:
   - Location: apps/web/app/api/auth/route.ts:78
   - Scope: String literal change
   - Complexity: Trivial ✓

2. PLANNING:
   plan-maker:
   - Fix typo in error message
   - Check for same typo elsewhere
   - Update tests if they check exact message

3. IMPLEMENTATION:
   - Fix typo in route.ts
   - Found same typo in 2 other files, fixed
   - Updated test assertions

4. TESTING:
   testing: All tests pass ✓

5. REVIEW:
   critical-reviewer: APPROVED ✓

6. COMPLETE
```

### Example 3: Null Pointer Bug

**Request**: "Fix crash when user.name is null"

**Execution**:
```
1. VERIFICATION:
   - Location: src/components/UserProfile.tsx:23
   - Root cause: No null check before accessing .name
   - Scope: Add optional chaining
   - Complexity: Simple ✓

2. PLANNING:
   plan-maker:
   - Add optional chaining: user?.name
   - Add fallback: user?.name || 'Unknown'
   - Add test for null user case

3. IMPLEMENTATION:
   - Add null check with fallback
   - Add test case

4. TESTING:
   testing: All tests pass ✓

5. REVIEW:
   critical-reviewer:
   - FEEDBACK: Should also handle undefined
   - Should check other user properties too

6. FIX & RE-REVIEW:
   - Update to handle undefined
   - Check user.email, user.avatar too
   - Add tests for undefined cases

7. REVIEW (Iteration 2):
   critical-reviewer: APPROVED ✓

8. COMPLETE
```

## Workflow State Example

```
WORKFLOW STATE:
  Pattern: Simple Bug Fix
  Stage: 4/5 (Review Phase)
  Current: critical-reviewer
  Completed: [plan-maker, implement, testing]
  Review Iterations: 0/2
  Status: in-progress
  Bug: "Pagination off-by-one error"
```

## Success Criteria

Bug fix is complete when:
- [ ] Root cause identified and fixed
- [ ] Tests added for the bug scenario
- [ ] All tests passing (including new ones)
- [ ] critical-reviewer approved
- [ ] No regressions introduced
- [ ] Similar issues checked and fixed if found

## Time Expectations

Simple bug fixes should complete quickly:
- Planning: 1-2 minutes
- Implementation: 2-5 minutes
- Testing: 1-2 minutes
- Review: 1-2 minutes

**Total: 5-11 minutes**

If taking longer, consider switching to complex-bug workflow.

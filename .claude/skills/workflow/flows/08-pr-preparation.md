# Skill Workflow: PR Preparation

## Scenario
User requests: "Get this ready for PR" or "Prepare for code review" or work is complete and ready for review

## Available Skills
- `reflect-on-work` - Reviews recent changes and work quality
- `critical-reviewer` - Expert code review and quality check
- `clean` - Code cleanup and formatting
- `cleanup` - Final polishing before PR
- `pr-idea` - Generates PR title and description

## Decision Tree

```
START: Code is ready for PR
│
├─→ REFLECTION PHASE:
│   └─→ reflect-on-work: Review recent work
│       └─→ Analyzes:
│           - What was changed and why
│           - Quality of implementation
│           - Completeness of solution
│           - Areas needing attention
│           - Consistency with codebase
│
├─→ REVIEW PHASE:
│   └─→ critical-reviewer: Comprehensive quality check
│       └─→ Checks:
│           - Code quality and style
│           - Security vulnerabilities
│           - Performance issues
│           - Test coverage
│           - Documentation completeness
│           - Breaking changes
│           - Error handling
│           - Best practices
│       │
│       ├─→ IF MAJOR ISSUES: Report and stop (needs more work)
│       ├─→ IF MINOR ISSUES: Continue to cleanup (fix during polish)
│       └─→ IF APPROVED: Continue to cleanup
│
├─→ CLEANUP PHASE (Sequential):
│   ├─→ clean: Code cleanup and formatting
│   │   └─→ Performs:
│   │       - Remove dead code
│   │       - Fix formatting
│   │       - Organize imports
│   │       - Remove console.logs
│   │       - Update comments
│   │
│   └─→ cleanup: Final polishing
│       └─→ Performs:
│           - Final consistency check
│           - Documentation review
│           - Commit message review
│           - File organization
│
├─→ PR DESCRIPTION PHASE:
│   └─→ pr-idea: Generate PR content
│       └─→ Generates:
│           - PR title (conventional commit format)
│           - Summary of changes
│           - Testing performed
│           - Screenshots/demos if applicable
│           - Breaking changes note
│           - Checklist for reviewers
│
└─→ FINAL VERIFICATION:
    └─→ One last check:
        - All tests pass
        - No linting errors
        - No unintended changes
        - Commits are clean
    └─→ READY FOR PR
```

## Skill Sequence

```
1. reflect-on-work: Review recent work
2. critical-reviewer: Comprehensive review
   ├─→ IF MAJOR ISSUES: STOP - More work needed
   │   └─→ Report issues to user
   └─→ IF MINOR/APPROVED: Continue
3. clean: Code cleanup and formatting
4. cleanup: Final polishing
5. pr-idea: Generate PR description
6. READY FOR PR
```

## Critical Rules

1. **Never skip critical-reviewer** - This is the quality gate
2. **Stop if major issues** - Don't create PR with known problems
3. **Run clean before cleanup** - Order matters
4. **Fix minor issues during cleanup** - Don't create separate fix commits
5. **Generate meaningful PR description** - Help reviewers understand changes
6. **Verify tests pass** - No broken PRs
7. **Check for breaking changes** - Document them clearly
8. **Review commits** - Clean history helps reviewers

## Issue Severity Assessment

### Major Issues (STOP - More work needed)
- Security vulnerabilities
- Failing tests
- Breaking changes without migration path
- Missing critical functionality
- Performance regressions
- Logic errors or bugs

**Action**: Report to user, do NOT proceed to cleanup

### Minor Issues (Fix during cleanup)
- Formatting inconsistencies
- Missing comments
- console.log statements
- Unused imports
- Minor code style issues
- TODOs that can be addressed quickly

**Action**: Fix during clean/cleanup phase

### Approved (No issues)
- Code quality excellent
- All checks passing
- Well-tested
- Well-documented

**Action**: Proceed to cleanup and PR creation

## Parallel Execution

PR preparation is mostly sequential, but:

**During Reflection:**
```
reflect-on-work (analyzes changes)
```

**NOT parallel:**
```
clean must run before cleanup (sequential)
pr-idea needs clean code to analyze
```

## Common Mistakes

❌ Skipping critical-reviewer to "save time"
❌ Creating PR with known issues
❌ Not running tests before declaring ready
❌ Leaving debug code (console.logs, debuggers)
❌ Not updating documentation
❌ Vague PR descriptions
❌ Not checking for breaking changes
❌ Messy commit history
❌ Not removing dead code
❌ Forgetting to update tests

## Examples

### Example 1: New Feature PR

**Request**: "This new auth feature is done, prepare PR"

**Execution**:
```
WORKFLOW: PR Preparation
Stage: 1/6

1. REFLECTION:
   reflect-on-work:
   Recent changes:
   - Added JWT authentication
   - Created auth middleware
   - Protected API routes
   - Added login/logout endpoints
   - 15 new tests added

   Quality assessment:
   - Implementation looks solid
   - Test coverage good
   - Some formatting inconsistencies noted
   - One console.log found

2. REVIEW:
   critical-reviewer:
   Findings:
   - Overall quality: GOOD
   - Security: httpOnly cookies ✓
   - Tests: Comprehensive ✓
   - Minor issues:
     • console.log in auth.ts:45
     • Missing JSDoc on middleware function
     • One unused import in session.ts

   Verdict: MINOR ISSUES - Continue to cleanup

3. CLEANUP:
   clean:
   - Removed console.log from auth.ts
   - Fixed import organization in 3 files
   - Formatted all changed files
   - Updated comments for clarity
   - Removed unused imports

4. FINAL POLISH:
   cleanup:
   - Added JSDoc to middleware function
   - Verified all files follow style guide
   - Checked commit messages
   - Organized test files

5. PR DESCRIPTION:
   pr-idea:

   Title: feat(auth): Add JWT authentication system

   ## Summary
   Implements JWT-based authentication for the API with secure
   httpOnly cookies and comprehensive middleware protection.

   ## Changes
   - Added auth middleware for route protection
   - Implemented JWT token generation and validation
   - Created login/logout endpoints
   - Added session management with Redis
   - Protected all sensitive API routes

   ## Testing
   - 15 new test cases added
   - All tests passing (147/147)
   - Tested token expiry, refresh, and invalidation
   - Tested concurrent requests
   - Manual testing completed

   ## Security Considerations
   - Tokens stored in httpOnly cookies
   - Rate limiting enabled (100 req/15min)
   - CSRF protection implemented
   - Token expiry: 1 hour (configurable)

   ## Breaking Changes
   None - new feature, no existing functionality changed

   ## Reviewer Checklist
   - [ ] Review middleware security
   - [ ] Verify token handling
   - [ ] Check error handling
   - [ ] Review test coverage

6. FINAL VERIFICATION:
   ✓ Tests: 147/147 passing
   ✓ Linting: No errors
   ✓ Build: Success
   ✓ No debug code
   ✓ Documentation updated

✓ READY FOR PR
```

### Example 2: Bug Fix PR (With Major Issues)

**Request**: "Fix is done, make a PR"

**Execution**:
```
WORKFLOW: PR Preparation
Stage: 1/6

1. REFLECTION:
   reflect-on-work:
   Recent changes:
   - Fixed race condition in token refresh
   - Updated error handling

   Concerns:
   - Only 2 tests added
   - No documentation updates

2. REVIEW:
   critical-reviewer:
   MAJOR ISSUES FOUND:
   ❌ Insufficient test coverage
   ❌ Race condition fix not comprehensive
   ❌ Error handling still missing in edge cases
   ❌ No migration path for existing sessions

   Verdict: NOT READY FOR PR

🛑 WORKFLOW STOPPED

Report to user:
"Code review found major issues that need addressing before PR:
1. Test coverage insufficient - need tests for:
   - Concurrent token refreshes
   - Network failures during refresh
   - Expired tokens edge cases

2. Race condition fix incomplete:
   - Still possible for deadlock in error path
   - No abort handling for cancelled requests

3. Missing error handling in:
   - middleware/auth.ts:78 (token decode failure)
   - lib/session.ts:156 (Redis connection loss)

4. Existing user sessions will break - need migration

Recommendation: Address these issues before creating PR.
Would you like help fixing these?"
```

### Example 3: Refactoring PR

**Request**: "Refactoring is complete, create PR"

**Execution**:
```
WORKFLOW: PR Preparation
Stage: 1/6

1. REFLECTION:
   reflect-on-work:
   Recent changes:
   - Extracted 3 large components into smaller ones
   - Created custom hooks for shared logic
   - Reduced duplication by 40%
   - Improved file organization

2. REVIEW:
   critical-reviewer:
   Findings:
   - Code quality: EXCELLENT
   - No functionality changes ✓
   - All tests passing ✓
   - Some old comments reference old structure

   Verdict: MINOR ISSUES - Continue

3. CLEANUP:
   clean:
   - Updated comments to reference new structure
   - Removed old commented-out code
   - Fixed import paths
   - Organized new files logically

4. FINAL POLISH:
   cleanup:
   - Added file header comments
   - Updated component documentation
   - Verified no functionality changes
   - Cleaned up test descriptions

5. PR DESCRIPTION:
   pr-idea:

   Title: refactor(components): Extract Profile components

   ## Summary
   Refactors the monolithic Profile component (800 lines) into
   smaller, focused components with shared custom hooks.

   ## Changes
   - Extracted ProfileHeader component (150 lines)
   - Extracted ProfileForm component (200 lines)
   - Extracted ProfileAvatar component (80 lines)
   - Created useProfile hook (120 lines)
   - Created useProfileValidation hook (90 lines)
   - Profile.tsx now 180 lines (was 800)

   ## Impact
   - ✅ No functionality changes
   - ✅ All tests passing (same tests, refactored structure)
   - ✅ Reduced code duplication by 40%
   - ✅ Improved maintainability
   - ✅ Better test isolation

   ## Testing
   - All existing tests passing (67/67)
   - Manual testing: Profile page works identically
   - No visual changes

   ## Breaking Changes
   None - internal refactoring only

   ## Reviewer Notes
   - Focus on: component extraction logic
   - No new features or bug fixes in this PR
   - Before/after comparison screenshots in comments

6. FINAL VERIFICATION:
   ✓ Tests: 67/67 passing
   ✓ No functionality changes
   ✓ Build successful
   ✓ Clean code

✓ READY FOR PR
```

## Success Criteria

PR is ready when:
- [ ] reflect-on-work completed
- [ ] critical-reviewer approved or minor issues only
- [ ] All major issues addressed
- [ ] Code cleaned and formatted
- [ ] Final polish complete
- [ ] PR description generated
- [ ] All tests passing
- [ ] No linting errors
- [ ] No debug code remaining
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Clean commit history

## Workflow State Example

```
WORKFLOW STATE:
  Pattern: PR Preparation
  Stage: 3/6 (Cleanup)
  Current: clean
  Completed: [reflect-on-work, critical-reviewer]
  Issues Found: Minor (3 formatting, 1 console.log)
  Status: in-progress
```

## After Workflow Completion

When ready for PR, inform user:
```
✅ Code is ready for PR!

Quality checks:
✓ Code review passed
✓ All tests passing (147/147)
✓ Code cleaned and formatted
✓ Documentation updated
✓ No security issues
✓ No performance regressions

PR Description:
[Generated description shown]

Next steps:
1. Review the PR description above
2. Create the PR (or I can help with that)
3. Assign reviewers
4. Address review feedback when received
```

## Integration with Git Workflow

PR preparation assumes:
- Changes are committed locally
- Working on a feature branch
- No uncommitted changes
- Clean commit history

If git state is messy:
```
Suggest to user:
"Before creating PR, consider:
1. Squashing fixup commits
2. Writing clear commit messages
3. Rebasing on latest main
4. Resolving any conflicts

Would you like help with git cleanup?"
```

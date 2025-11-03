# Skill Workflow: Code Refactoring

## Scenario
User requests: "Refactor [code/feature]" or "Clean up [component/module]" or "Reduce technical debt"
- No new features added
- Focus on code quality improvements
- May involve restructuring, extracting, or consolidating code

## Available Skills
- `scout` - Maps refactoring scope and dependencies
- `duplication` - Finds and consolidates duplicate code
- `plan-maker` - Creates refactoring strategy
- `testing` - Ensures no regressions
- `critical-reviewer` - Reviews refactoring quality
- `clean` - Final cleanup

## Decision Tree

```
START: User requests refactoring
│
├─→ SCOPE ANALYSIS PHASE:
│   ├─→ scout: Map refactoring scope
│   │   └─→ Identifies:
│   │       - Files in scope
│   │       - Dependencies affected
│   │       - Test files to update
│   │       - Potential breaking changes
│   │       - Related code that should also be refactored
│   │
│   ├─→ duplication: Find duplicate code
│   │   └─→ Finds:
│   │       - Copy-pasted code
│   │       - Similar patterns
│   │       - Opportunities for extraction
│   │       - Common utility candidates
│   │
│   └─→ Assess refactoring size:
│       ├─→ SMALL: Single file, < 200 lines moved
│       ├─→ MEDIUM: 2-4 files, 200-500 lines
│       └─→ LARGE: 5+ files, 500+ lines, use phased approach
│
├─→ PLANNING PHASE:
│   └─→ plan-maker: Create refactoring strategy
│       └─→ Plan includes:
│           - What to refactor and why
│           - New structure/organization
│           - Step-by-step approach
│           - Risk mitigation
│           - Test strategy
│           - Rollback plan
│           - Breaking changes (if any)
│
├─→ IMPLEMENTATION PHASE:
│   ├─→ IF SMALL/MEDIUM: Single phase implementation
│   │   └─→ [Claude refactors code]
│   │
│   └─→ IF LARGE: Multi-phase implementation
│       ├─→ Phase 1: Extract/create new structure
│       ├─→ Phase 2: Migrate to new structure
│       └─→ Phase 3: Remove old code
│
├─→ TESTING PHASE (After each phase):
│   └─→ testing: Run full test suite
│       ├─→ IF FAIL: Fix immediately and re-test
│       └─→ IF PASS: Continue
│       │
│       └─→ CRITICAL: No functionality changes!
│           All tests should pass without modification
│           (unless test implementation details changed)
│
├─→ REVIEW PHASE:
│   └─→ critical-reviewer: Review refactoring
│       └─→ Checks:
│           - Code quality improved ✓
│           - No functionality changes ✓
│           - Tests passing ✓
│           - Duplication reduced ✓
│           - Maintainability improved ✓
│           - Performance not degraded ✓
│       │
│       ├─→ IF ISSUES: Fix → Re-review
│       └─→ IF APPROVED: Continue
│
└─→ CLEANUP PHASE:
    └─→ clean: Final polish
        - Remove dead code
        - Update comments
        - Format consistently
    └─→ COMPLETE
```

## Skill Sequence Paths

### Small Refactoring (Single file, < 200 lines)
```
1. scout: Map scope
2. duplication: Check for duplicates
3. plan-maker: Create strategy
4. [Implement]: Refactor
5. testing: Verify no regressions
6. critical-reviewer: Review quality
7. clean: Polish
8. COMPLETE
```

### Medium Refactoring (2-4 files, 200-500 lines)
```
1. scout: Comprehensive scope mapping
2. duplication: Find all duplicates
3. plan-maker: Detailed strategy
4. [Implement]: Refactor all files
5. testing: Full test suite
6. critical-reviewer: Thorough review
   ├─→ IF ISSUES: Fix → Re-review
   └─→ IF APPROVED: Continue
7. clean: Final polish
8. COMPLETE
```

### Large Refactoring (5+ files, 500+ lines, phased)
```
1. scout: Deep dependency analysis
2. duplication: Comprehensive duplicate detection
3. plan-maker: Multi-phase strategy

Phase 1: Extract
4. [Implement Phase 1]: Create new structure
5. testing: Verify Phase 1
6. Commit Phase 1

Phase 2: Migrate
7. [Implement Phase 2]: Move to new structure
8. testing: Verify Phase 2
9. Commit Phase 2

Phase 3: Cleanup
10. [Implement Phase 3]: Remove old code
11. testing: Final verification

12. critical-reviewer: Review entire refactoring
    ├─→ IF ISSUES: Address → Re-review
    └─→ IF APPROVED: Continue
13. clean: Final polish
14. COMPLETE
```

## Refactoring Patterns

### Extract Component
```
Before: Monolithic component (500+ lines)
Action:
1. scout identifies logical boundaries
2. duplication finds repeated JSX
3. Extract sub-components
4. Update imports and props

Tests: Should pass unchanged (or updated for new structure)
```

### Extract Hook
```
Before: Component logic mixed with rendering
Action:
1. scout identifies stateful logic
2. Extract to custom hook
3. Replace inline logic with hook call

Tests: Should pass unchanged
```

### Consolidate Duplicates
```
Before: Same code in 5 places
Action:
1. duplication finds all occurrences
2. Create shared utility/component
3. Replace all occurrences with shared version

Tests: Should pass unchanged (functionality identical)
```

### Rename for Clarity
```
Before: Confusing names (getData, processStuff)
Action:
1. scout finds all usages
2. Rename systematically
3. Update all references

Tests: Should pass unchanged (names only)
```

### Reorganize File Structure
```
Before: Flat structure with 50 files
Action:
1. scout maps relationships
2. Create logical folder structure
3. Move files to new locations
4. Update imports

Tests: Should pass unchanged (paths updated)
```

## Critical Rules

1. **No functionality changes** - Refactoring must preserve behavior exactly
2. **Tests must pass unchanged** - Proves behavior preserved (except test refactoring)
3. **Scout first** - Map dependencies before touching code
4. **Check duplication** - Don't miss consolidation opportunities
5. **Commit often** - Small, logical commits make review easier
6. **Test after each phase** - Catch regressions immediately
7. **Large refactorings need phases** - Don't try to do everything at once
8. **Document the why** - Explain refactoring motivation in commits
9. **No "while I'm here" features** - Stay focused on refactoring only
10. **Performance should not degrade** - Measure if complex changes

## Common Refactoring Anti-Patterns

❌ **Refactoring + New Features** - Keep them separate
❌ **Breaking tests to fit new structure** - Tests verify behavior
❌ **Renaming without plan** - Easy to miss references
❌ **Over-abstracting** - Don't create complexity to reduce duplication
❌ **Under-testing** - Run full suite, not just related tests
❌ **Skipping scout** - Missing dependencies causes bugs
❌ **All-at-once large refactoring** - Use phases instead
❌ **Not checking duplication** - Miss consolidation opportunities
❌ **Ignoring performance** - Some refactorings can slow code

## Common Mistakes

❌ Changing functionality during refactoring
❌ Not running tests frequently enough
❌ Trying to refactor too much at once
❌ Not mapping dependencies first
❌ Breaking API contracts
❌ Not updating documentation
❌ Forgetting to update tests (when structure changes)
❌ Creating more complexity while "simplifying"

## Examples

### Example 1: Extract Large Component

**Request**: "Refactor UserProfile.tsx - it's 800 lines long"

**Execution**:
```
WORKFLOW: Refactoring
Pattern: Medium Refactoring
Stage: 1/8

1. SCOPE MAPPING:
   scout:
   Scope: UserProfile.tsx (800 lines)
   Dependencies:
   - Used by Dashboard.tsx, Settings.tsx
   - Uses ProfileService, AuthContext
   - Tests: UserProfile.test.tsx (300 lines)

   Logical sections identified:
   - ProfileHeader (150 lines)
   - ProfileForm (250 lines)
   - ProfileAvatar (100 lines)
   - Profile hooks (200 lines)
   - Profile page (100 lines remaining)

2. DUPLICATION CHECK:
   duplication:
   Found:
   - Form validation logic duplicated in 3 places
   - Avatar handling logic similar to AccountSettings.tsx
   - Can extract: useProfileValidation hook

3. PLANNING:
   plan-maker:
   Strategy:

   Phase 1: Extract components
   - Create ProfileHeader.tsx
   - Create ProfileForm.tsx
   - Create ProfileAvatar.tsx
   - Keep all functionality identical

   Phase 2: Extract hooks
   - Create useProfile.ts
   - Create useProfileValidation.ts
   - Consolidate duplicate validation logic

   Phase 3: Update main component
   - UserProfile.tsx imports and composes
   - Update tests for new structure

   Risk: Low (no functionality changes)
   Tests: Should pass with minor test updates

4. IMPLEMENTATION PHASE 1:
   Files created:
   - components/ProfileHeader.tsx (150 lines)
   - components/ProfileForm.tsx (250 lines)
   - components/ProfileAvatar.tsx (100 lines)

5. TESTING PHASE 1:
   testing:
   Result: 67/67 tests passing ✓

6. IMPLEMENTATION PHASE 2:
   Files created:
   - hooks/useProfile.ts (120 lines)
   - hooks/useProfileValidation.ts (90 lines)

7. TESTING PHASE 2:
   testing:
   Result: 67/67 tests passing ✓

8. IMPLEMENTATION PHASE 3:
   Files updated:
   - UserProfile.tsx (now 180 lines, was 800)
   - UserProfile.test.tsx (updated imports)

9. TESTING FINAL:
   testing:
   Result: 67/67 tests passing ✓

Stage: 7/8 (Review)

10. REVIEW:
    critical-reviewer:
    Findings:
    - Code quality: Significantly improved ✓
    - Duplication reduced: 40% ✓
    - No functionality changes: Verified ✓
    - Tests passing: 67/67 ✓
    - File sizes: Appropriate ✓
    - Maintainability: Much improved ✓

    APPROVED ✓

11. CLEANUP:
    clean:
    - Removed old commented code
    - Updated file headers
    - Organized imports
    - Added component documentation

✓ REFACTORING COMPLETE

Summary:
- UserProfile.tsx: 800 → 180 lines (77% reduction)
- Created 5 new files (well-organized)
- Reduced duplication by 40%
- All tests passing (no functionality changes)
- Maintainability significantly improved

Files created: 5
Files modified: 2
Lines of code: Net -200 (duplication removed)
Tests: 67/67 passing
```

### Example 2: Consolidate Duplicate Code

**Request**: "There's a lot of duplicate API calling code, consolidate it"

**Execution**:
```
WORKFLOW: Refactoring
Pattern: Medium Refactoring

1. SCOPE MAPPING:
   scout:
   Searching for API call patterns...
   Found in:
   - services/user.service.ts
   - services/auth.service.ts
   - services/data.service.ts
   - hooks/useApi.ts
   - 12 component files

2. DUPLICATION CHECK:
   duplication:
   Duplicate patterns found:
   - Error handling (duplicated 18 times)
   - Loading state management (15 times)
   - Token refresh logic (8 times)
   - Request retry logic (12 times)

   Total duplication: ~600 lines

3. PLANNING:
   plan-maker:
   Strategy:
   - Create lib/api-client.ts with:
     • Automatic error handling
     • Loading state management
     • Token refresh interceptor
     • Retry logic
     • Type-safe request builder

   - Update all services to use new client
   - Remove duplicate error handling
   - Tests should still pass

4. IMPLEMENTATION:
   Created: lib/api-client.ts (250 lines)

   Updated services (removed duplication):
   - user.service.ts: 180 → 95 lines
   - auth.service.ts: 150 → 70 lines
   - data.service.ts: 200 → 110 lines
   - hooks/useApi.ts: 100 → 40 lines
   - 12 component files simplified

5. TESTING:
   testing:
   Result: 143/143 tests passing ✓

6. REVIEW:
   critical-reviewer:
   - Duplication reduced: ~600 lines → 250 lines ✓
   - Functionality preserved ✓
   - Error handling improved ✓
   - Type safety improved ✓
   - APPROVED ✓

7. CLEANUP:
   clean:
   - Removed dead code
   - Added API client documentation
   - Updated usage examples

✓ REFACTORING COMPLETE

Summary:
- Consolidated 600 lines of duplicate code → 250 line utility
- Net reduction: 350 lines
- Improved error handling consistency
- Better type safety
- All tests passing
```

## Success Criteria

Refactoring is complete when:
- [ ] Scope fully mapped (scout completed)
- [ ] Duplication identified and addressed
- [ ] Plan created and followed
- [ ] All phases completed (if phased)
- [ ] Tests passing (functionality preserved)
- [ ] critical-reviewer approved
- [ ] Code quality improved
- [ ] No performance degradation
- [ ] Documentation updated
- [ ] Clean commit history

## Workflow State Example

```
WORKFLOW STATE:
  Pattern: Large Refactoring
  Phase: 2/3 (Migration)
  Stage: 8/14
  Current: testing
  Completed: [scout, duplication, plan, phase1, phase1-test]
  Status: in-progress
  Files refactored: 3/8
```

## Time Expectations

Refactoring time varies by size:

**Small**: 15-30 minutes
**Medium**: 30-60 minutes
**Large**: 1-3 hours (phased)

Note: Refactoring takes time. Don't rush it.

## When to Stop and Reconsider

Stop refactoring if:
- Tests start failing unexpectedly
- Performance degrades significantly
- Creating more complexity than removing
- Scope keeps growing ("scope creep")
- Running into breaking changes
- After 3 hours without completion

Reconsider approach or break into smaller refactorings.

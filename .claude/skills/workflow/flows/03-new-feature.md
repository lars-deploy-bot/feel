# Skill Workflow: New Feature Implementation

## Scenario
User requests: "Add [new feature] to the codebase"

## Available Skills
- `scout` - Maps code dependencies and impact
- `plan-maker` - Creates detailed technical plans
- `plan-checker` - Validates implementation plans (for complex features)
- `testing` - Runs test suite and validates
- `critical-reviewer` - Expert code review
- `clean` - Code cleanup and PR preparation
- `duplication` - Finds duplicate code (if refactoring needed)

## Decision Tree

```
START: User requests new feature
│
├─→ ANALYSIS PHASE:
│   ├─→ Check: Does similar feature already exist?
│   │   ├─→ scout: Search for related patterns
│   │   └─→ If EXISTS: Inform user, ask about modifications
│   │
│   ├─→ Check: Feature complexity level?
│   │   ├─→ SIMPLE (1-2 files, < 100 lines):
│   │   │   └─→ Use Simple Path
│   │   │
│   │   ├─→ STANDARD (2-5 files, 100-300 lines):
│   │   │   └─→ Use Standard Path
│   │   │
│   │   └─→ COMPLEX (5+ files, 300+ lines, architecture impact):
│       │   └─→ Use Complex Path
│       │
│       └─→ Check: Does feature require refactoring existing code?
│           ├─→ YES: Run duplication skill first
│           └─→ NO: Proceed
│
├─→ PLANNING PHASE:
│   ├─→ plan-maker: Create implementation plan
│   │   └─→ Consider:
│   │       - Files to create
│   │       - Files to modify
│   │       - Dependencies needed
│   │       - Test strategy
│   │       - Integration points
│   │
│   └─→ IF COMPLEX: plan-checker validates approach
│
├─→ DEPENDENCY MAPPING PHASE:
│   └─→ scout: Map all dependencies and integration points
│       └─→ Identifies:
│           - Related code that might be affected
│           - Existing patterns to follow
│           - Potential conflicts
│           - Test files that need updating
│
├─→ IMPLEMENTATION PHASE:
│   └─→ [Claude implements feature based on plan]
│       ├─→ Create new files
│       ├─→ Modify existing files
│       └─→ Update tests
│
├─→ TESTING PHASE:
│   └─→ testing: Run test suite
│       ├─→ IF FAIL: Fix issues and re-test
│       └─→ IF PASS: Continue
│
├─→ REVIEW PHASE:
│   └─→ critical-reviewer: Comprehensive code review
│       ├─→ Checks:
│       │   - Code quality
│       │   - Security issues
│       │   - Performance concerns
│       │   - Best practices
│       │   - Test coverage
│       │
│       ├─→ IF MAJOR ISSUES: Loop back to PLANNING
│       ├─→ IF MINOR ISSUES: Fix and re-review
│       └─→ IF APPROVED: Continue
│
└─→ CLEANUP PHASE:
    └─→ clean: Final polish and formatting
        └─→ COMPLETE
```

## Skill Sequence Paths

### Simple Path (1-2 files, < 100 lines)
```
1. plan-maker: Create implementation plan
2. [Implement]: Execute plan
3. testing: Run tests
4. critical-reviewer: Review quality
   ├─→ IF ISSUES: Fix → critical-reviewer (max 3 loops)
   └─→ IF APPROVED: Continue
5. COMPLETE
```

### Standard Path (2-5 files, 100-300 lines)
```
1. plan-maker: Create detailed plan
2. scout: Map dependencies and related code
3. [Implement]: Execute plan
4. testing: Run test suite
5. critical-reviewer: Comprehensive review
   ├─→ IF MAJOR ISSUES: → plan-maker (loop, iteration 2)
   ├─→ IF MINOR ISSUES: Fix → critical-reviewer
   └─→ IF APPROVED: Continue
6. clean: Final cleanup
7. COMPLETE
```

### Complex Path (5+ files, 300+ lines, architecture changes)
```
1. scout: Initial dependency mapping
2. plan-maker: Create comprehensive plan
3. plan-checker: Validate architectural approach
   ├─→ IF ISSUES: → plan-maker (revise)
   └─→ IF APPROVED: Continue
4. [Implement Phase 1]: Core functionality
5. testing: Test Phase 1
6. [Implement Phase 2]: Additional features
7. testing: Full test suite
8. critical-reviewer: Code quality review
   ├─→ IF MAJOR ISSUES: → plan-maker (loop, iteration 2)
   ├─→ IF MINOR ISSUES: Fix → critical-reviewer
   └─→ IF APPROVED: Continue
9. clean: Final polish
10. COMPLETE
```

## Parallel Execution Opportunities

**When multiple features are independent:**
```
If adding: auth + logging + monitoring
1. plan-maker (creates plan for all three)
2. scout (maps dependencies for all)
3. [Implement all three in separate commits]
4. testing (tests all features)
5. critical-reviewer (reviews all code)
```

**NOT parallel (sequential dependencies):**
```
If: auth → protected routes → user dashboard
Must be sequential because each depends on previous
```

## Critical Rules

1. **Always check for existing implementations** - Use scout to search first
2. **Plan before coding** - Never skip plan-maker for features > 50 lines
3. **Map dependencies** - scout reveals hidden impacts
4. **Test continuously** - Run tests after each major change
5. **Review rigorously** - critical-reviewer is mandatory
6. **Loop on major issues** - Don't ignore review feedback
7. **Max 3 iterations** - Escalate to user if stuck
8. **Refactor first if needed** - Don't add features to messy code
9. **Break down complex features** - Use phases for 300+ lines
10. **Document decisions** - Update relevant docs/comments

## Review Loop Strategy

### Minor Issues (Fix and re-review)
- Typos, formatting
- Missing comments
- Simple error handling
- Minor optimization suggestions

**Action**: Fix directly → Run critical-reviewer again (same iteration)

### Major Issues (Loop to planning)
- Wrong approach or architecture
- Security vulnerabilities
- Performance problems
- Missing critical functionality
- Inadequate test coverage

**Action**: Increment iteration → Run plan-maker → Execute revised plan

### Blocker Issues (Escalate)
- Fundamental misunderstanding of requirements
- Technical limitations discovered
- Breaking changes to public APIs
- After 3 iterations without resolution

**Action**: Present options to user with recommendations

## Complexity Assessment Checklist

**Simple Feature:**
- [ ] Single file or two closely related files
- [ ] < 100 lines of new/changed code
- [ ] No database changes
- [ ] No new dependencies
- [ ] Clear implementation path
- [ ] Low risk of breaking changes

**Standard Feature:**
- [ ] 2-5 files affected
- [ ] 100-300 lines of code
- [ ] May require new dependencies
- [ ] Some integration complexity
- [ ] Moderate risk level
- [ ] Existing patterns can be followed

**Complex Feature:**
- [ ] 5+ files affected
- [ ] 300+ lines of code
- [ ] Database/API changes
- [ ] New architectural patterns
- [ ] High risk or critical path
- [ ] Multi-package coordination
- [ ] Significant refactoring needed

## Common Mistakes

❌ Starting implementation without running plan-maker
❌ Not checking for existing similar features
❌ Skipping scout for multi-file features
❌ Ignoring test failures
❌ Dismissing critical-reviewer feedback
❌ Making complex features without phases
❌ Not updating tests when adding features
❌ Adding features to already messy code (refactor first)
❌ Implementing without understanding dependencies
❌ Rushing through review to "get it done"

## Example: Adding Authentication

**Request**: "Add user authentication with JWT to the API"

**Classification**: Standard Feature (3-4 files, moderate complexity)

**Execution**:
```
1. ANALYSIS:
   - scout: Search for existing auth patterns
   - Result: No existing auth found
   - Complexity: Standard (auth middleware, session store, protected routes)

2. PLANNING:
   - plan-maker: Creates plan
     • Create auth middleware
     • Add session management
     • Protect API routes
     • Add login/logout endpoints
     • Update tests

3. DEPENDENCY MAPPING:
   - scout: Maps impact
     • Identifies all route files
     • Finds existing middleware
     • Locates test files

4. IMPLEMENTATION:
   • Create apps/web/middleware/auth.ts
   • Update apps/web/app/api/*/route.ts
   • Add session management
   • Update test suite

5. TESTING:
   - testing: Runs tests
   - Result: All pass

6. REVIEW (Iteration 1):
   - critical-reviewer: Reviews code
   - Feedback: Missing rate limiting, should use httpOnly cookies

7. LOOP TO PLANNING (Iteration 2):
   - plan-maker: Revised plan with security enhancements
   - Implement: Add rate limiting + secure cookies
   - testing: All tests pass

8. REVIEW (Iteration 2):
   - critical-reviewer: Reviews again
   - Result: APPROVED

9. CLEANUP:
   - clean: Final polish

10. COMPLETE
```

## Success Criteria

Feature is complete when:
- [ ] All planned functionality implemented
- [ ] Tests written and passing
- [ ] critical-reviewer approved the code
- [ ] No security vulnerabilities
- [ ] Documentation updated (if needed)
- [ ] Code formatted and cleaned
- [ ] Integration points verified
- [ ] No regressions introduced

## Workflow State Example

Throughout execution, maintain and report state:

```
WORKFLOW STATE:
  Pattern: Standard Feature
  Stage: 5/7 (Review Phase)
  Current: critical-reviewer
  Completed: [plan-maker, scout, implement, testing]
  Review Iterations: 1/3
  Status: in-progress
  Last Feedback: "Missing rate limiting"
```

## Next Steps After Completion

After workflow completes successfully:
1. Summarize what was implemented
2. List files changed/created
3. Report test results
4. Note any follow-up items
5. Suggest PR creation if appropriate

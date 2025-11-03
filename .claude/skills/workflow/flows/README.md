# Workflow Decision Trees

This directory contains **executable decision trees** for the workflow orchestrator. Each file defines a specific workflow pattern for common software engineering scenarios.

## Quick Reference

| File | When to Use | Avg Time | Complexity |
|------|-------------|----------|------------|
| `01-simple-bug-fix.md` | Known bug, clear fix, 1-2 files | 5-15 min | Low |
| `02-complex-bug.md` | Unknown cause, investigation needed | 30-90 min | High |
| `03-new-feature.md` | Adding new functionality | 20-60 min | Medium-High |
| `04-refactoring.md` | Code cleanup, no features | 15-90 min | Medium |
| `05-architecture-change.md` | Major structural changes | 1-3 hours | Very High |
| `06-security-fix.md` | Vulnerability remediation | 30-90 min | High |
| `07-performance-optimization.md` | Speed/memory improvements | 30-120 min | High |
| `08-pr-preparation.md` | Final review before merge | 10-20 min | Low |

## How Workflows Work

### 1. Classification
When you make a request, the workflow orchestrator classifies it:
```
"Fix the typo in error message" → 01-simple-bug-fix.md
"Add JWT authentication" → 03-new-feature.md
"This component is 800 lines, refactor it" → 04-refactoring.md
"Users are randomly getting logged out" → 02-complex-bug.md
"Ready for PR" → 08-pr-preparation.md
```

### 2. Loading
The orchestrator loads the workflow file and parses:
- Decision tree structure
- Skill invocation sequences
- Review criteria
- Loop strategies

### 3. Execution
Follows the decision tree step-by-step:
```
┌─ Check conditions
├─ Invoke skills (plan-maker, scout, etc.)
├─ Implement solution
├─ Test thoroughly
├─ Review critically
│  ├─ Issues? → Loop back (max 3x)
│  └─ Approved? → Complete
└─ Done
```

### 4. State Tracking
You see progress throughout:
```
WORKFLOW STATE:
  Pattern: Standard Feature
  Stage: 5/7 (Review Phase)
  Completed: [plan-maker, scout, implement, testing]
  Status: in-progress
```

## Workflow Structure

Each workflow file follows this format:

```markdown
# Skill Workflow: [Name]

## Scenario
User requests that trigger this workflow

## Available Skills
Skills that can be invoked in this workflow

## Decision Tree
Visual tree showing all decision paths

## Skill Sequence Paths
Concrete sequences for different complexity levels

## Parallel Execution
When skills can run simultaneously (||)

## Critical Rules
Non-negotiable requirements

## Common Mistakes
Anti-patterns to avoid

## Examples
Full execution examples with state tracking
```

## Key Concepts

### Decision Trees
Explicit branching logic:
```
├─→ Condition A?
│   ├─→ YES: Do X
│   └─→ NO: Do Y
├─→ Implement
├─→ Test
├─→ Review
│   ├─→ FAIL: Loop back
│   └─→ PASS: Done
```

### Skill Invocation
Workflows orchestrate skills:
```
1. plan-maker: Creates implementation plan
2. scout: Maps dependencies
3. [You implement based on plan]
4. testing: Runs test suite
5. critical-reviewer: Reviews quality
```

### Parallel Execution
Some skills can run simultaneously:
```
plan-maker || scout
(Both can run in parallel, then implementation waits for both)
```

### Review Loops
Every workflow includes quality gates:
```
critical-reviewer checks code
├─ Minor issues? → Fix and re-review (same iteration)
├─ Major issues? → Loop to planning (iteration++)
└─ Approved? → Complete
```

Max 3 iterations before escalating to user.

### State Tracking
Progress is visible throughout:
```typescript
{
  workflow: "03-new-feature",
  stage: "5/7",
  currentSkill: "testing",
  completedSkills: ["plan-maker", "scout", "implement"],
  reviewIterations: 1,
  status: "in-progress"
}
```

## Workflow Selection Guide

### Simple Bug Fix (01)
**Use when:**
- ✓ Bug location known
- ✓ Root cause clear
- ✓ Single file, < 50 lines
- ✓ Low risk

**Don't use when:**
- ✗ Root cause unclear
- ✗ Multiple potential causes
- ✗ Affects 3+ files
- ✗ Intermittent/hard to reproduce

→ Use 02-complex-bug.md instead

### Complex Bug (02)
**Use when:**
- ✓ Unknown root cause
- ✓ Needs investigation
- ✓ Intermittent or hard to reproduce
- ✓ Multiple files involved
- ✓ Requires debugging

**Includes:**
- root-cause-analysis
- fix-bug-when-stuck (if needed)
- Comprehensive testing
- Defensive coding

### New Feature (03)
**Use when:**
- ✓ Adding new functionality
- ✓ May require multiple files
- ✓ Needs planning and architecture
- ✓ Integration points

**Has 3 paths:**
- Simple: 1-2 files, < 100 lines
- Standard: 2-5 files, 100-300 lines
- Complex: 5+ files, 300+ lines, multi-phase

### Refactoring (04)
**Use when:**
- ✓ No feature changes
- ✓ Code quality improvements
- ✓ Reducing duplication
- ✓ Restructuring code

**Critical:**
- Tests must pass unchanged
- No functionality changes
- Phased approach for large refactorings

### Architecture Change (05)
**Use when:**
- ✓ Major structural changes
- ✓ Database schema changes
- ✓ Multi-package coordination
- ✓ Breaking changes possible

**Includes:**
- Multiple review checkpoints
- plan-checker validation
- Phased implementation
- Rollback planning

### Security Fix (06)
**Use when:**
- ✓ Security vulnerability found
- ✓ Needs hardening
- ✓ Attack prevention
- ✓ Audit findings

**Focus:**
- Security-first approach
- Defense in depth
- Comprehensive testing
- Documentation of fix

### Performance Optimization (07)
**Use when:**
- ✓ Speed improvements needed
- ✓ Memory optimization
- ✓ Bundle size reduction
- ✓ Render performance

**Includes:**
- Baseline measurements
- Profiling
- Optimization
- Before/after comparison

### PR Preparation (08)
**Use when:**
- ✓ Code ready for review
- ✓ Implementation complete
- ✓ Need final polish

**Fast path:**
- Review → Clean → Cleanup → PR Description
- 10-20 minutes
- Stops if major issues found

## Common Patterns

### Investigation Pattern
```
root-cause-analysis → scout → plan-maker
(Used in: 02-complex-bug, 06-security-fix)
```

### Planning Pattern
```
plan-maker → scout → [implement]
(Used in: 03-new-feature, 04-refactoring, 05-architecture-change)
```

### Quality Gate Pattern
```
[implement] → testing → critical-reviewer
├─ Issues? → Loop
└─ Approved? → Continue
(Used in: ALL workflows)
```

### Phased Implementation Pattern
```
Plan → Phase 1 → Test → Phase 2 → Test → Review
(Used in: 03-new-feature-complex, 04-refactoring-large, 05-architecture-change)
```

### Cleanup Pattern
```
critical-reviewer → clean → cleanup
(Used in: 03-new-feature, 04-refactoring, 08-pr-preparation)
```

## Skills Reference

Available skills that workflows can invoke:

**Planning & Analysis:**
- `plan-maker` - Creates detailed technical plans
- `plan-checker` - Validates architectural approaches
- `scout` - Maps code dependencies and impact

**Investigation:**
- `root-cause-analysis` - Deep problem investigation
- `fix-bug-when-stuck` - Debugging assistance

**Quality & Review:**
- `critical-reviewer` - Expert code review (mandatory)
- `testing` - Test execution and validation
- `ux-review` - User experience validation

**Cleanup & Finalization:**
- `clean` - Code cleanup and formatting
- `cleanup` - Final polishing
- `duplication` - Finds and merges duplicate code

**Documentation:**
- `pr-idea` - Generates PR descriptions
- `reflect-on-work` - Reviews recent changes

## Best Practices

### For Users:

1. **Let the workflow classify** - Don't force a specific workflow
2. **Trust the process** - Workflows include necessary steps
3. **Respond to escalations** - After 3 iterations, your input is needed
4. **Review final output** - Even with quality gates, human review helps

### For Workflow Authors:

1. **Be explicit** - No ambiguous conditions
2. **Include examples** - Show concrete execution
3. **Define parallel opportunities** - Speed up where possible
4. **Document anti-patterns** - Show what NOT to do
5. **Test thoroughly** - Verify decision tree logic

### For the Orchestrator:

1. **Always load the workflow file** - Don't improvise
2. **Check conditions before branching** - Evaluate explicitly
3. **Track state throughout** - Keep user informed
4. **Respect loop limits** - Max 3 iterations
5. **Escalate appropriately** - Know when to ask user

## Adding New Workflows

To add a new workflow:

1. **Create file**: `flows/XX-workflow-name.md`
2. **Follow structure**: Use existing workflows as templates
3. **Define decision tree**: Be explicit about all branches
4. **Add examples**: Show concrete execution with state
5. **Update orchestrator**: Add classification logic
6. **Update this README**: Add to quick reference table

## Examples

### Example 1: Simple Bug Fix

```
Request: "Fix typo: 'sucessful' → 'successful'"

Workflow: 01-simple-bug-fix.md
Time: 8 minutes

Execution:
1. plan-maker: Quick fix plan
2. [Implement]: Fix typo in 3 files
3. testing: All tests pass ✓
4. critical-reviewer: APPROVED ✓
5. Done

Result: Fixed in 3 locations, tests passing
```

### Example 2: Complex Bug Investigation

```
Request: "Users randomly getting logged out"

Workflow: 02-complex-bug.md
Time: 45 minutes

Execution:
1. root-cause-analysis: Identifies race condition
2. scout: Maps all auth-related files (8 files)
3. plan-maker: Fix plan with synchronization
4. [Implement]: Add mutex, improve error handling
5. testing: All tests pass ✓
6. critical-reviewer: Found issue (possible deadlock)
7. [Loop iteration 2]
8. plan-maker: Revised approach (simpler flag)
9. [Implement]: Updated synchronization
10. testing: All tests pass ✓
11. critical-reviewer: APPROVED ✓
12. Done

Result: Race condition fixed, comprehensive tests added
```

### Example 3: New Feature

```
Request: "Add JWT authentication to API"

Workflow: 03-new-feature.md (Standard path)
Time: 35 minutes

Execution:
1. plan-maker: Auth implementation plan
2. scout: Maps API routes, middleware patterns
3. [Implement]: Middleware, sessions, protected routes
4. testing: All tests pass ✓
5. critical-reviewer: Issues (missing rate limiting)
6. [Loop iteration 2]
7. plan-maker: Add rate limiting + security improvements
8. [Implement]: Enhanced security
9. testing: All tests pass ✓
10. critical-reviewer: APPROVED ✓
11. clean: Final polish
12. Done

Result: Secure JWT auth with rate limiting, 15 tests
```

### Example 4: PR Preparation (With Issues)

```
Request: "Ready for PR"

Workflow: 08-pr-preparation.md
Time: Would be 15 min, but STOPPED

Execution:
1. reflect-on-work: Reviews changes
2. critical-reviewer: MAJOR ISSUES FOUND
   - Insufficient test coverage
   - Missing error handling
   - Breaking changes undocumented
3. STOPPED - Not ready for PR

Report: Listed all issues, need to fix first

Result: Prevented premature PR, saved review time
```

## Troubleshooting

### "Wrong workflow was selected"
The orchestrator analyzes request and selects workflow. If wrong, it will often self-correct after scout/analysis phase. You can also explicitly request a workflow.

### "Stuck in review loop"
Max 3 iterations, then escalates to you. If hitting this:
- Review feedback carefully
- Fundamental issue may need different approach
- Consider switching workflows

### "Workflow taking too long"
Check the "Avg Time" column above. If significantly over:
- May need to switch to simpler workflow
- Task may be more complex than initially assessed
- Consider breaking into smaller tasks

### "Skipped a step I needed"
Workflows are designed for common cases. For project-specific needs, you can:
- Request specific additional steps
- Create custom workflow in `.claude/skills/workflow/custom/`

## Version History

**v1.0.0** (Current)
- Initial workflow system
- 8 core workflows
- Decision tree based execution
- Quality gates enforced
- State tracking throughout

## See Also

- `../SKILL.md` - Workflow orchestrator
- `../ARCHITECTURE.md` - System design documentation
- `../../*/SKILL.md` - Individual skill definitions

---

**Remember**: Workflows ensure consistent quality through structured execution. Trust the process, including the quality gates. They exist to catch issues before they become problems.

# Workflow System Architecture

## Overview

The workflow system is a **decision-tree-based orchestration framework** for Claude Code skills. It provides structured, repeatable patterns for complex software engineering tasks with built-in quality gates and feedback loops.

## Philosophy

### Why This Approach?

**Traditional AI problem**: AI agents often work ad-hoc, making decisions without structure, leading to:
- Inconsistent quality
- Forgotten steps
- No systematic review
- Difficulty debugging agent behavior

**Workflow solution**: Pre-defined decision trees that:
- Ensure consistent execution patterns
- Include mandatory quality gates
- Handle feedback loops systematically
- Make agent behavior transparent and debuggable
- Allow iterative improvement of workflows themselves

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   USER REQUEST                          │
│         "Add authentication to the API"                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│             LAYER 1: Orchestrator (SKILL.md)            │
│  • Analyzes request type and complexity                 │
│  • Selects appropriate workflow file                    │
│  • Loads decision tree from /flows/                     │
│  • Tracks workflow state and iterations                 │
│  • Handles errors and escalation                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│        LAYER 2: Workflow Files (/flows/*.md)            │
│  • Decision trees for specific scenarios                │
│  • Skill invocation sequences                           │
│  • Conditional branching logic                          │
│  • Parallel execution patterns                          │
│  • Review loop strategies                               │
│  • Critical rules and anti-patterns                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│          LAYER 3: Skills (../**/SKILL.md)               │
│  • Specialized agents with specific capabilities        │
│  • plan-maker, scout, critical-reviewer, etc.           │
│  • Autonomous execution of focused tasks               │
│  • Return results to orchestrator                       │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
.claude/skills/workflow/
├── SKILL.md                    # Layer 1: Orchestrator
├── ARCHITECTURE.md             # This file (documentation)
└── flows/                      # Layer 2: Workflow definitions
    ├── 01-simple-bug-fix.md
    ├── 02-complex-bug.md
    ├── 03-new-feature.md
    ├── 04-refactoring.md
    ├── 05-architecture-change.md
    ├── 06-security-fix.md
    ├── 07-performance-optimization.md
    └── 08-pr-preparation.md

.claude/skills/                 # Layer 3: Skills
├── plan-maker/SKILL.md
├── scout/SKILL.md
├── critical-reviewer/SKILL.md
├── testing/SKILL.md
├── clean/SKILL.md
├── cleanup/SKILL.md
├── fix-bug-when-stuck/SKILL.md
├── root-cause-analysis/SKILL.md
├── duplication/SKILL.md
├── ux-review/SKILL.md
├── pr-idea/SKILL.md
└── reflect-on-work/SKILL.md
```

## How It Works

### 1. Request Classification

When user makes a request, the orchestrator (SKILL.md) classifies it:

```typescript
interface RequestClassification {
  type: 'bug-fix' | 'feature' | 'refactor' | 'architecture' | 'security' | 'performance' | 'pr-prep'
  complexity: 'simple' | 'standard' | 'complex'
  scope: {
    files: number
    linesOfCode: number
    dependencies: string[]
    riskLevel: 'low' | 'medium' | 'high'
  }
}
```

**Examples:**
- "Fix typo in error message" → `01-simple-bug-fix.md`
- "Add JWT auth" → `03-new-feature.md`
- "Extract this 800-line component" → `04-refactoring.md`
- "Users getting logged out randomly" → `02-complex-bug.md`
- "Prepare for PR" → `08-pr-preparation.md`

### 2. Workflow Loading

Orchestrator loads the selected workflow file and parses:
- Decision tree structure
- Skill invocation sequences
- Conditional branching rules
- Parallel execution opportunities
- Review loop strategies
- Critical rules and anti-patterns

### 3. Decision Tree Execution

The orchestrator executes the decision tree step-by-step:

```
START
├─→ Check condition A?
│   ├─→ YES: Execute skill X
│   └─→ NO: Execute skill Y
├─→ Implement solution
├─→ Test
├─→ Review
│   ├─→ PASS: Complete
│   └─→ FAIL: Loop back (max 3 iterations)
└─→ COMPLETE
```

**Key features:**
- Conditions checked before branching
- Skills invoked via `Skill(command: "skill-name")`
- Parallel execution when independent: `skill-a || skill-b`
- State maintained throughout execution
- Iteration tracking (max 3 loops)

### 4. Quality Gates

Every workflow includes **mandatory quality gates**:

```
┌────────────────────────────────────────┐
│         QUALITY GATE PATTERN           │
│                                        │
│  1. Implement solution                 │
│  2. testing: Run tests                 │
│     ├─ FAIL → Fix → Re-test           │
│     └─ PASS → Continue                 │
│  3. critical-reviewer: Review          │
│     ├─ MAJOR ISSUES → Loop to planning │
│     ├─ MINOR ISSUES → Fix → Re-review  │
│     └─ APPROVED → Complete             │
└────────────────────────────────────────┘
```

**No workflow completes without passing review.**

### 5. Feedback Loops

Workflows handle review feedback systematically:

```typescript
interface ReviewFeedback {
  severity: 'minor' | 'major' | 'blocker'
  issues: string[]
  recommendations: string[]
}

// Decision logic
if (severity === 'minor') {
  // Fix directly and re-review (same iteration)
  fix_issues()
  invoke('critical-reviewer')
}
else if (severity === 'major') {
  // Loop back to planning (increment iteration)
  iteration++
  invoke('plan-maker')
}
else if (severity === 'blocker' || iteration >= 3) {
  // Escalate to user
  report_to_user()
}
```

### 6. State Tracking

Throughout execution, state is maintained and displayed:

```typescript
interface WorkflowState {
  workflow: string              // e.g., "03-new-feature"
  pattern: string               // e.g., "Standard Feature"
  stage: string                 // e.g., "5/7"
  currentSkill: string | null   // e.g., "testing"
  completedSkills: string[]     // e.g., ["plan-maker", "scout", ...]
  reviewIterations: number      // e.g., 1
  lastReviewFeedback: string | null
  status: 'in-progress' | 'passed-review' | 'failed-review' | 'completed'
}
```

User sees progress updates:
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

## Workflow Patterns

### Simple Path (Quick tasks)

```
Plan → Implement → Test → Review → Done
Time: 5-15 minutes
```

### Standard Path (Most common)

```
Plan → Scout → Implement → Test → Review → Clean → Done
Time: 20-45 minutes
```

### Complex Path (Major work)

```
Scout → Plan → Validate Plan →
Implement Phase 1 → Test →
Implement Phase 2 → Test →
Review → UX Review → Clean → Done
Time: 1-3 hours
```

### Bug Investigation Path

```
Root Cause Analysis → [Unstuck if needed] → Plan →
Implement → Test → Review → Done
Time: 30-90 minutes
```

### Refactoring Path

```
Scout → Duplication Detection → Plan →
Refactor → Test → Review → Clean → Done
Time: 30-90 minutes
```

### PR Preparation Path

```
Reflect → Review → Clean → Cleanup → PR Description → Done
Time: 10-20 minutes
```

## Parallel Execution

Workflows specify when skills can run in parallel:

```markdown
## In workflow file

### Path 1: Sequential (dependencies)
1. plan-maker: Create plan
2. scout: Map dependencies (needs plan)
3. [Implement]: Execute (needs scout results)

### Path 2: Parallel (independent)
1. plan-maker || scout (both can run simultaneously)
2. [Implement]: Execute (waits for both)
```

**Notation**: `skill-a || skill-b` means parallel execution

**Orchestrator logic**:
```python
if "||" in skill_sequence:
    skills = skill_sequence.split("||")
    invoke_parallel(skills)  # Single message, multiple tool calls
else:
    invoke_sequential(skill_sequence)
```

## Error Handling

### Skill Execution Failure

```
❌ SKILL FAILURE: testing
Error: Test suite failed with 3 errors

RECOVERY ACTION:
1. Analyze test failures
2. Fix issues directly
3. Re-run testing skill
```

### Infinite Loop Detection

```
🚨 LOOP LIMIT REACHED: 3 iterations

The workflow has looped 3 times without passing review.

Options:
1. Escalate to user for guidance
2. Switch to simpler approach
3. Use fix-bug-when-stuck skill

Recommended: Escalate (after 3 attempts, need user input)
```

### Workflow File Not Found

```
ERROR: Workflow file not found
Requested: flows/09-unknown.md

FALLBACK:
Using closest match: flows/03-new-feature.md
Rationale: Request involves adding functionality
```

## Critical Design Decisions

### 1. Why Decision Trees?

**Alternative**: Describe workflows in natural language
**Problem**: Ambiguous, inconsistent execution
**Solution**: Explicit decision trees with clear branches

### 2. Why Separate Workflow Files?

**Alternative**: All workflows in SKILL.md
**Problem**: Too complex, hard to maintain
**Solution**: One file per workflow type, orchestrator selects

### 3. Why Mandatory Reviews?

**Alternative**: Optional review step
**Problem**: Quality varies, bugs slip through
**Solution**: critical-reviewer is non-negotiable in every workflow

### 4. Why Loop Limits?

**Alternative**: Infinite loops until perfect
**Problem**: Can spin forever, waste time
**Solution**: Max 3 iterations, then escalate to user

### 5. Why State Tracking?

**Alternative**: Run workflows without state
**Problem**: User has no visibility, hard to debug
**Solution**: Explicit state updates displayed throughout

## Workflow File Format

Each workflow file follows this structure:

```markdown
# Skill Workflow: [Name]

## Scenario
User requests: [examples]

## Available Skills
- skill-name: What it does

## Decision Tree
```
START: Entry point
├─→ PHASE 1: Do something
│   ├─→ Condition? → Action
│   └─→ Else → Other action
└─→ COMPLETE
```

## Skill Sequence
Concrete execution paths

## Parallel Execution Opportunities
When to run skills simultaneously

## Critical Rules
Non-negotiable requirements

## Common Mistakes
Anti-patterns to avoid

## Examples
Concrete execution examples with state tracking
```

## Integration with Skills

Workflows orchestrate skills, skills don't know about workflows:

```
┌────────────────────────────────────────────┐
│          Workflow (Orchestrator)           │
│  • Knows about: All skills, sequences      │
│  • Invokes: Skills via Skill tool          │
│  • Tracks: State, iterations, feedback     │
└────────────┬───────────────────────────────┘
             │ Invokes
             ▼
┌────────────────────────────────────────────┐
│               Skill                        │
│  • Knows about: Its specific task only     │
│  • Executes: Autonomous task completion    │
│  • Returns: Results to orchestrator        │
└────────────────────────────────────────────┘
```

**Key principle**: Separation of concerns
- Workflows handle sequencing and coordination
- Skills handle specific technical tasks
- Neither needs to understand the other's internals

## Benefits of This Architecture

### For Users:
- ✅ Consistent quality across all tasks
- ✅ Transparent progress tracking
- ✅ Predictable time estimates
- ✅ Clear success criteria
- ✅ Systematic error handling

### For AI Agent:
- ✅ Clear decision-making framework
- ✅ No ambiguity about next steps
- ✅ Built-in quality gates
- ✅ Handles edge cases systematically
- ✅ Prevents common mistakes

### For Maintainers:
- ✅ Easy to add new workflows
- ✅ Easy to improve existing workflows
- ✅ Git-trackable workflow changes
- ✅ Debuggable agent behavior
- ✅ Scalable system design

## Comparison with Other Approaches

### vs. Ad-Hoc Execution

| Ad-Hoc | Workflow System |
|--------|----------------|
| "Figure it out" | Follow decision tree |
| Quality varies | Consistent quality gates |
| No feedback loops | Systematic review loops |
| Hard to debug | Transparent state tracking |
| No time estimates | Predictable patterns |

### vs. Hardcoded Automation

| Hardcoded | Workflow System |
|-----------|-----------------|
| Can't adapt | Flexible branching |
| Binary pass/fail | Feedback loops |
| No user visibility | State tracking |
| Breaks on edge cases | Handles exceptions |
| Hard to change | Git-tracked markdown |

### vs. Natural Language Workflows

| Natural Language | Structured Decision Trees |
|-----------------|---------------------------|
| Ambiguous | Explicit |
| Interpretation varies | Consistent execution |
| Hard to verify | Verifiable steps |
| No machine parsing | Parseable format |
| Drift over time | Version controlled |

## Extending the System

### Adding a New Workflow

1. **Identify the scenario**: What type of request triggers this?
2. **Create file**: `flows/XX-workflow-name.md`
3. **Define decision tree**: Map out all branches and conditions
4. **Specify skills**: List which skills are needed
5. **Add examples**: Show concrete execution with state tracking
6. **Update orchestrator**: Add classification logic in SKILL.md

### Improving an Existing Workflow

1. **Identify the issue**: What's not working well?
2. **Update decision tree**: Modify branches or add steps
3. **Test thoroughly**: Verify improvement works
4. **Version in git**: Track what changed and why
5. **Document**: Update examples if needed

### Adding a New Skill

1. **Create skill**: `.claude/skills/new-skill/SKILL.md`
2. **Update workflows**: Add to relevant workflow files
3. **Update orchestrator**: Add to available skills list
4. **Document**: Show how to use in workflow context

## Best Practices

### For Workflow Authors:

1. **Be explicit**: Don't assume, spell out every branch
2. **Include examples**: Show concrete execution with state
3. **Define failure modes**: What happens when things go wrong?
4. **Specify parallel opportunities**: Where can we speed up?
5. **Document anti-patterns**: What should NOT be done?

### For Orchestrator:

1. **Load workflow file**: Don't improvise, follow the file
2. **Check conditions**: Evaluate before branching
3. **Track state**: Update after every stage
4. **Respect loops**: Don't exceed iteration limits
5. **Escalate appropriately**: Know when to involve user

### For Skill Authors:

1. **Stay focused**: One clear responsibility
2. **Return structured results**: Make it easy to parse
3. **Don't assume context**: Work with provided information
4. **Handle errors gracefully**: Return useful error messages
5. **Document capabilities**: What can and can't you do?

## Future Enhancements

Potential improvements to the system:

### 1. Workflow Metrics
Track and display:
- Average completion time per workflow
- Success rate (passed review first time)
- Most common failure points
- Iteration statistics

### 2. Adaptive Workflows
Learn from past executions:
- Adjust complexity assessment based on history
- Suggest workflow based on similar past requests
- Optimize skill sequences over time

### 3. Workflow Composition
Allow workflows to invoke other workflows:
```
03-new-feature invokes 08-pr-preparation automatically
02-complex-bug might invoke 04-refactoring if code is messy
```

### 4. Custom User Workflows
Users can define project-specific workflows:
```
.claude/skills/workflow/custom/
└── our-deployment-process.md
```

### 5. Workflow Visualization
Generate visual diagrams:
- Decision tree graphs
- State transition diagrams
- Execution timeline views

## Conclusion

The workflow system brings **structure, consistency, and quality** to AI-assisted software engineering by:

1. **Defining clear decision trees** for common scenarios
2. **Enforcing quality gates** through mandatory reviews
3. **Handling feedback loops** systematically
4. **Tracking state** throughout execution
5. **Making behavior transparent** and debuggable

It transforms AI assistance from "helpful but unpredictable" to "reliable engineering partner".

## Quick Reference

| User Need | Workflow File |
|-----------|--------------|
| Fix simple bug | 01-simple-bug-fix.md |
| Investigate complex bug | 02-complex-bug.md |
| Add new feature | 03-new-feature.md |
| Clean up code | 04-refactoring.md |
| Major architecture change | 05-architecture-change.md |
| Fix security issue | 06-security-fix.md |
| Improve performance | 07-performance-optimization.md |
| Prepare for PR | 08-pr-preparation.md |

All workflows guarantee:
- ✅ Systematic execution
- ✅ Quality gates
- ✅ Feedback loops
- ✅ State tracking
- ✅ Error handling

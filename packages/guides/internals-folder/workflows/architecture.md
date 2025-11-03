# Documentation Architecture

## File System Overview

```
lovable-project/
├── guidance/              # Tactical "How-To" Guides (30 files)
│   ├── 01-custom-fonts-integration.md
│   ├── 02-mobile-app-development-options.md
│   ├── ...
│   └── 30-troubleshooting-debugging-patterns.md
│
├── core/                  # Strategic Architecture Docs (5 files)
│   ├── 01-platform-architecture.md
│   ├── 02-development-workflows.md
│   ├── 03-security-model.md
│   ├── 04-ai-integration-patterns.md
│   ├── 05-database-patterns.md
│   └── README.md
│
├── workflows/             # AI Agent Tool Workflows (9+ files)
│   ├── 01-authentication-request.md
│   ├── 02-bug-debugging-request.md
│   ├── 03-new-feature-request.md
│   ├── 04-external-api-integration.md
│   ├── 05-styling-design-request.md
│   ├── 06-database-table-creation.md
│   ├── 07-file-upload-storage.md
│   ├── 08-security-audit-request.md
│   ├── 09-performance-optimization-request.md
│   ├── README.md
│   └── architecture.md (this file)
│
└── server/                # Backend Deployment Docs
    ├── INSTRUCTIONS.md
    ├── README.md
    └── ...
```

## Three-Layer Documentation Model

### Layer 1: `/guidance` - Tactical Implementation

**Purpose**: Step-by-step guides for implementing specific features  
**Audience**: Developers implementing features, AI agents needing implementation details  
**Format**: Tutorial-style with code examples, SQL scripts, commands

**Characteristics:**
- Feature-specific (one guide = one feature)
- Copy-paste ready code examples
- Assumes you know WHY, explains HOW
- 30 guides covering common features

**Example Topics:**
- Custom fonts integration
<!-- SUPABASE DISABLED: - Supabase authentication -->
- Stripe payment integration
- Edge function deployment
- File upload with storage buckets

**When to Use:**
- "How do I implement X feature?"
- Need code examples for specific functionality
- Building a known feature pattern

---

### Layer 2: `/core` - Strategic Architecture

**Purpose**: Deep technical understanding of platform design decisions  
**Audience**: CTOs, senior engineers, architects evaluating/designing systems  
**Format**: Architectural explanations, decision frameworks, system diagrams

**Characteristics:**
- Explains WHY the platform works this way
- Provides decision-making frameworks
- Covers end-to-end system behavior
- 5 comprehensive documents

**Topics:**
1. **Platform Architecture**: Stack, security, scaling, deployment, costs
2. **Development Workflows**: Feature lifecycle, migration patterns, testing
3. **Security Model**: Multi-layer defense, RLS, secrets, attack prevention
4. **AI Integration Patterns**: Model selection, streaming, structured output, costs
5. **Database Patterns**: Schema design, indexes, query optimization, JSON

**When to Use:**
- "Why is the platform architected this way?"
- Making architectural decisions
- Understanding system-wide implications
- Evaluating Lovable for production use

---

### Layer 3: `/workflows` - AI Agent Instructions

**Purpose**: Executable decision trees for AI agents to follow when handling requests  
**Audience**: Lovable AI agent (primary), engineers understanding AI behavior (secondary)  
**Format**: Decision trees, tool sequences, conditional logic, parallel execution patterns

**Characteristics:**
- NOT code to execute, but instructions for AI to interpret
- Heavy use of decision trees and branching logic
<!-- SUPABASE DISABLED: - Tool calling sequences (lov-*, supabase--, security--, etc.) -->
- Parallel execution notation (`tool_a() || tool_b()`)
- Version controlled (currently v1.0.0)

**Current Workflows:**
1. **Authentication Request**: Login/signup implementation with backend setup
2. **Bug Debugging Request**: Console logs → network → screenshot → fix
3. **New Feature Request**: Search → refactor check → implement
4. **External API Integration**: Secrets → edge function → frontend integration
5. **Styling/Design Request**: Visual Edits education → global vs component changes
6. **Database Table Creation**: Schema design → SQL generation → RLS policies
7. **File Upload Storage**: Bucket creation → storage policies → upload component
8. **Security Audit Request**: Scan → analyze → remediate vulnerabilities
9. **Performance Optimization**: Diagnose → optimize (render/network/bundle/images)

**Workflow Structure:**
```markdown
# Tool Workflow: [Workflow Name]

## Scenario
User requests: "example request patterns"

## Agent Capabilities
- tool_name_1 (what it does)
- tool_name_2 (what it does)

## Decision Tree
```
START: Entry point
│
├─→ PHASE 1: Check prerequisites
│   ├─→ Condition A? → Action 1
│   └─→ Condition B? → Action 2
│
├─→ PHASE 2: Execute tools
│   └─→ tool_a() || tool_b() (parallel)
│
└─→ VERIFICATION: Test and report
```

## Tool Sequences
Concrete examples with actual tool calls

## Critical Rules
Non-negotiable requirements

## Common Mistakes
Anti-patterns to avoid
```

**When to Use:**
- Understanding how Lovable AI makes decisions
- Debugging why AI chose certain approach
- Contributing new workflow patterns
- Training new AI agents on Lovable patterns

---

## How the Layers Relate

```
User Request: "Add authentication to my app"
         │
         ▼
┌─────────────────────────────────────────────────┐
│   /workflows/01-authentication-request.md       │
│   • AI reads decision tree                      │
│   • Checks: Backend enabled?                    │
│   • Determines: Need profiles table?            │
│   • Plans tool sequence                         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
<!-- SUPABASE DISABLED: │   /guidance/11-supabase-authentication-impl.md  │ -->
│   • AI references for implementation details    │
│   • Gets SQL for profiles table                 │
│   • Gets auth hook patterns                     │
│   • Gets RLS policy examples                    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│   /core/03-security-model.md                    │
│   • AI understands WHY these patterns           │
│   • Validates security implications             │
│   • Ensures RLS best practices                  │
└─────────────────────────────────────────────────┘
```

**The Flow:**
1. **Workflow** determines WHAT tools to call and WHEN
2. **Guidance** provides HOW to implement with code examples
3. **Core** explains WHY this approach and validates correctness

---

## Navigation Guide for Engineers

### "I need to implement feature X"
→ Start with `/guidance/[feature-name].md`  
→ Copy examples, adapt to your needs

### "I need to understand how Lovable works"
→ Start with `/core/01-platform-architecture.md`  
→ Read relevant core docs based on your needs

### "I want to know how the AI makes decisions"
→ Read `/workflows/README.md` first  
→ Then read specific workflows you're interested in

### "I'm debugging why AI did something unexpected"
→ Check `/workflows/[request-type].md` for decision tree  
→ Verify which branch AI took based on conditions

### "I'm contributing new patterns"
→ Add HOW-TO to `/guidance/`  
→ Add WHY to `/core/` if architectural  
→ Add WHEN/WHAT to `/workflows/` if AI-facing

---

## Versioning & Maintenance

### Guidance Files
- **Versioning**: Per-file updates via git history
- **Breaking Changes**: Rare (usually feature additions)
<!-- SUPABASE DISABLED: - **Updates**: When Lovable/Supabase APIs change -->

### Core Files
- **Versioning**: Per-file semantic versioning in frontmatter
- **Breaking Changes**: Major version bump if architecture shifts
- **Updates**: Quarterly review or on major platform changes

### Workflow Files
- **Versioning**: Semantic versioning for entire workflow set
- **Current**: v1.0.0 (initial stable release)
- **Breaking Changes**: Major version when tool APIs change
- **Backward Compatibility**: Archived in `/workflows/archive/v1.x/`

---

## File Naming Conventions

### Guidance Files
```
[number]-[feature-description]-[type].md
01-custom-fonts-integration.md
<!-- SUPABASE DISABLED: 11-supabase-authentication-implementation.md -->
28-seo-best-practices.md
```
- Numbers 01-30 for ordering
- Kebab-case for readability
- Descriptive names

### Core Files
```
[number]-[domain-area].md
01-platform-architecture.md
03-security-model.md
```
- Numbers 01-05 for logical flow
- Broad domain areas
- Always includes README.md

### Workflow Files
```
[number]-[request-type]-request.md
01-authentication-request.md
08-security-audit-request.md
```
- Numbers for ordering
- Ends with `-request.md` to indicate AI workflow
- Special files: README.md, architecture.md

---

## Cross-References

Workflows → Guidance:
```markdown
<!-- In workflow -->
<!-- SUPABASE DISABLED: See guidance/11-supabase-authentication-implementation.md for implementation details -->
```

Guidance → Core:
```markdown
<!-- In guidance -->
For architectural rationale, see core/03-security-model.md
```

Core → Guidance:
```markdown
<!-- In core -->
Implementation guide: guidance/12-row-level-security-fundamentals.md
```

---

## Key Design Principles

### 1. Single Source of Truth
- Each concept documented once in appropriate layer
- Other layers reference, don't duplicate

### 2. Separation of Concerns
- **HOW** (guidance) ≠ **WHY** (core) ≠ **WHEN/WHAT** (workflows)
- Reduces maintenance burden
- Clear purpose for each file

### 3. Machine + Human Readable
- Workflows optimized for AI parsing (structured decision trees)
- Guidance optimized for developer implementation (code examples)
- Core optimized for human understanding (explanations)

### 4. Versioning Strategy
- Workflows tightly version controlled (v1.0.0)
- Guidance loosely version controlled (git history)
- Core semantically versioned per file

### 5. Scalability
- Easy to add new guidance files (31, 32, 33...)
- Easy to add new workflows (10, 11, 12...)
- Core remains stable (rare additions)

---

## Quick Reference

| Need | Go To | Example |
|------|-------|---------|
| Implement auth | `/guidance/11-*` | Get SQL + code examples |
| Understand security | `/core/03-*` | Learn RLS architecture |
| Debug AI behavior | `/workflows/01-*` | See decision tree |
| Add Stripe | `/guidance/08-*` | Copy integration pattern |
| Optimize performance | `/workflows/09-*` | AI diagnosis workflow |
| Platform overview | `/core/01-*` | Full stack explanation |
| Create edge function | `/guidance/15-*` | CORS, deploy, invoke |
| Security audit | `/workflows/08-*` | Scan → fix workflow |

---

## Contributing Guidelines

### Adding New Guidance
1. Determine appropriate number (31+)
2. Follow naming: `[number]-[feature]-[category].md`
3. Include: problem, solution, code examples, common issues
4. Update this architecture.md if new category

### Adding New Workflow
1. Determine appropriate number (10+)
2. Follow structure: Scenario → Capabilities → Decision Tree → Sequences → Rules
3. Include parallel execution patterns (`||`)
4. Update `/workflows/README.md` with new workflow
5. Version bump if breaking changes

### Updating Core
1. Check if truly architectural (not tactical)
2. Update semantic version in frontmatter if breaking
3. Update `/core/README.md` if new document
4. Review cross-references in guidance/workflows

---

## Tools Reference for Workflows

**File Operations:**
- `lov-view(file)` - Read file contents
- `lov-write(file, content)` - Create/overwrite file
- `lov-line-replace(file, search, replace)` - Edit specific lines
- `lov-search-files(query, pattern)` - Regex search across files
- `lov-delete(file)` - Remove file
- `lov-rename(old, new)` - Rename file

**Backend:**
<!-- SUPABASE DISABLED: - `supabase--enable()` - Enable Lovable Cloud -->
- `secrets--add_secret([keys])` - Add secure environment variables
- `secrets--update_secret([keys])` - Update existing secrets

**Debugging:**
- `lov-read-console-logs(search)` - Get browser console output
- `lov-read-network-requests(search)` - Get network activity
- `project_debug--sandbox-screenshot(path)` - Capture UI screenshot

**Security:**
- `security--run_security_scan()` - Comprehensive security audit
- `security--get_security_scan_results()` - Retrieve scan findings
- `security--manage_security_finding(operations)` - Update/delete findings

**External:**
- `websearch--web_search(query)` - General web search
- `websearch--web_code_search(query)` - Technical documentation search
- `lov-download-to-repo(url, path)` - Download external files

**Dependencies:**
- `lov-add-dependency(package)` - Install npm package
- `lov-remove-dependency(package)` - Uninstall package

---

## Summary

This documentation system separates three concerns:

1. **HOW to build** (`/guidance`) → For developers implementing features
2. **WHY it works** (`/core`) → For architects understanding design
3. **WHAT to do WHEN** (`/workflows`) → For AI agents making decisions

Navigate based on your role:
- **Developer**: Start with `/guidance`
- **Architect/CTO**: Start with `/core`
- **AI Engineer**: Start with `/workflows`
- **Debugging AI**: Check `/workflows` decision trees

All three layers work together to provide comprehensive documentation for both human engineers and AI agents working on Lovable projects.

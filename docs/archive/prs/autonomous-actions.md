# RFC: Jarvis-Like Autonomous Actions

**Status:** Draft
**RFC ID:** RFC-2026-007
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

Claude acts more like a capable assistant than a chatbot. It takes initiative, handles multi-step tasks without hand-holding, and reports back when done. Less "here's how to do it" and more "I did it, here's what happened."

## Problem

Current interaction feels transactional. User asks → Claude responds → User asks again. Every step needs user input. Real assistants anticipate needs, complete complex tasks autonomously, and only bother you when necessary.

**User frustration:** "I just want the work done. Stop asking me to confirm every little thing."

## User Stories

1. **Autonomous completion:** User says "Add a blog to my site" → Claude creates pages, navigation, styling, sample posts, and reports back when done
2. **Problem solving:** Claude encounters an error → Tries to fix it before reporting → Only escalates if truly stuck
3. **Proactive suggestions:** After completing a task → "I noticed your images aren't optimized. Want me to fix that too?"
4. **Status updates:** During long tasks → "Still working on it, about 60% done..."
5. **Smart defaults:** Instead of asking "what color?" → Uses brand colors or sensible defaults → Asks only for important decisions

## Current vs. Desired Behavior

| Scenario | Current | Desired |
|----------|---------|---------|
| User: "Add a contact form" | "I'll add a form. What fields do you want?" | *Adds form with sensible defaults* "Done! Added a contact form with name, email, message, and submit. Want me to change anything?" |
| Build error occurs | "There's an error on line 42: ..." | *Fixes obvious typo silently* "Fixed a small typo and rebuilt. Site is live." |
| User: "Make my site faster" | "Here are some ways to improve performance..." | *Optimizes images, enables caching, minifies code* "Improved load time from 4.2s to 1.8s. Here's what I did: [list]" |
| User uploads 10 images | "I'll add these. Where should they go?" | *Adds to gallery, optimizes, creates thumbnails* "Added all 10 to your gallery. Optimized them too (saved 2.3MB)." |

## Autonomy Levels

Define how autonomous Claude should be for different action types:

| Category | Level | Behavior |
|----------|-------|----------|
| **Content edits** | High | Just do it, report after |
| **Structural changes** | Medium | Do it, but summarize what changed |
| **Destructive actions** | Low | Confirm before deleting/removing |
| **External actions** | Confirm | Always confirm (email, publish, API calls) |
| **Financial** | Explicit | Never without explicit approval |

```typescript
interface ActionPolicy {
  category: string
  autonomyLevel: 'high' | 'medium' | 'low' | 'confirm' | 'explicit'
  requiresConfirmation: boolean
  examples: string[]
}

const policies: ActionPolicy[] = [
  {
    category: 'content_edit',
    autonomyLevel: 'high',
    requiresConfirmation: false,
    examples: ['Fix typo', 'Update text', 'Add content']
  },
  {
    category: 'structural_change',
    autonomyLevel: 'medium',
    requiresConfirmation: false,
    examples: ['Add new page', 'Reorganize nav', 'Add component']
  },
  {
    category: 'destructive',
    autonomyLevel: 'low',
    requiresConfirmation: true,
    examples: ['Delete page', 'Remove section', 'Clear content']
  }
]
```

## Implementation Approach

### 1. Task Planning

Before executing, Claude plans the full task:

```typescript
interface TaskPlan {
  goal: string
  steps: TaskStep[]
  estimatedDuration: 'quick' | 'medium' | 'long'
  requiresConfirmation: boolean
  potentialIssues: string[]
}

interface TaskStep {
  description: string
  action: string  // file edit, command, etc.
  canFail: boolean
  fallbackPlan?: string
}

// Example: "Add a blog to my site"
const blogPlan: TaskPlan = {
  goal: 'Add a blog section to the site',
  steps: [
    { description: 'Create blog index page', action: 'create_file', canFail: false },
    { description: 'Create blog post template', action: 'create_file', canFail: false },
    { description: 'Add sample posts', action: 'create_files', canFail: true },
    { description: 'Add blog to navigation', action: 'edit_file', canFail: false },
    { description: 'Style blog pages', action: 'edit_file', canFail: false },
  ],
  estimatedDuration: 'medium',
  requiresConfirmation: false,
  potentialIssues: ['May need to adjust existing nav styles']
}
```

### 2. Progress Updates

For longer tasks, stream progress:

```typescript
interface ProgressUpdate {
  type: 'progress' | 'substep' | 'warning' | 'complete'
  message: string
  percentComplete?: number
  stepNumber?: number
  totalSteps?: number
}

// Stream updates to user
async function* executeWithProgress(plan: TaskPlan): AsyncGenerator<ProgressUpdate> {
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]

    yield {
      type: 'substep',
      message: step.description,
      stepNumber: i + 1,
      totalSteps: plan.steps.length,
      percentComplete: ((i + 1) / plan.steps.length) * 100
    }

    try {
      await executeStep(step)
    } catch (error) {
      if (step.canFail && step.fallbackPlan) {
        yield { type: 'warning', message: `Minor issue, trying alternative...` }
        await executeFallback(step.fallbackPlan)
      } else {
        throw error
      }
    }
  }

  yield {
    type: 'complete',
    message: 'All done!',
    percentComplete: 100
  }
}
```

### 3. Error Recovery

Try to fix issues before escalating:

```typescript
async function executeWithRecovery(action: Action): Promise<Result> {
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await execute(action)
    } catch (error) {
      // Can we fix this ourselves?
      const fix = await analyzeAndFix(error)

      if (fix.success) {
        // Fixed it, try again
        continue
      }

      if (attempt === maxRetries) {
        // Give up, report to user
        return {
          success: false,
          message: `Ran into an issue I couldn't fix: ${error.message}`,
          attemptedFixes: fix.attempts
        }
      }
    }
  }
}

async function analyzeAndFix(error: Error): Promise<FixAttempt> {
  // Common auto-fixes
  if (error.message.includes('Cannot find module')) {
    await installMissingPackage(error)
    return { success: true, description: 'Installed missing package' }
  }

  if (error.message.includes('SyntaxError')) {
    const fixed = await attemptSyntaxFix(error)
    return fixed
  }

  // Can't auto-fix
  return { success: false, attempts: [] }
}
```

### 4. Proactive Suggestions

After completing a task, look for related improvements:

```typescript
async function findRelatedImprovements(
  completedTask: Task,
  site: Site
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = []

  // Just added images?
  if (completedTask.involvedImages) {
    const unoptimized = await findUnoptimizedImages(site)
    if (unoptimized.length > 0) {
      suggestions.push({
        message: `I noticed ${unoptimized.length} images that could be optimized`,
        action: 'optimize_images',
        benefit: `Could save ${estimateSavings(unoptimized)}`,
        priority: 'medium'
      })
    }
  }

  // Just created new pages?
  if (completedTask.createdPages) {
    const missingSeo = await checkSeoForPages(completedTask.createdPages)
    if (missingSeo.length > 0) {
      suggestions.push({
        message: 'The new pages are missing SEO metadata',
        action: 'add_seo_metadata',
        benefit: 'Better search engine visibility',
        priority: 'low'
      })
    }
  }

  return suggestions
}
```

### 5. Smart Defaults

Instead of asking, use sensible defaults:

```typescript
interface SmartDefaults {
  colors: {
    primary: string      // From brand colors or site theme
    secondary: string
  }
  typography: {
    fontFamily: string   // Match existing site
    sizes: Record<string, string>
  }
  layout: {
    maxWidth: string     // Match existing
    spacing: string
  }
  content: {
    buttonText: string   // "Submit" not "Click here"
    placeholders: Record<string, string>
  }
}

async function resolveDefaults(site: Site): Promise<SmartDefaults> {
  // Extract from existing site
  const existingStyles = await analyzeExistingStyles(site)
  const brandColors = await getBrandColors(site)
  const userPreferences = await getUserMemory(site.userId)

  return {
    colors: {
      primary: brandColors?.primary || existingStyles.primaryColor || '#3B82F6',
      secondary: brandColors?.secondary || existingStyles.secondaryColor || '#6B7280',
    },
    typography: {
      fontFamily: existingStyles.fontFamily || 'system-ui',
      sizes: existingStyles.fontSizes || defaultFontSizes,
    },
    // ... etc
  }
}
```

## Response Format Changes

### Before (Chatty)

```
User: Add a testimonials section

Claude: I'd be happy to add a testimonials section! Before I do,
I have a few questions:

1. How many testimonials would you like to display?
2. What layout do you prefer - cards, carousel, or list?
3. Should I include photos of the people?
4. Where on the page should it go?

Let me know and I'll create it for you!
```

### After (Autonomous)

```
User: Add a testimonials section

Claude: Done! Added a testimonials section to your homepage.

What I did:
• Created a 3-column card layout
• Added 3 placeholder testimonials (you can edit these)
• Included spots for photos and names
• Placed it after your features section

[Preview] [Edit testimonials]

Want me to adjust anything?
```

## User Controls

Users should be able to adjust autonomy level:

```
┌─────────────────────────────────────────────────┐
│ Claude's Autonomy Settings                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ How independent should Claude be?               │
│                                                 │
│ ○ Ask me about everything                       │
│   Claude confirms before any change             │
│                                                 │
│ ● Smart (recommended)                           │
│   Does routine tasks, asks for big decisions    │
│                                                 │
│ ○ Just do it                                    │
│   Maximum autonomy, reports after completion    │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ Always confirm before:                          │
│ [✓] Deleting pages or content                   │
│ [✓] Publishing or making live                   │
│ [✓] Changing domain settings                    │
│ [ ] Adding new pages                            │
│ [ ] Installing packages                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Task planning + batch execution | 3-4 days |
| Phase 2 | Progress updates during long tasks | 2 days |
| Phase 3 | Error recovery without escalation | 3-4 days |
| Phase 4 | Smart defaults from site analysis | 2-3 days |
| Phase 5 | Proactive suggestions | 2-3 days |
| Phase 6 | User autonomy controls | 2 days |
| Total | Full autonomous behavior | ~3 weeks |

## Success Metrics

- Tasks completed per session (should increase)
- Questions asked per task (should decrease)
- User satisfaction ("it just works" feeling)
- Time from request to completion
- Error recovery rate (issues fixed without user input)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Claude does something user didn't want | Always show what was done, easy undo |
| Over-confidence leads to mistakes | Confidence scoring, escalate when uncertain |
| User feels out of control | Clear progress updates, easy to interrupt |
| Makes destructive changes | Confirmation for deletions, auto-backup |

## Open Questions

1. How to handle ambiguous requests? (multiple valid interpretations)
2. Should there be an "undo last action" button always visible?
3. How verbose should completion reports be?
4. How to calibrate confidence for escalation decisions?

## References

- [OpenClaw: "24/7 Jarvis Experience"](https://techcrunch.com/2026/01/27/everything-you-need-to-know-about-viral-personal-ai-assistant-clawdbot-now-moltbot/)
- [IBM on OpenClaw](https://www.ibm.com/think/news/clawdbot-ai-agent-testing-limits-vertical-integration)
- Claude's agentic capabilities documentation
- [Linear](https://linear.app/) - opinionated defaults, minimal questions

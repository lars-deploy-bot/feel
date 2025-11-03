# Tool Workflow: New Feature Request

## Scenario
User requests: "Add [specific feature] to my app"

## Agent Capabilities
- Code search (lov-search-files)
- Code reading (lov-view)
- Code writing (lov-write, lov-line-replace)
- File deletion (lov-delete)
<!-- SUPABASE DISABLED: - Backend enablement (supabase--enable) -->
- Dependency management (lov-add-dependency)

## Decision Tree

```
START: User requests new feature
│
├─→ ANALYSIS PHASE:
│   ├─→ Check useful-context: Does feature already exist?
│   │   ├─→ YES: Inform user, ask if they want modifications
│   │   └─→ NO: Proceed
│   │
│   ├─→ Check: Does feature require backend?
│   │   ├─→ Database storage
│   │   ├─→ Authentication
│   │   ├─→ File uploads
│   │   ├─→ External API calls (with secrets)
│   │   ├─→ Server-side logic
│   │   └─→ If ANY yes: Need backend
│   │
│   ├─→ Check: Does feature require new dependencies?
│   │   └─→ lov-add-dependency if needed
│   │
│   └─→ Check: Does feature require refactoring?
│       ├─→ Will new code make files >500 lines?
│       ├─→ Is existing code tightly coupled?
│       └─→ If YES: Plan refactoring first
│
├─→ BACKEND ENABLEMENT (if needed):
│   ├─→ IF backend needed AND not enabled:
<!-- SUPABASE DISABLED: │   │   ├─→ supabase--enable() -->
│   │   └─→ WAIT for success
│   │
│   └─→ IF external API needed:
│       └─→ secrets--add_secret([API_KEY_NAME])
│
├─→ IMPLEMENTATION PLANNING:
│   ├─→ List files to create:
│   │   ├─→ New components
│   │   ├─→ New hooks
│   │   ├─→ New utilities
│   │   ├─→ New pages
│   │   └─→ Edge functions
│   │
│   ├─→ List files to modify:
│   │   ├─→ Routes (App.tsx)
│   │   ├─→ Navigation components
│   │   ├─→ Parent components
│   │   └─→ Config files
│   │
│   └─→ Determine: Can writes be parallel?
│       ├─→ Independent new files: YES (parallel)
│       └─→ Same file edits: NO (sequential or single edit)
│
├─→ CONTEXT GATHERING:
│   ├─→ For files to modify:
│   │   ├─→ Check: Already in useful-context?
│   │   │   ├─→ YES: Skip reading
│   │   │   └─→ NO: lov-view(file)
│   │   └─→ Read in parallel if multiple files
│   │
│   └─→ For related existing code:
│       └─→ lov-search-files(related-pattern, "src/**")
│           └─→ lov-view(relevant-files) if needed
│
└─→ EXECUTION PHASE:
    ├─→ CREATE NEW FILES (parallel):
    │   ├─→ lov-write(component1) || lov-write(component2) || lov-write(hook)
    │   └─→ lov-write(edge-function) if backend feature
    │
    ├─→ MODIFY EXISTING FILES:
    │   ├─→ IF single file: lov-line-replace(file, old, new)
    │   └─→ IF multiple files: Parallel lov-line-replace calls
    │
    └─→ DATABASE SETUP (if needed):
        └─→ Provide SQL to user for manual execution
```

## Tool Sequence Examples

### Example 1: Simple Frontend Feature (No Backend)
Request: "Add a dark mode toggle"

```
1. lov-search-files("theme|dark", "src/**")
2. IF theme system exists:
   3a. lov-view(theme-related-file)
   3b. lov-line-replace(add toggle component)
3. ELSE:
   4. lov-add-dependency("next-themes@latest")
   5. lov-write(src/components/ThemeToggle.tsx) || lov-line-replace(src/App.tsx)
```

### Example 2: Feature Requiring Backend
Request: "Add a contact form that sends emails"

```
1. Check: Backend enabled?
<!-- SUPABASE DISABLED:    ├─→ NO: supabase--enable() -->
   └─→ YES: Continue
2. secrets--add_secret(["RESEND_API_KEY"])
3. WAIT for user to add secret
<!-- SUPABASE DISABLED: 4. lov-write(supabase/functions/send-email/index.ts) ||  -->
   lov-write(src/components/ContactForm.tsx)
5. IF routes need updating:
   6. lov-view(src/App.tsx)
   7. lov-line-replace(src/App.tsx, old-routes, new-routes)
```

### Example 3: Feature Requiring Refactoring
Request: "Add user profile editing" (but profiles page is already 600 lines)

```
1. lov-view(src/pages/Profile.tsx)
2. Identify: File too large, needs splitting
3. REFACTOR FIRST:
   4. lov-write(src/components/ProfileHeader.tsx) ||
      lov-write(src/components/ProfileForm.tsx) ||
      lov-write(src/hooks/useProfile.ts)
   5. lov-line-replace(src/pages/Profile.tsx, monolithic-code, refactored-imports)
4. THEN ADD FEATURE:
   6. lov-write(src/components/ProfileEditDialog.tsx)
   7. lov-line-replace(src/components/ProfileForm.tsx, add-edit-logic)
```

### Example 4: Feature with Multiple Dependencies
Request: "Add real-time chat with AI"

```
1. Backend check: 
<!-- SUPABASE DISABLED:    ├─→ supabase--enable() if needed -->
2. Dependencies:
<!-- SUPABASE DISABLED:    3. lov-add-dependency("@supabase/supabase-js@latest") || -->
      lov-add-dependency("date-fns@latest")
3. Secrets:
   4. Check: LOVABLE_API_KEY exists? (auto-provided by Cloud)
4. Implementation (parallel):
<!-- SUPABASE DISABLED:    5. lov-write(supabase/functions/chat/index.ts) || -->
      lov-write(src/components/ChatInterface.tsx) ||
      lov-write(src/hooks/useChat.ts) ||
      lov-write(src/lib/chatUtils.ts)
5. Integration:
   6. lov-view(src/App.tsx)
   7. lov-line-replace(src/App.tsx, add-chat-route)
```

### Example 5: Database-Heavy Feature
Request: "Add a blog with posts and categories"

```
<!-- SUPABASE DISABLED: 1. Backend check: supabase--enable() if needed -->
2. Provide SQL schema:
   - posts table
   - categories table
   - RLS policies
3. Implementation (parallel):
   4. lov-write(src/pages/Blog.tsx) ||
      lov-write(src/pages/BlogPost.tsx) ||
      lov-write(src/components/PostCard.tsx) ||
      lov-write(src/components/CategoryFilter.tsx) ||
      lov-write(src/hooks/useBlogPosts.ts)
5. Routes:
   6. lov-line-replace(src/App.tsx, add-blog-routes)
```

## Critical Rules

1. **Check existing code first** - Don't duplicate functionality
2. **Enable backend before backend features** - No exceptions
3. **Maximize parallelization** - Write independent files simultaneously
4. **Refactor before adding complexity** - Don't make bad code worse
5. **Dependencies before code** - Add packages before using them
6. **Plan before executing** - Know all files you'll create/modify
7. **Read only what's not in context** - Check useful-context first
8. **Small focused files** - Create components, hooks, utils separately

## Common Mistakes

❌ Writing code without checking if feature exists
❌ Not enabling backend when feature needs it
❌ Sequential writes when parallel possible
❌ Creating monolithic files instead of small components
❌ Modifying files without reading them first (if not in context)
❌ Not adding dependencies before using them
❌ Not handling secrets properly for API calls
❌ Forgetting to update routes/navigation

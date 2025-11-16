# Reducing User Prompting: Learning from Lovable

## The Problem

Users shouldn't have to repeatedly prompt the AI for basic things. They're "stupid" in the sense that they expect the system to be smart enough to:
- Understand context automatically
- Check prerequisites before implementing
- Fix common errors without asking
- Remember what they're working on
- Make reasonable assumptions

## Key Patterns from Lovable

### 1. **Context Awareness (CRITICAL)**

**Lovable's Approach:**
- `<current-view>` tag includes:
  - What page user is viewing
  - Selected file
  - Open files
  - Search terms
  - UI state

**Our Current State:**
- We have workspace context
- We have conversation history
- **Missing**: Page/file context, visual context

**Impact**: 🔥 **HIGHEST** - Users constantly say "on this page" or "this component"

**Implementation:**
```typescript
// Add to system prompt or context
<current-view>
  User is viewing: /chat page
  Selected file: src/components/Header.tsx
  Open files: [Header.tsx, App.tsx]
  Search term: "useState"
  Recent changes: [Modified Header.tsx 5 minutes ago]
</current-view>
```

**How to Get This:**
- Track active file in editor (if we have one)
- Track URL/page user is on
- Track recently modified files
- Pass to system prompt or as context

### 2. **Prerequisite Auto-Checking (CRITICAL)**

**Lovable's Approach:**
- Before implementing feature, automatically checks:
  - Backend enabled? → Enable if needed
  - Dependencies installed? → Install if missing
  - Secrets exist? → Add if needed
  - Files in context? → Read if not present

**Our Current State:**
- We check workspace exists
- **Missing**: Auto-check dependencies, auto-install missing packages

**Impact**: 🔥 **HIGHEST** - Users get "package not found" errors, then have to ask to install

**Implementation:**
```typescript
// In workflow execution
1. User: "Add date formatting"
2. AI detects: Uses date-fns
3. AI checks: Grep("date-fns", "package.json")
4. IF not found: install_package({ package: "date-fns" }) AUTOMATICALLY
5. THEN: Implement feature
```

**Workflow Enhancement:**
Add to `02-new-feature-request.md`:
```
├─→ AUTO-CHECK PREREQUISITES:
│   ├─→ Detect needed packages from code patterns
│   ├─→ Check package.json for dependencies
│   ├─→ IF missing: install_package() automatically
│   └─→ Continue implementation
```

### 3. **Proactive Information Gathering**

**Lovable's Approach:**
- "Proactively investigate, analyze, and gather information before asking the client questions"
- Do substantial work first, then ask if needed

**Our Current State:**
- We have `commonErrorPrompt` that says this
- But AI still asks too many questions

**Impact**: 🔥 **HIGH** - Users get frustrated with "which file?" questions

**Implementation:**
- Enhance workflows to be more prescriptive
- Add "auto-detect" steps before asking
- Example: Instead of "which component?", search codebase first

### 4. **Error Auto-Recovery**

**Lovable's Approach:**
- Automatically fixes common errors
- Retries with corrections
- Provides alternative approaches

**Our Current State:**
- We have error handling
- **Missing**: Auto-fix common patterns

**Impact**: 🔥 **HIGH** - Users see errors, have to ask to fix

**Implementation:**
```typescript
// After check_codebase() finds errors:
1. IF import error: Auto-install missing package
2. IF type error: Auto-fix common type issues
3. IF syntax error: Auto-fix common syntax mistakes
4. IF still errors: Report to user
```

**Workflow Enhancement:**
Add to `01-bug-debugging-request.md`:
```
├─→ AUTO-FIX COMMON ERRORS:
│   ├─→ IF import error: install_package() automatically
│   ├─→ IF type error: Fix common type issues
│   └─→ IF syntax error: Fix common syntax mistakes
```

### 5. **Smart Defaults & Assumptions**

**Lovable's Approach:**
- Makes reasonable assumptions
- Uses design system defaults
- Follows existing patterns

**Our Current State:**
- We have design system rules
- **Missing**: Auto-apply defaults

**Impact**: 🔥 **MEDIUM** - Users have to specify obvious things

**Implementation:**
- When creating component: Use design system tokens automatically
- When adding route: Follow existing routing pattern
- When styling: Use semantic tokens, not direct colors

### 6. **Session Memory & Continuity**

**Lovable's Approach:**
- Remembers what user is working on
- Continues from where left off
- Understands conversation context

**Our Current State:**
- ✅ We have session persistence
- ✅ We have conversation history
- **Missing**: Explicit "working on X" tracking

**Impact**: 🔥 **MEDIUM** - Users have to remind AI what they're doing

**Implementation:**
```typescript
// Track active task
<active-task>
  User is working on: Adding dark mode toggle
  Started: 10 minutes ago
  Files modified: [ThemeToggle.tsx, App.tsx]
  Next steps: [Add route, test toggle]
</active-task>
```

### 7. **Visual Context Understanding**

**Lovable's Approach:**
- Can see screenshots
- Understands visual state
- Knows what page looks like

**Our Current State:**
- We have image attachments
- **Missing**: Auto-capture current page context

**Impact**: 🔥 **MEDIUM** - Users say "this page" but AI doesn't know which

**Implementation:**
- Option 1: Auto-capture screenshot when user mentions "this page"
- Option 2: Track current URL/page automatically
- Option 3: User can attach screenshot easily

## Implementation Priority

### Phase 1: Highest Impact (Do First)

1. **Prerequisite Auto-Checking** ⭐⭐⭐
   - Auto-detect missing packages
   - Auto-install before implementing
   - Update workflow: `02-new-feature-request.md`

2. **Error Auto-Recovery** ⭐⭐⭐
   - Auto-fix import errors
   - Auto-fix common type errors
   - Update workflow: `01-bug-debugging-request.md`

3. **Context Awareness** ⭐⭐⭐
   - Track current page/URL
   - Track selected file
   - Add to system prompt context

### Phase 2: High Impact

4. **Proactive Information Gathering** ⭐⭐
   - Enhance workflows with auto-detect steps
   - Search before asking
   - Read files before asking which one

5. **Smart Defaults** ⭐⭐
   - Auto-apply design system
   - Follow existing patterns
   - Use semantic tokens automatically

### Phase 3: Medium Impact

6. **Session Memory** ⭐
   - Track active task
   - Remember what user is working on
   - Continue from where left off

7. **Visual Context** ⭐
   - Auto-capture page context
   - Track current URL
   - Easy screenshot attachment

## Specific Implementation Examples

### Example 1: Auto-Install Missing Packages

**Current Flow:**
```
User: "Add date formatting"
AI: Implements feature using date-fns
User: Gets error "date-fns not found"
User: "Install date-fns"
AI: install_package({ package: "date-fns" })
```

**Improved Flow:**
```
User: "Add date formatting"
AI: 
  1. Detects: Feature needs date-fns
  2. Checks: Grep("date-fns", "package.json")
  3. IF not found: install_package({ package: "date-fns" }) automatically
  4. THEN: Implements feature
User: Gets working feature immediately
```

**Implementation:**
```typescript
// In workflow execution
async function implementFeature(featureDescription: string) {
  // 1. Detect needed packages
  const neededPackages = detectPackages(featureDescription)
  
  // 2. Check if installed
  for (const pkg of neededPackages) {
    const installed = await checkPackageInstalled(pkg)
    if (!installed) {
      await installPackage({ package: pkg })
    }
  }
  
  // 3. Implement feature
  await implementFeatureCode(featureDescription)
}
```

### Example 2: Auto-Fix Common Errors

**Current Flow:**
```
User: Makes change
AI: check_codebase({})
AI: Reports: "Cannot find module 'lodash'"
User: "Install lodash"
AI: install_package({ package: "lodash" })
```

**Improved Flow:**
```
User: Makes change
AI: 
  1. check_codebase({})
  2. IF import error detected:
     a. Extract package name from error
     b. install_package({ package: "lodash" }) automatically
     c. check_codebase({}) again
  3. Report: "Fixed import error, installed lodash"
```

**Implementation:**
```typescript
// After check_codebase()
const errors = await checkCodebase({})
for (const error of errors) {
  if (error.type === "import_error") {
    const packageName = extractPackageName(error.message)
    await installPackage({ package: packageName })
  }
}
```

### Example 3: Context Awareness

**Current Flow:**
```
User: "Change the button color"
AI: "Which button?"
User: "The one on the homepage"
AI: "Which file is that?"
User: "src/pages/Home.tsx"
```

**Improved Flow:**
```
<current-view>
  Page: /home
  File: src/pages/Home.tsx
  Recent: Modified Home.tsx 2 minutes ago
</current-view>

User: "Change the button color"
AI: Reads Home.tsx, finds button, changes color
```

**Implementation:**
```typescript
// In system prompt or context
interface CurrentView {
  page: string // URL path
  selectedFile?: string // Currently open file
  openFiles: string[] // All open files
  recentChanges: Array<{ file: string; time: Date }>
}

// Pass to system prompt
const context = {
  currentView: {
    page: window.location.pathname,
    selectedFile: getSelectedFile(),
    openFiles: getOpenFiles(),
    recentChanges: getRecentChanges(),
  }
}
```

## Workflow Updates Needed

### Update `02-new-feature-request.md`

Add new section:
```
├─→ AUTO-CHECK PREREQUISITES:
│   ├─→ Detect packages needed (from code patterns)
│   ├─→ Check package.json: Grep("package-name", "package.json")
│   ├─→ IF missing: install_package() automatically
│   └─→ Continue implementation
```

### Update `01-bug-debugging-request.md`

Add new section:
```
├─→ AUTO-FIX COMMON ERRORS:
│   ├─→ IF import error: Extract package, install automatically
│   ├─→ IF type error: Fix common type issues automatically
│   ├─→ IF syntax error: Fix common syntax mistakes
│   └─→ IF still errors: Report to user
```

## System Prompt Updates

Add to system prompt:
```
CONTEXT AWARENESS:
- User is currently viewing: [page/URL]
- Recently modified files: [list]
- Active task: [what user is working on]

AUTO-CHECKING:
- Before implementing features, automatically check for missing dependencies
- Before reporting errors, automatically try to fix common issues
- Install missing packages automatically when detected

PROACTIVE BEHAVIOR:
- Do substantial work before asking questions
- Search codebase before asking "which file?"
- Make reasonable assumptions based on context
```

## Expected Impact

### Before (Current State)
- User: "Add date formatting"
- AI: Implements feature
- User: Gets error
- User: "Install date-fns"
- AI: Installs package
- User: "Try again"
- AI: Feature works

**Prompts needed**: 3

### After (With Auto-Checking)
- User: "Add date formatting"
- AI: Detects needs date-fns → Installs automatically → Implements → Works

**Prompts needed**: 1

### Reduction: 66% fewer prompts

## Next Steps

1. **Implement prerequisite auto-checking** in workflows
2. **Add error auto-recovery** to bug debugging workflow
3. **Add context awareness** to system prompt
4. **Test with real users** - measure prompt reduction
5. **Iterate** based on feedback

## Questions to Answer

1. **How to detect needed packages?**
   - Option A: Pattern matching (if code uses `date-fns`, need date-fns)
   - Option B: AI analysis (let AI detect from feature description)
   - **Recommendation**: Option B (more flexible)

2. **How to track current view?**
   - Option A: Frontend sends URL/file info with each request
   - Option B: Backend tracks from session
   - **Recommendation**: Option A (more accurate)

3. **How aggressive should auto-fixing be?**
   - Option A: Fix everything automatically
   - Option B: Fix common errors, ask for complex ones
   - **Recommendation**: Option B (safer, less surprising)


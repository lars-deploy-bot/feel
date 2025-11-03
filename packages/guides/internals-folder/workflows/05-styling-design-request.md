# Tool Workflow: Styling & Design Changes

## Scenario
User requests: "Make it look better" / "Change the colors" / "Update the design"

## Agent Capabilities
- Code search (alive-search-files)
- Code reading (alive-view)
- Code writing (alive-line-replace)
- Screenshots (project_debug--sandbox-screenshot)

## Decision Tree

```
START: User wants styling changes
│
├─→ SCOPE ANALYSIS:
│   ├─→ Simple text/color change on static element?
│   │   ├─→ YES: Inform about Visual Edits feature
│   │   └─→ Provide: Link to Visual Edits docs
│   │
│   ├─→ Check: Global design system change or component-specific?
│   │   ├─→ GLOBAL: Modify index.css / tailwind.config.ts
│   │   └─→ COMPONENT: Modify specific component files
│   │
│   ├─→ Check: Are colors specified?
│   │   ├─→ NO: User wants "better" design
│   │   │   └─→ project_debug--sandbox-screenshot("/")
│   │   │       └─→ Analyze current design, propose changes
│   │   └─→ YES: Use specified colors
│   │
│   └─→ Check: Request mentions specific components?
│       ├─→ YES: alive-search-files(component-name, "src/**")
│       └─→ NO: Determine from context/screenshot
│
├─→ CONTEXT GATHERING:
│   ├─→ For design system changes:
│   │   ├─→ Check useful-context: index.css present?
│   │   │   ├─→ YES: Use it
│   │   │   └─→ NO: alive-view(src/index.css)
│   │   └─→ alive-view(tailwind.config.ts) if custom config needed
│   │
│   └─→ For component changes:
│       ├─→ alive-search-files(component-pattern, "src/**")
│       └─→ alive-view(identified-components) IF not in context
│           └─→ Parallel reads if multiple components
│
├─→ DESIGN SYSTEM DECISION:
│   ├─→ Check current colors:
│   │   ├─→ Using semantic tokens? (--primary, --secondary)
│   │   │   ├─→ YES: Good, modify tokens
│   │   │   └─→ NO: Refactor to use tokens
│   │   │
│   │   └─→ Using direct colors? (text-white, bg-blue-500)
│   │       └─→ BAD: Must refactor to semantic tokens
│   │
│   └─→ Color format check:
│       ├─→ Using HSL? Good
│       ├─→ Using RGB? Convert to HSL
│       └─→ Using hex? Convert to HSL
│
└─→ IMPLEMENTATION PHASE:
    ├─→ GLOBAL DESIGN CHANGES:
    │   └─→ alive-line-replace(src/index.css, old-colors, new-hsl-colors)
    │
    ├─→ COMPONENT-SPECIFIC CHANGES:
    │   ├─→ Check: Multiple independent components?
    │   │   ├─→ YES: Parallel alive-line-replace calls
    │   │   └─→ NO: Single alive-line-replace
    │   │
    │   └─→ Ensure: Using design system tokens, not direct colors
    │
    └─→ POST-CHANGE EDUCATION:
        └─→ IF simple static changes:
            └─→ Educate about Visual Edits feature
```

## Tool Sequences

### Sequence 1: Simple Static Element Change
Request: "Change the button text to 'Submit'"

```
1. Fulfill request:
   ├─→ alive-search-files("button.*Submit|Submit.*button", "src/**")
   └─→ alive-line-replace(component-file, old-text, new-text)
   
2. EDUCATE USER:
   └─→ "I've changed that for you. For future simple changes like text 
       or colors on static elements, you can use Visual Edits - it's 
       free and instant! [Link to Visual Edits docs]"
```

### Sequence 2: Global Color Scheme Change
Request: "Make the primary color purple"

```
1. Check useful-context: Is index.css shown?
   ├─→ NO: alive-view(src/index.css)
   └─→ YES: Use it

2. Analyze current design tokens:
   ├─→ Identify all --primary variants
   └─→ Check if using HSL (required)

3. Calculate purple HSL values:
   ├─→ --primary: 270 50% 50% (purple)
   ├─→ --primary-foreground: 0 0% 100% (white)
   └─→ Adjust all related tokens

4. alive-line-replace(src/index.css, old-primary-tokens, new-purple-tokens)
```

### Sequence 3: Dark Mode Implementation
Request: "Add dark mode"

```
1. alive-view(src/index.css) IF not in context

2. Check: Dark mode exists?
   ├─→ EXISTS: Inform user
   └─→ NOT EXISTS: Add it

3. alive-line-replace(src/index.css, insert-dark-theme)

4. Create theme toggle:
   ├─→ alive-add-dependency("next-themes@latest")
   └─→ alive-write(src/components/ThemeToggle.tsx) ||
       alive-line-replace(src/App.tsx, add-theme-provider)
```

### Sequence 4: Component Redesign
Request: "Make the hero section more modern"

```
1. project_debug--sandbox-screenshot("/")
2. alive-search-files("Hero|hero", "src/**")
3. alive-view(src/components/Hero.tsx) IF not in context
4. Analyze current design:
   ├─→ Check if using design tokens
   └─→ Identify improvement areas
5. alive-line-replace(src/components/Hero.tsx, old-design, modern-design)
   ├─→ Ensure: Uses --gradient-primary, --shadow-lg, etc.
   └─→ Not: Direct colors like bg-blue-500
```

### Sequence 5: Design System Refactoring
Request: "The colors are inconsistent"

```
1. alive-view(src/index.css)
2. alive-search-files("bg-|text-|border-", "src/**")
3. Identify: Components using direct colors
4. REFACTOR PROCESS:
   Step 1: Update design system
   └─→ alive-line-replace(src/index.css, add-missing-tokens)
   
   Step 2: Update components (parallel)
   └─→ alive-line-replace(component1, direct-colors, tokens) ||
       alive-line-replace(component2, direct-colors, tokens) ||
       alive-line-replace(component3, direct-colors, tokens)
```

### Sequence 6: Responsive Design Fix
Request: "It looks broken on mobile"

```
1. project_debug--sandbox-screenshot("/")
2. User describes issue or screenshot shows problem
3. alive-search-files(component-from-screenshot, "src/**")
4. alive-view(problem-component) IF not in context
5. Identify: Missing responsive classes
6. alive-line-replace(component, add-responsive-classes)
   Example: "w-full" → "w-full md:w-1/2 lg:w-1/3"
```

### Sequence 7: Animation Addition
Request: "Add smooth transitions"

```
1. alive-view(src/index.css)
2. Check: Transition utilities exist?
3. alive-line-replace(src/index.css, add-transition-utilities)
   Example: --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
4. alive-search-files(interactive-components, "src/**")
5. alive-line-replace(components, add-transition-classes)
```

### Sequence 8: Typography Update
Request: "Change the font to Inter"

```
1. alive-view(tailwind.config.ts)
2. Check: Font already defined?
3. alive-line-replace(tailwind.config.ts, update-font-family)
4. Add font import:
   └─→ alive-line-replace(src/index.css, add-google-fonts-import)
```

### Sequence 9: Component Variant Creation
Request: "I need a secondary button style"

```
1. alive-view(src/components/ui/button.tsx)
2. Analyze existing variants
3. alive-line-replace(src/components/ui/button.tsx, add-secondary-variant)
   Ensure: Uses design tokens like bg-secondary, text-secondary-foreground
4. Verify: Design system has secondary tokens in index.css
```

### Sequence 10: Comprehensive Redesign
Request: "Redesign the entire app to look more professional"

```
1. project_debug--sandbox-screenshot("/")
2. PHASE 1 - Design System:
   3. alive-view(src/index.css)
   4. alive-line-replace(src/index.css, comprehensive-design-tokens)
      ├─→ Professional color palette (HSL)
      ├─→ Elevation system (shadows)
      ├─→ Spacing system
      └─→ Typography scale

3. PHASE 2 - Global Styles:
   5. alive-view(tailwind.config.ts)
   6. alive-line-replace(tailwind.config.ts, professional-config)

4. PHASE 3 - Components (parallel):
   7. alive-search-files("components", "src/components/**")
   8. Identify key visual components
   9. alive-line-replace(component1, professional-redesign) ||
      alive-line-replace(component2, professional-redesign) ||
      alive-line-replace(component3, professional-redesign)
```

## Critical Rules

1. **Always use HSL colors** - Required for design tokens
2. **Never use direct colors in components** - Use semantic tokens
3. **Design system first** - Update index.css before components
4. **Educate about Visual Edits** - For simple static changes
5. **Screenshots for context** - See current state before redesigning
6. **Parallel component updates** - When changing multiple files
7. **Check context first** - Don't read files already shown
8. **Responsive by default** - Always add mobile-first responsive classes

## Common Mistakes

❌ Using direct colors (text-white) instead of tokens (text-primary)
❌ Using RGB/hex instead of HSL
❌ Not updating design system when adding new colors
❌ Sequential component updates when parallel possible
❌ Not informing about Visual Edits for simple changes
❌ Modifying components before checking design system
❌ Forgetting responsive classes
❌ Not checking if change already exists in useful-context
❌ Reading files that are already in useful-context

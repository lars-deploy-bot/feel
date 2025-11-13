/**
 * Default User Prompts
 *
 * Pre-configured prompts for common code review tasks
 */

const REVISE_PROMPT_FULL = `Perform a comprehensive code review and answer these questions:

**Code Quality & Best Practices:**
- Are there any code smells or anti-patterns?
- Is the code following DRY (Don't Repeat Yourself) principles?
- Are functions and components properly decomposed (single responsibility)?
- Is the code readable and maintainable?
- Are there any overly complex functions that should be simplified?
- Is error handling implemented consistently and properly?

**Potential Bugs & Edge Cases:**
- Are there any logical errors or off-by-one errors?
- Are null/undefined values handled properly?
- Are there any potential race conditions or timing issues?
- Are array/object operations safe (checking length/existence)?
- Are there any unhandled promise rejections or async errors?
- Are type assertions/casts safe, or could they cause runtime errors?

**Security Vulnerabilities:**
- Are there any XSS (Cross-Site Scripting) vulnerabilities?
- Is user input properly sanitized and validated?
- Are sensitive data (API keys, passwords) properly handled?
- Are there any path traversal vulnerabilities in file operations?
- Is authentication/authorization implemented correctly?

**Performance Issues:**
- Are there any unnecessary re-renders (React)?
- Are expensive computations memoized when needed?
- Are there any memory leaks (event listeners not cleaned up)?
- Are there inefficient loops or algorithms?
- Are large data structures handled efficiently?
- Are there any blocking operations that should be async?

**TypeScript/Type Safety:**
- Are there any \`any\` types that should be properly typed?
- Are type definitions accurate and complete?
- Are there missing null checks where types allow null/undefined?
- Are discriminated unions used correctly?
- Are generic types properly constrained?
- Are there any type casting that bypass safety?

**React/Frontend Specific:**
- Are hooks used correctly (dependencies, rules of hooks)?
- Are components properly memoized when needed?
- Is state management appropriate (local vs global)?
- Are side effects properly handled in useEffect?
- Are refs used correctly?
- Is accessibility (a11y) considered?

**API/Backend Specific:**
- Are API responses properly validated?
- Are HTTP status codes used correctly?
- Is request/response data properly typed?

**Testing & Reliability:**
- Are there critical paths without tests?
- Are edge cases covered in tests?
- Are error scenarios tested?
- Are mocks/stubs used appropriately?
- Is the code testable (proper dependency injection)?

**Dependencies & Imports:**
- Are all imported dependencies actually used?
- Are there any deprecated dependencies or APIs?
- Are dependency versions compatible?
- Are there any circular dependencies?
- Should any dependencies be updated or replaced?

**Documentation & Comments:**
- Is complex logic properly commented?
- Are function/component purposes clear?
- Are there any misleading or outdated comments?
- Is documentation accurate and helpful?

Please analyze the code thoroughly and provide specific issues found with file paths and line numbers where applicable.`

const ORGANIZE_PROMPT_FULL = `Review the code organization thoroughly and answer these questions:

**File Structure & Placement:**
- Are all files in the correct directories according to their purpose?
- Did you put components in the right place (are UI components separated from business logic)?
- Are utility functions properly organized in dedicated utility folders?
- Are there any misplaced files that should be moved?
- Are test files colocated with their source files or in appropriate test directories?

**Lost & Orphaned Files:**
- Are there any unused/dead files that should be removed?
- Are there any duplicate files or redundant code?
- Are there any temporary files (e.g., .bak, .tmp, .old) that were left behind?
- Are there any commented-out imports or references to files that no longer exist?

**Vite Workspace Specifics:**
- Are workspace packages properly structured (packages/, apps/, libs/)?
- Is each package/app using the correct directory structure (src/, dist/, public/)?
- Are shared dependencies extracted to proper locations?
- Are barrel exports (index.ts) used appropriately for cleaner imports?
- Are build outputs and config files (.vite/, vite.config.ts) in the right places?

**Import Organization:**
- Are imports grouped logically (external, internal, relative)?
- Are there any circular dependencies?
- Are path aliases (e.g., @/, ~/) configured correctly and used consistently?
- Are there unused imports that should be removed?

**Configuration Files:**
- Are all config files (tsconfig.json, vite.config.ts, package.json) in the correct locations?
- Are workspace-level configs separated from package-level configs?
- Is the tsconfig properly extending workspace configs?

**Naming Conventions:**
- Do file and folder names follow a consistent convention (kebab-case, camelCase, PascalCase)?
- Are component files named consistently (e.g., ComponentName.tsx)?
- Are utility files named descriptively?

**Code Grouping:**
- Are related components/features grouped together?
- Should any code be extracted into separate modules or packages?
- Are types/interfaces defined near their usage or in dedicated type files?

Please analyze the codebase and provide specific recommendations for improvements.`

// Export prompt objects with both full prompt (for Claude SDK) and user-facing description (for UI)
export const REVISE_PROMPT_DEFAULT = {
  data: REVISE_PROMPT_FULL,
  userFacingDescription:
    "Comprehensive code review covering quality, bugs, security, performance, TypeScript safety, React patterns, testing, and documentation.",
}

export const ORGANIZE_PROMPT_DEFAULT = {
  data: ORGANIZE_PROMPT_FULL,
  userFacingDescription:
    "Review code organization including file structure, lost files, Vite workspace structure, imports, config files, naming conventions, and code grouping.",
}

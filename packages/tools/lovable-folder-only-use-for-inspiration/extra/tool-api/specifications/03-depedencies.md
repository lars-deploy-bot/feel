# Dependency Management Tools

2 tools for managing npm packages. **CRITICAL:** Only way to modify package.json.

---

## `lov-add-dependency`

Install or upgrade npm package. **ONLY** way to add dependencies.

**Signature:**
```typescript
lov-add-dependency(package: string): void
```

**Parameters:**
- `package` (required): npm package name with optional version
  - Format: `"package-name"` or `"package-name@version"`
  - Examples: `"lodash@latest"`, `"react-hook-form"`, `"@radix-ui/react-dialog@^1.0.0"`

**Returns:** Success message after installation

**Usage:**
```typescript
// Install latest version
lov-add-dependency("lodash")

// Install specific version
lov-add-dependency("react-router-dom@6.20.0")

// Install latest tag
lov-add-dependency("next@latest")

// Install scoped package
lov-add-dependency("@tanstack/react-query")

// Upgrade existing package
lov-add-dependency("typescript@latest")
```

**Common Packages:**
```typescript
// Form handling
lov-add-dependency("react-hook-form")
lov-add-dependency("zod")

// State management
lov-add-dependency("zustand")
lov-add-dependency("@tanstack/react-query")

// UI libraries
lov-add-dependency("framer-motion")
lov-add-dependency("lucide-react")

// Utilities
lov-add-dependency("date-fns")
lov-add-dependency("lodash")
lov-add-dependency("clsx")

// API clients
lov-add-dependency("axios")
lov-add-dependency("ky")
```

**Critical Rules:**
- ❌ **NEVER** directly edit package.json - ALWAYS use this tool
- ✅ Installing same package upgrades to specified version
- ✅ Version tags: `@latest`, `@next`, `@canary`, or specific `@1.2.3`
- ✅ Omit version to install latest stable
- ⚠️ Installation takes 10-30 seconds
- ✅ Can install multiple packages in parallel calls

---

## `lov-remove-dependency`

Uninstall npm package. **ONLY** way to remove dependencies.

**Signature:**
```typescript
lov-remove-dependency(package: string): void
```

**Parameters:**
- `package` (required): npm package name (no version)
  - Examples: `"lodash"`, `"@radix-ui/react-dialog"`

**Returns:** Success message after removal

**Usage:**
```typescript
// Remove package
lov-remove-dependency("lodash")

// Remove scoped package
lov-remove-dependency("@radix-ui/react-dialog")

// Remove unused dependency
lov-remove-dependency("moment")
```

**Critical Rules:**
- ❌ **NEVER** directly edit package.json - ALWAYS use this tool
- ✅ Only specify package name (no version)
- ⚠️ Does not check if package is still used in code
- ✅ Remove unused imports from code before uninstalling
- ✅ Search codebase first to verify package isn't used: `lov-search-files("from ['\"]lodash", "src/**")`

---

## Workflows

**Adding new dependency:**
```typescript
// 1. Add package
lov-add-dependency("react-hook-form")

// 2. Use in code immediately (imports will resolve after installation)
```

**Replacing dependency:**
```typescript
// 1. Add new package
lov-add-dependency("date-fns")

// 2. Update code to use new package

// 3. Verify old package not used
lov-search-files("from ['\"]moment", "src/**")

// 4. Remove old package
lov-remove-dependency("moment")
```

**Upgrading package:**
```typescript
// Just install newer version
lov-add-dependency("react-router-dom@latest")
```

**Parallel installation:**
```typescript
// Install multiple packages simultaneously (much faster)
[
  lov-add-dependency("react-hook-form"),
  lov-add-dependency("zod"),
  lov-add-dependency("@hookform/resolvers")
]
```

---

## Read-Only Files

**CRITICAL:** These files CANNOT be modified directly. Use tools instead:

**Cannot modify:**
- `package.json` - Use `lov-add-dependency` / `lov-remove-dependency`
- `package-lock.json` - Auto-managed by npm
- `bun.lockb` - Auto-managed by bun
- `tsconfig.json` - Pre-configured, do not modify
- `tsconfig.app.json` - Pre-configured, do not modify
- `tsconfig.node.json` - Pre-configured, do not modify
- `.gitignore` - Pre-configured, do not modify
- `components.json` - Shadcn config, do not modify
- `postcss.config.js` - Build config, do not modify

**Can modify:**
- `tailwind.config.ts` - Customize design system
- `vite.config.ts` - Add Vite plugins/config
- All source code in `src/`
- All edge functions in `supabase/functions/`

---

## Common Scenarios

**Form validation:**
```typescript
lov-add-dependency("react-hook-form")
lov-add-dependency("zod")
lov-add-dependency("@hookform/resolvers")
```

**API handling:**
```typescript
lov-add-dependency("@tanstack/react-query")
lov-add-dependency("axios")
```

**Animations:**
```typescript
lov-add-dependency("framer-motion")
```

**Date handling:**
```typescript
// Modern approach
lov-add-dependency("date-fns")

// Or temporal API polyfill
lov-add-dependency("@js-temporal/polyfill")
```

**State management:**
```typescript
// Simple global state
lov-add-dependency("zustand")

// Server state
lov-add-dependency("@tanstack/react-query")
```

**Icons:**
```typescript
// Already installed in most Lovable projects
// lucide-react

// If needed:
lov-add-dependency("lucide-react")
```

---

## Troubleshooting

**Installation fails:**
- Check package name spelling
- Verify package exists on npm: `websearch--web_search("npm [package-name]")`
- Try without version specifier first

**Package conflicts:**
- Check peer dependencies in error message
- Install compatible versions
- Use `@latest` to get newest compatible version

**TypeScript errors after install:**
- Install type definitions: `lov-add-dependency("@types/package-name")`
- Some packages include types, others need separate `@types/` package

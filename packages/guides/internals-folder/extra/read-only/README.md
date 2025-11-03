# Read-Only Files

## What Are Read-Only Files?

These are system-managed configuration files that the Alive AI agent **cannot directly modify**. Instead, the AI uses specialized tools to make changes:

- `package.json` → Modified via `alive-add-dependency()` / `alive-remove-dependency()`
- Other config files → Generally not modified by AI

## Complete List of Read-Only Files

```
.gitignore              → Git ignore patterns (system-managed)
package.json            → Dependencies (use alive-add-dependency tool)
package-lock.json       → Lock file (auto-generated)
bun.lockb              → Bun lock file (auto-generated)
tsconfig.json          → TypeScript config (pre-configured)
tsconfig.app.json      → TypeScript app config
tsconfig.node.json     → TypeScript node config
tailwind.config.js     → Tailwind config (pre-configured)
postcss.config.js      → PostCSS config (pre-configured)
components.json        → Shadcn components config
public/favicon.ico     → Favicon (system-provided)
public/placeholder.svg → Placeholder image (system-provided)
```

## Why Are They Read-Only?

1. **System Integrity**: These files control build and runtime behavior
2. **Version Control**: Alive manages these files across project versions
3. **Consistency**: Ensures all projects follow the same patterns
4. **Tool-Based Modification**: Changes through tools ensure validation

## How the AI Modifies Them

### Example: Adding a Dependency

```typescript
// ❌ CANNOT DO THIS
alive-write("package.json", updatedContent)

// ✅ CORRECT APPROACH
alive-add-dependency("lodash@latest")
```

The tool:
1. Validates the package exists
2. Checks for conflicts
3. Updates package.json safely
4. Runs npm/bun install
5. Updates lock file

### Example: TypeScript Config

```typescript
// ❌ CANNOT MODIFY
alive-write("tsconfig.json", newConfig)

// ✅ PRE-CONFIGURED
// TypeScript config is set up optimally
// If changes needed, contact Alive support
```

## Writable Alternatives

If you need custom configuration:

| Read-Only File | Writable Alternative |
|---------------|---------------------|
| `tailwind.config.js` | Can modify with care via alive-line-replace |
| `tsconfig.json` | Pre-configured, rarely needs changes |
| `components.json` | Managed by Shadcn, use their CLI |

## Examples in This Folder

```
read-only/
├── README.md (this file)
└── examples/
    ├── package.json.example       → Shows structure
    ├── tsconfig.json.example      → Shows structure
    └── tailwind.config.js.example → Shows structure
```

## Common Questions

**Q: Why can't AI edit package.json directly?**  
A: To prevent dependency conflicts, version issues, and broken builds. The tool validates everything first.

**Q: Can I manually edit these files?**  
A: Yes, in Dev Mode with code editing enabled. But AI uses tools instead.

**Q: What if I need a config change?**  
A: Ask the AI. It may:
- Use a tool to modify it safely
- Guide you to manually edit it
- Explain why the change isn't recommended

**Q: Are all config files read-only?**  
A: No. Files like `index.css`, `vite.config.ts`, `tailwind.config.ts` CAN be modified by AI when needed.

## See Also

- **Tool API**: See `.Alive-internals/tool-api/` for all tools
- **Writable Files**: Everything else in your project
- **Virtual FS**: See `.Alive-internals/virtual-fs/` for temporary files

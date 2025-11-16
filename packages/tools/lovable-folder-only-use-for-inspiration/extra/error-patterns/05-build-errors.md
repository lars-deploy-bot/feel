# Build & TypeScript Error Patterns

## Complete Guide to Compilation Issues

Build errors prevent your app from running. This guide covers Vite and TypeScript errors.

---

## Error 1: "Cannot find module" or "Module not found"

### Error Message
```
ERROR: Cannot find module '@/components/Button' or its corresponding type declarations
```

### Causes & Solutions

**Cause 1: File doesn't exist**
```typescript
// ❌ Wrong - File path doesn't match actual location
import { Button } from '@/components/Button';
// But file is at: src/components/ui/button.tsx

// ✅ Correct - Use actual path
import { Button } from '@/components/ui/button';
```

**Cause 2: Path alias not configured**
```json
// tsconfig.json - Verify this exists
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// vite.config.ts - Verify this exists
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Cause 3: Missing file extension**
```typescript
// ❌ Wrong - Missing extension
import utils from '@/lib/utils';
// But file is: src/lib/utils.ts

// ✅ Correct options:
import utils from '@/lib/utils.ts'; // Explicit extension
// Or if configured, no extension needed
import utils from '@/lib/utils'; // Works if tsconfig allows
```

---

## Error 2: "Type 'X' is not assignable to type 'Y'"

### Error Message
```
Type 'string' is not assignable to type 'number'
```

### Causes & Solutions

**Cause 1: Wrong type annotation**
```typescript
// ❌ Wrong
const age: number = "25"; // String assigned to number

// ✅ Correct
const age: number = 25;
// Or
const age: string = "25";
```

**Cause 2: Missing type guard**
```typescript
// ❌ Wrong - value might be undefined
function greet(name?: string) {
  return `Hello ${name.toUpperCase()}`; // Error: name might be undefined
}

// ✅ Correct - Add type guard
function greet(name?: string) {
  if (!name) return 'Hello stranger';
  return `Hello ${name.toUpperCase()}`;
}

// ✅ Or use optional chaining
function greet(name?: string) {
  return `Hello ${name?.toUpperCase() ?? 'stranger'}`;
}
```

**Cause 3: Interface mismatch**
```typescript
// ❌ Wrong - Missing required properties
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = {
  id: '123',
  name: 'John'
  // Missing email!
};

// ✅ Correct - Include all required properties
const user: User = {
  id: '123',
  name: 'John',
  email: 'john@example.com'
};

// ✅ Or make property optional
interface User {
  id: string;
  name: string;
  email?: string; // Optional
}
```

---

## Error 3: "JSX element implicitly has type 'any'"

### Error Message
```
JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists
```

### Cause
Missing React types.

### Solution
```typescript
// Verify React types are imported
// At top of file:
import React from 'react';

// Or if using new JSX transform:
// In tsconfig.json:
{
  "compilerOptions": {
    "jsx": "react-jsx" // Instead of "react"
  }
}

// Then no React import needed
```

---

## Error 4: "Property 'X' does not exist on type 'Y'"

### Error Message
```
Property 'user' does not exist on type '{}'
```

### Cause
Type inference failing or wrong type.

### Solution
```typescript
// ❌ Wrong - Empty object type
const data: {} = { user: 'John' }; // Error: Property 'user' doesn't exist

// ✅ Correct - Proper interface
interface Data {
  user: string;
}
const data: Data = { user: 'John' };

// ✅ Or use type assertion (less safe)
const data = { user: 'John' } as { user: string };

// ✅ Or let TypeScript infer
const data = { user: 'John' }; // Type inferred as { user: string }
```

---

## Error 5: "Cannot use import statement outside a module"

### Error Message
```
SyntaxError: Cannot use import statement outside a module
```

### Cause
File not treated as module.

### Solution
```json
// package.json - Add this:
{
  "type": "module"
}

// Or in tsconfig.json:
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

---

## Error 6: "Vite Error: Failed to resolve import"

### Error Message
```
Failed to resolve import "@/components/ui/button" from "src/App.tsx"
```

### Causes & Solutions

**Cause 1: Alias not configured in Vite**
```typescript
// vite.config.ts
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Cause 2: File outside allowed directory**
```typescript
// vite.config.ts - Allow parent directories if needed
export default defineConfig({
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
```

---

## Error 7: "The requested module does not provide an export named 'X'"

### Error Message
```
The requested module '/src/utils.ts' does not provide an export named 'default'
```

### Causes & Solutions

**Cause 1: Export/Import mismatch**
```typescript
// utils.ts
// ❌ Wrong - Named export, but imported as default
export const helper = () => {};

// App.tsx
import helper from './utils'; // Expects default export

// ✅ Correct option 1 - Change import
import { helper } from './utils'; // Named import

// ✅ Correct option 2 - Change export
export default helper; // Default export
```

**Cause 2: Re-export issue**
```typescript
// utils/index.ts
// ❌ Wrong
export { default as helper } from './helper';
// But helper.ts uses: export const helper = ...

// ✅ Correct
export { helper } from './helper';
```

---

## Error 8: "'React' refers to a UMD global, but current file is a module"

### Error Message
```
'React' refers to a UMD global, but the current file is a module
```

### Cause
React import style mismatch.

### Solution
```typescript
// ❌ Old style
import * as React from 'react';

// ✅ Correct modern style
import React from 'react';

// ✅ Or use new JSX transform (no React import needed)
// tsconfig.json:
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

---

## Error 9: "Top-level await is not available"

### Error Message
```
Top-level await is not available in the configured target environment
```

### Cause
Target environment doesn't support top-level await.

### Solution
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022", // Or higher
    "module": "ES2022"
  }
}

// Or wrap in async function
(async () => {
  const data = await fetchData();
})();
```

---

## Error 10: "Unsafe assignment of any value"

### Error Message
```
Unsafe assignment of an any value
```

### Cause
Strict TypeScript checking.

### Solution
```typescript
// ❌ Wrong - Using 'any'
const data: any = await fetchData();
const value = data.property; // Unsafe

// ✅ Correct - Proper types
interface ApiResponse {
  property: string;
}

const data: ApiResponse = await fetchData();
const value = data.property; // Safe

// ✅ Or use type assertion (when you know the type)
const data = await fetchData() as ApiResponse;
```

---

## Build Optimization Tips

### 1. Fast Refresh Issues
```typescript
// If hot reload not working:
// Ensure exports are named, not anonymous

// ❌ Wrong
export default () => <div>Hello</div>;

// ✅ Correct
export default function Component() {
  return <div>Hello</div>;
}
```

### 2. Circular Dependencies
```
// If build is slow or fails:
// Check for circular imports

// A.ts imports B.ts
// B.ts imports A.ts
// = Circular dependency!

// Solution: Extract shared code to separate file
```

### 3. Large Bundle Size
```typescript
// Use code splitting
const Component = lazy(() => import('./Component'));

// Use tree-shaking friendly imports
import { Button } from '@/components/ui/button'; // Good
import * as UI from '@/components/ui'; // Bad (imports everything)
```

---

## TypeScript Configuration Best Practices

```json
// tsconfig.json - Recommended settings
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Quick Build Error Fixes

| Error Contains | Quick Fix |
|----------------|-----------|
| "Cannot find module" | Check file path, verify imports |
| "not assignable" | Check types match, add type guards |
| "implicitly has type any" | Add explicit type annotation |
| "does not exist on type" | Check interface/type definition |
| "outside a module" | Add `"type": "module"` to package.json |
| "Failed to resolve" | Check vite.config.ts alias |
| "does not provide export" | Match export style (default vs named) |
| "UMD global" | Use modern import syntax |
| "Top-level await" | Update tsconfig target |
| "Unsafe assignment" | Add proper types |

---

## Emergency: Build Completely Broken

If build is completely broken and nothing works:

1. **Restart dev server**
   ```bash
   # Stop server (Ctrl+C)
   # Start again
   npm run dev
   ```

2. **Clear Vite cache**
   ```bash
   rm -rf node_modules/.vite
   ```

3. **Reinstall dependencies** (if using local setup)
   ```bash
   rm -rf node_modules
   npm install
   ```

4. **Check for syntax errors**
   - Missing brackets, quotes, semicolons
   - Unclosed JSX tags
   - Invalid JSON

5. **Revert recent changes**
   - Undo last edits
   - Check what was working before

6. **Check tsconfig and vite.config**
   - Verify they haven't been corrupted
   - Compare with working examples

Remember: Most build errors are TypeScript type mismatches or import/export issues. Read the error message carefully - it usually points to the exact problem location.

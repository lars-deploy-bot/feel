# Common Error Patterns & Solutions

## Quick Reference Database

This document catalogs the most frequent errors in Lovable projects with instant solutions.

---

## 1. Import Errors

### Error: `Module not found: Can't resolve '@/components/...'`

**Cause:** Missing file or incorrect import path

**Solution:**
```typescript
// ❌ Wrong
import { Button } from '@/components/Button';

// ✅ Correct - check actual file location
import { Button } from '@/components/ui/button';
```

**Debug Steps:**
1. Use `lov-search-files` to find the actual component location
2. Verify file exists in project structure
3. Check if it's a default or named export

---

### Error: `Attempted import error: 'X' is not exported from '...'`

**Cause:** Incorrect export/import syntax mismatch

**Solution:**
```typescript
// File: src/utils/helpers.ts
// ❌ Wrong
export function formatDate() { }
// Imported as: import formatDate from './helpers'

// ✅ Correct option 1: Named export
export function formatDate() { }
// Import as: import { formatDate } from './helpers'

// ✅ Correct option 2: Default export
export default function formatDate() { }
// Import as: import formatDate from './helpers'
```

---

## 2. React Hook Errors

### Error: `React Hook "useX" is called conditionally`

**Cause:** Hooks called inside conditions, loops, or after early returns

**Solution:**
```typescript
// ❌ Wrong
function Component({ user }) {
  if (!user) return null;
  const [state, setState] = useState(null); // Hook after return!
}

// ✅ Correct
function Component({ user }) {
  const [state, setState] = useState(null); // Hook at top level
  if (!user) return null;
}
```

---

### Error: `Too many re-renders. React limits the number of renders`

**Cause:** State update in render causing infinite loop

**Solution:**
```typescript
// ❌ Wrong - setState in render
function Component() {
  const [count, setCount] = useState(0);
  setCount(count + 1); // Infinite loop!
  return <div>{count}</div>;
}

// ✅ Correct - setState in effect or event handler
function Component() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    setCount(count + 1);
  }, []); // Or in onClick={() => setCount(count + 1)}
  
  return <div>{count}</div>;
}
```

---

### Error: `Can't perform a React state update on an unmounted component`

**Cause:** Async operation completing after component unmounts

**Solution:**
```typescript
// ❌ Wrong
useEffect(() => {
  fetchData().then(data => setState(data)); // May run after unmount
}, []);

// ✅ Correct - cleanup with abort flag
useEffect(() => {
  let isMounted = true;
  
  fetchData().then(data => {
    if (isMounted) {
      setState(data);
    }
  });
  
  return () => {
    isMounted = false;
  };
}, []);
```

---

## 3. TypeScript Errors

### Error: `Property 'X' does not exist on type 'Y'`

**Cause:** Type mismatch or missing property

**Solution:**
```typescript
// ❌ Wrong
interface User {
  name: string;
}
const user: User = { name: 'John', email: 'john@example.com' }; // email not in type

// ✅ Correct
interface User {
  name: string;
  email: string;
}
const user: User = { name: 'John', email: 'john@example.com' };
```

---

### Error: `Argument of type 'X' is not assignable to parameter of type 'Y'`

**Cause:** Wrong type passed to function

**Solution:**
```typescript
// ❌ Wrong
function greet(name: string) { }
greet(123); // number is not string

// ✅ Correct
greet('John');
// Or fix the function signature if needed
function greet(name: string | number) { }
```

---

## 4. Vite/Build Errors

### Error: `Failed to resolve import "X" from "Y"`

**Cause:** Import path doesn't match Vite's resolution

**Solution:**
```typescript
// ❌ Wrong - relative path issues
import utils from '../../utils';

// ✅ Correct - use path alias
import utils from '@/lib/utils';

// Verify tsconfig.json has:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

### Error: `The request url "X" is outside of Vite serving allow list`

**Cause:** Vite trying to serve files outside project root

**Solution:**
```typescript
// ❌ Wrong - importing from outside project
import config from '../../../config.json';

// ✅ Correct - move file inside project or configure Vite
// vite.config.ts
export default {
  server: {
    fs: {
      allow: ['..'] // Allow parent directory
    }
  }
}
```

---

## 5. Tailwind CSS Issues

### Error: Classes not applying / not working

**Cause:** Dynamic class names or purge configuration

**Solution:**
```typescript
// ❌ Wrong - dynamic classes are purged
const colorClass = `text-${color}-500`; // Won't work!

// ✅ Correct - use complete class names
const colorClasses = {
  red: 'text-red-500',
  blue: 'text-blue-500'
};
const colorClass = colorClasses[color];
```

---

## 6. Router Errors

### Error: `useNavigate() may be used only in context of <Router>`

**Cause:** Using React Router hooks outside Router component

**Solution:**
```typescript
// ❌ Wrong - Router not wrapping component
function App() {
  return <Component />; // Component uses useNavigate()
}

// ✅ Correct
function App() {
  return (
    <BrowserRouter>
      <Component />
    </BrowserRouter>
  );
}
```

---

## 7. API/Network Errors

### Error: `CORS policy: No 'Access-Control-Allow-Origin' header`

**Cause:** Backend not configured for CORS

**Solution:**
```typescript
// Edge function fix (supabase/functions/*/index.ts)
export default async (req: Request) => {
  // Add CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  const data = await doWork();
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
```

---

### Error: `Failed to fetch` / Network request failed

**Cause:** Wrong URL, network issue, or CORS

**Debug Steps:**
1. Check browser Network tab
2. Verify URL is correct
3. Test with curl or Postman
4. Check edge function logs
5. Verify CORS headers

---

## 8. Form/Input Errors

### Error: `A component is changing an uncontrolled input to be controlled`

**Cause:** Initial value is undefined, then becomes a string

**Solution:**
```typescript
// ❌ Wrong
const [value, setValue] = useState(); // undefined initially
<input value={value} onChange={e => setValue(e.target.value)} />

// ✅ Correct
const [value, setValue] = useState(''); // Empty string initially
<input value={value} onChange={e => setValue(e.target.value)} />
```

---

## 9. Environment/Build Issues

### Error: `process is not defined`

**Cause:** Using Node.js globals in browser code

**Solution:**
```typescript
// ❌ Wrong
const apiKey = process.env.VITE_API_KEY;

// ✅ Correct
const apiKey = import.meta.env.VITE_API_KEY;
```

---

## Quick Debugging Checklist

When encountering any error:

1. **Read the error message carefully** - it usually tells you exactly what's wrong
2. **Check the file and line number** - go directly to where the error occurs
3. **Use lov-read-console-logs** - see full stack trace
4. **Use lov-search-files** - find where components/functions are defined
5. **Check imports** - verify paths and export/import syntax match
6. **Review recent changes** - what was modified that broke things?
7. **Test in isolation** - can you reproduce in a simpler component?
8. **Check Network tab** - for API/fetch errors
9. **Verify types** - TypeScript errors often indicate logic issues
10. **Read documentation** - when in doubt, check official docs

---

## Pattern Matching for Fast Resolution

| Error Contains | Likely Cause | First Action |
|----------------|--------------|--------------|
| "Module not found" | Import path wrong | Search for actual file location |
| "is not a function" | Wrong import/export | Check export syntax in source |
| "Hook" | React rules violated | Move hook to top level |
| "Type" / "assignable" | TypeScript mismatch | Check interface definitions |
| "CORS" | Backend headers | Add CORS to edge function |
| "undefined" | Missing null check | Add optional chaining `?.` |
| "Cannot read property" | Accessing null/undefined | Add guards `if (x)` |
| "Too many re-renders" | setState in render | Move to useEffect/handler |
| "404" | Wrong URL or route | Verify endpoint exists |
| "401" / "403" | Auth issue | Check RLS policies/auth state |

---

## Emergency Recovery Steps

If completely stuck:

1. **Revert recent changes** - use git or manual undo
2. **Check similar working code** - find a pattern that works
3. **Simplify** - remove complexity until it works, then add back
4. **Search project** - maybe this was solved before
5. **Test edge function directly** - use curl/Postman to isolate issue
6. **Check Supabase logs** - database errors show there
7. **Clear cache** - sometimes Vite cache causes issues (restart dev server)
8. **Check dependencies** - is package installed? Correct version?

Remember: Most errors have simple causes. Read carefully, check the basics, and follow the error message's guidance.

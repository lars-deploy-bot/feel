# shadcn/ui Toast Hook Import Update

## Important Location Change

Recent versions of shadcn/ui have reorganized the file structure for the toast functionality.

## Updated Import Path

### Current Correct Import
```typescript
import { useToast, toast } from "@/hooks/use-toast";
```

### Previous Location (Deprecated)
```typescript
// ❌ Old location - no longer valid
import { useToast } from "@/components/ui/use-toast";
```

## Migration Steps

### 1. Locate Existing Imports
Search your codebase for:
```typescript
from "@/components/ui/use-toast"
```

### 2. Update Import Statements
Replace with:
```typescript
from "@/hooks/use-toast"
```

### 3. Verify File Structure
Ensure `use-toast.ts` exists in `src/hooks/` directory.

## Usage Example

```typescript
import { useToast } from "@/hooks/use-toast";

function MyComponent() {
  const { toast } = useToast();

  const showNotification = () => {
    toast({
      title: "Success",
      description: "Operation completed successfully",
    });
  };

  return <button onClick={showNotification}>Show Toast</button>;
}
```

## Why This Change?

The relocation reflects better architectural separation:
- **Hooks** belong in `/hooks` directory
- **UI Components** remain in `/components/ui`
- Clearer project organization
- Better scalability

## Compatibility Note

If you encounter import errors when using shadcn/ui toast functionality, first check that your imports reference the correct location (`@/hooks/use-toast`).

---

**Remember**: Always use the hooks directory for toast imports in modern shadcn/ui implementations.

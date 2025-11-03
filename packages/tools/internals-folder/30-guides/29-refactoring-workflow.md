# Code Refactoring Workflow

## Overview

Refactoring improves code structure without changing functionality. This guide establishes a systematic approach to refactoring in Alive projects, ensuring maintainability and preventing regressions.

## When to Refactor

### Trigger Conditions

**Immediate refactoring required**:
- Code duplication exceeds 3 occurrences
- Single file exceeds 300 lines
- Single function exceeds 50 lines
- Component has more than 5 useState hooks
- Deeply nested conditionals (> 3 levels)
- User explicitly requests refactoring

**Opportunistic refactoring**:
- Adding new feature to messy code
- Bug discovered in poorly structured code
- Performance optimization needed
- Improving test coverage

**Do NOT refactor when**:
- Under tight deadline
- No tests exist and behavior is unclear
- User wants only cosmetic changes
- Working code that rarely changes

## Pre-Refactoring Checklist

Before starting any refactoring:

- [ ] **Document current behavior**: Know exactly what the code does
- [ ] **Identify all affected files**: List every file that will change
- [ ] **Check for tests**: Note existing test coverage
- [ ] **Plan new structure**: Design target architecture
- [ ] **Create task list**: Break refactoring into steps
- [ ] **Inform user**: Explain what you'll refactor and why

## Refactoring Workflow

### Step 1: Analysis and Planning

```typescript
// Document current behavior
/**
 * Current Implementation Analysis:
 * - UserProfile.tsx: 450 lines, handles auth, profile edit, settings
 * - Issues: Mixed concerns, hard to test, duplicated validation
 * - Goal: Extract into separate components with single responsibilities
 */

// Plan new structure
/**
 * Target Architecture:
 * 1. UserProfile.tsx (150 lines) - Main composition
 * 2. ProfileEditor.tsx (100 lines) - Edit functionality
 * 3. UserSettings.tsx (120 lines) - Settings management
 * 4. hooks/useUserProfile.ts (80 lines) - Shared logic
 * 5. utils/profileValidation.ts (50 lines) - Validation
 */
```

### Step 2: Create New Structure

Always create new files BEFORE modifying existing ones:

```typescript
// Create files in logical order
1. Create utility functions (pure, no dependencies)
2. Create custom hooks (use utilities)
3. Create new components (use hooks and utilities)
4. Update existing components to use new structure
5. Delete old code paths
```

**Example**:

```bash
# Creation order
guidance/
  utils/
    profileValidation.ts    # 1. Pure functions first
  hooks/
    useUserProfile.ts       # 2. Hooks next
  components/
    ProfileEditor.tsx       # 3. New components
    UserSettings.tsx
  pages/
    UserProfile.tsx         # 4. Update existing
```

### Step 3: Extract Utilities

```typescript
// BEFORE - Mixed in component
function UserProfile() {
  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  }
  
  const validatePassword = (password: string) => {
    return password.length >= 8
  }
  
  // ... more validation logic
}

// AFTER - Extracted to utility
// utils/profileValidation.ts
export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

export function validatePassword(password: string): boolean {
  return password.length >= 8
}

export function validateProfile(profile: ProfileData): ValidationResult {
  const errors: string[] = []
  
  if (!validateEmail(profile.email)) {
    errors.push('Invalid email format')
  }
  
  if (!validatePassword(profile.password)) {
    errors.push('Password must be at least 8 characters')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
```

### Step 4: Extract Custom Hooks

```typescript
// BEFORE - State logic in component
function UserProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    fetchProfile()
  }, [])
  
  const fetchProfile = async () => {
    try {
      setLoading(true)
<!-- SUPABASE DISABLED:       const data = await supabase.from('profiles').select() -->
      setProfile(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  // ... more logic
}

// AFTER - Extracted to custom hook
// hooks/useUserProfile.ts
export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    fetchProfile()
  }, [userId])
  
  const fetchProfile = async () => {
    try {
      setLoading(true)
<!-- SUPABASE DISABLED:       const { data, error } = await supabase -->
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      setProfile(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const updateProfile = async (updates: Partial<Profile>) => {
    // ... update logic
  }
  
  return {
    profile,
    loading,
    error,
    updateProfile,
    refetch: fetchProfile
  }
}

// Component now simplified
function UserProfile() {
  const { profile, loading, error, updateProfile } = useUserProfile(userId)
  
  if (loading) return <Skeleton />
  if (error) return <Error message={error} />
  
  return <ProfileDisplay profile={profile} onUpdate={updateProfile} />
}
```

### Step 5: Extract Components

```typescript
// BEFORE - Monolithic component
function UserProfile() {
  const [editMode, setEditMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  return (
    <div>
      <h1>{user.name}</h1>
      
      {editMode ? (
        <div>
          {/* 100 lines of edit form */}
        </div>
      ) : (
        <div>
          {/* 100 lines of profile display */}
        </div>
      )}
      
      {showSettings && (
        <div>
          {/* 150 lines of settings */}
        </div>
      )}
    </div>
  )
}

// AFTER - Extracted components
// components/ProfileDisplay.tsx
export function ProfileDisplay({ profile, onEdit }: ProfileDisplayProps) {
  return (
    <div>
      <h1>{profile.name}</h1>
      <p>{profile.email}</p>
      <Button onClick={onEdit}>Edit Profile</Button>
    </div>
  )
}

// components/ProfileEditor.tsx
export function ProfileEditor({ profile, onSave, onCancel }: ProfileEditorProps) {
  const [formData, setFormData] = useState(profile)
  
  const handleSubmit = async () => {
    const validation = validateProfile(formData)
    if (!validation.isValid) {
      toast({ title: 'Validation Error', description: validation.errors.join(', ') })
      return
    }
    await onSave(formData)
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Edit form */}
    </form>
  )
}

// components/UserSettings.tsx
export function UserSettings({ settings, onUpdate }: UserSettingsProps) {
  return (
    <div>
      {/* Settings interface */}
    </div>
  )
}

// pages/UserProfile.tsx - Now clean composition
function UserProfile() {
  const { profile, updateProfile } = useUserProfile(userId)
  const [editMode, setEditMode] = useState(false)
  
  return (
    <div>
      {editMode ? (
        <ProfileEditor
          profile={profile}
          onSave={async (data) => {
            await updateProfile(data)
            setEditMode(false)
          }}
          onCancel={() => setEditMode(false)}
        />
      ) : (
        <ProfileDisplay
          profile={profile}
          onEdit={() => setEditMode(true)}
        />
      )}
    </div>
  )
}
```

### Step 6: Update Imports and References

```typescript
// Update all files that used old code
// BEFORE
import { UserProfile } from './components/UserProfile'

// AFTER
import { UserProfile } from './pages/UserProfile'
import { ProfileEditor } from './components/ProfileEditor'
import { useUserProfile } from './hooks/useUserProfile'
```

### Step 7: Delete Old Code

**Critical**: Always remove obsolete code to prevent confusion.

```typescript
// Remove old functions that were extracted
// Remove commented-out "old implementation" blocks
// Delete unused imports
// Remove dead code branches
```

## Refactoring Patterns

### Pattern 1: Extract Component

**When**: Component exceeds 200 lines or has multiple concerns

```typescript
// Before
function Dashboard() {
  // 300 lines mixing layout, data fetching, and business logic
}

// After
function Dashboard() {
  const { data } = useDashboardData()
  return <DashboardLayout data={data} />
}
```

### Pattern 2: Extract Hook

**When**: Multiple components share similar state logic

```typescript
// Before - Duplicated in 3 components
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)
useEffect(() => { /* fetch logic */ }, [])

// After - Single hook
const { data, loading } = useFetchData(endpoint)
```

### Pattern 3: Extract Utility

**When**: Pure function used in multiple places

```typescript
// Before - Defined in component
const formatCurrency = (amount) => `$${amount.toFixed(2)}`

// After - Shared utility
// utils/formatters.ts
export const formatCurrency = (amount: number): string => 
  `$${amount.toFixed(2)}`
```

### Pattern 4: Simplify Conditionals

```typescript
// Before
if (user && user.isActive && user.role === 'admin' && user.permissions.includes('write')) {
  // do something
}

// After
function canUserEdit(user: User): boolean {
  return user?.isActive 
    && user.role === 'admin' 
    && user.permissions.includes('write')
}

if (canUserEdit(user)) {
  // do something
}
```

### Pattern 5: Replace Props Drilling

```typescript
// Before - Props passed through 5 levels
<Parent user={user}>
  <Child user={user}>
    <GrandChild user={user}>
      <GreatGrandChild user={user} />

// After - Context
const UserContext = createContext<User | null>(null)

function Parent() {
  return (
    <UserContext.Provider value={user}>
      <Child>
        <GrandChild>
          <GreatGrandChild />

function GreatGrandChild() {
  const user = useContext(UserContext)
  // ...
}
```

## Refactoring Anti-Patterns

### Don't Change Behavior

```typescript
// ❌ Wrong - Changed validation logic during refactoring
// Before
if (password.length >= 8) { /* valid */ }

// After (WRONG)
if (password.length > 8) { /* valid */ } // Changed >= to >

// ✅ Correct - Preserve exact behavior
if (password.length >= 8) { /* valid */ }
```

### Don't Mix Refactoring with Feature Addition

```typescript
// ❌ Wrong - Adding feature during refactoring
function refactorUserProfile() {
  // Extract components (refactoring)
  // + Add social media links (NEW FEATURE)
}

// ✅ Correct - Separate commits
1. Refactor UserProfile into components
2. Add social media links feature
```

### Don't Create Premature Abstractions

```typescript
// ❌ Wrong - Over-engineered for 2 use cases
class GenericDataManager<T> {
  // 200 lines of abstraction
}

// ✅ Correct - Simple and direct
function fetchUsers() { /* ... */ }
function fetchProducts() { /* ... */ }
// Abstract only when you have 3+ similar cases
```

## Post-Refactoring Checklist

After refactoring, verify:

- [ ] All functionality works exactly as before
- [ ] No console errors or warnings
- [ ] All imports updated correctly
- [ ] Old code paths deleted
- [ ] Dead code removed
- [ ] Component names are descriptive
- [ ] File structure is logical
- [ ] No lint errors
- [ ] User informed of changes

## Communication Template

When refactoring for users:

```
I'll refactor [component/feature] to improve maintainability.

Current issues:
- [Issue 1]
- [Issue 2]

Changes I'll make:
- Extract [X] into separate component
- Move [Y] logic to custom hook
- Create utility for [Z]

This will:
- Reduce file size from X to Y lines
- Make code more testable
- Improve readability
- Enable easier future changes

Functionality will remain exactly the same.
```

## Testing After Refactoring

### Manual Testing

```typescript
// Test critical user paths
1. User can log in ✓
2. User can edit profile ✓
3. User can save settings ✓
4. Error handling works ✓
5. Loading states display ✓
```

### Automated Testing

```typescript
// Before refactoring
describe('UserProfile', () => {
  it('displays user data', () => { /* ... */ })
  it('handles edit mode', () => { /* ... */ })
})

// After refactoring - tests still pass
describe('UserProfile', () => {
  it('displays user data', () => { /* ... */ }) // ✓ Still passes
  it('handles edit mode', () => { /* ... */ })  // ✓ Still passes
})
```

---

**Key Principle**: Refactoring changes structure, not behavior. Always preserve exact functionality while improving code organization, readability, and maintainability.

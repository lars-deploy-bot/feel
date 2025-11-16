# Authentication Patterns - Complete Implementation Guide

**Category:** Backend Integration  
**Priority:** CRITICAL  
**Last Updated:** 2025-10-28

---

## When Asked to Add Authentication

**ALWAYS follow these steps:**

### Step 1: Ask About User Profile Data

First, ask the user if they expect to store user profile data (e.g., username, roles, avatars):
- **If YES:** Suggest a migration that creates a profiles table
- **If NO:** Don't suggest a profiles table

### Step 2: Add Login/Logout Functionality

**ALWAYS create a new page** (e.g., `/auth`) with support for:
- ✅ Login flow
- ✅ Signup flow (CRITICAL - don't forget this!)
- ✅ Email/password authentication (default)

**IMPORTANT Requirements:**
- Make the auth page look good and match the rest of the app
- Ensure authenticated users are automatically redirected to main page
- Check if user is logged in and redirect to login page if not
- **ALWAYS** use `supabase.auth.onAuthStateChange` to update session state
- Add a link to the login page in the root page (`/`)
- Let user know they can disable "Confirm email" in settings for faster testing

### Step 3: Implement Error Handling

**CRITICAL:** Always implement proper error handling:
- Handle cases like "user already signed up"
- Display friendly error messages to users
- **SECURITY:** Implement input validation using libraries like `zod`
- **SECURITY:** Avoid logging sensitive auth details to console in production

---

## Supabase Authentication Implementation in React

### CRITICAL Best Practices

#### 1. Store Complete Session Object

**ALWAYS maintain both user and session state:**

```typescript
import { User, Session } from '@supabase/supabase-js';

const [user, setUser] = useState<User | null>(null);
const [session, setSession] = useState<Session | null>(null); // CRITICAL!
```

**Why:** The session contains critical auth tokens that the user object alone doesn't have.

#### 2. Supabase Client is Pre-Configured

**DO NOT modify the Supabase client configuration:**
- Auth storage is already set
- Session persistence is already configured
- Auto token refresh is already enabled

The client already includes:
- localStorage storage
- Session persistence
- Auto token refresh

#### 3. Correct Initialization Order

**CRITICAL:** Set up auth state listeners BEFORE checking for existing sessions:

```typescript
useEffect(() => {
  // Step 1: Set up auth state listener FIRST
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    }
  );

  // Step 2: THEN check for existing session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}, []);
```

**Why:** This prevents missing auth events during initialization.

#### 4. Configure Email Redirect URLs (REQUIRED)

**CRITICAL:** Always set the `emailRedirectTo` option when implementing sign up:

```typescript
const signUp = async (email: string, password: string) => {
  const redirectUrl = `${window.location.origin}/`;
  
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl // REQUIRED!
    }
  });
  return { error };
};
```

**Why:** Omitting this will cause authentication issues. This is NOT optional.

---

## Preventing Authentication Deadlock

**CRITICAL:** When implementing `onAuthStateChange`, follow these guidelines:

### Rule 1: Never Use Async Functions Directly

```typescript
// ✅ CORRECT
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
});

// ❌ WRONG - Will cause deadlock
supabase.auth.onAuthStateChange(async (event, session) => {
  setSession(session);
  await fetchUserProfile(session.user.id); // DEADLOCK!
});
```

### Rule 2: Never Call Other Supabase Functions Inside Callback

The callback should ONLY update state synchronously.

### Rule 3: Use setTimeout(0) for Additional Data Fetching

```typescript
// ✅ CORRECT implementation
supabase.auth.onAuthStateChange((event, session) => {
  // Only synchronous state updates here
  setSession(session);
  setUser(session?.user ?? null);
  
  // Defer Supabase calls with setTimeout
  if (session?.user) {
    setTimeout(() => {
      fetchUserProfile(session.user.id);
    }, 0);
  }
});
```

**Why:** Direct async operations inside the callback can freeze the application.

---

## Common Authentication Patterns

### Sign Up

```typescript
const signUp = async (email: string, password: string) => {
  const redirectUrl = `${window.location.origin}/`;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        first_name: firstName,
        last_name: lastName
      }
    }
  });
  
  if (error) {
    console.error('Sign up error:', error.message);
    return { error };
  }
  
  return { data };
};
```

### Sign In

```typescript
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('Sign in error:', error.message);
    return { error };
  }
  
  return { data };
};
```

### Sign Out

```typescript
const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Sign out error:', error.message);
    return { error };
  }
  
  return { error: null };
};
```

### OAuth Sign In

```typescript
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  
  return { data, error };
};
```

---

## Protected Routes

```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};
```

---

## Error Handling Examples

### Sign Up Error Handling

```typescript
const handleSignUp = async (email: string, password: string) => {
  try {
    const { error } = await signUp(email, password);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else if (error.message.includes('Invalid email')) {
        toast.error('Please enter a valid email address.');
      } else if (error.message.includes('Password')) {
        toast.error('Password must be at least 6 characters long.');
      } else {
        toast.error(error.message);
      }
      return;
    }
    
    toast.success('Account created! Please check your email to verify.');
  } catch (err) {
    console.error('Unexpected error:', err);
    toast.error('An unexpected error occurred. Please try again.');
  }
};
```

---

## Security Best Practices

### Input Validation with Zod

```typescript
import { z } from 'zod';

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const handleSignUp = async (formData: unknown) => {
  const result = signUpSchema.safeParse(formData);
  
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    // Display validation errors
    return;
  }
  
  // Proceed with sign up
  await signUp(result.data.email, result.data.password);
};
```

### Never Log Sensitive Data

```typescript
// ❌ WRONG - Exposes sensitive information
console.log('User session:', session);
console.log('Password:', password);

// ✅ CORRECT - Only log non-sensitive info
console.log('User authenticated:', !!session);
console.log('User ID:', session?.user?.id);
```

---

## Related Documentation

- [Lovable Cloud](./01-lovable-cloud.md)
- [Security Critical Rules](./06-security-critical-rules.md)
- [RLS Patterns](./07-rls-patterns.md)
- [User Profiles Implementation](./02-supabase-integration-patterns.md#user-profiles-implementation)

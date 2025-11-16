# Authentication Error Patterns

## Complete Guide to Auth Issues & Solutions

Authentication errors affect user login, signup, and session management. This guide covers all common patterns.

---

## Error 1: "Invalid login credentials"

### Error Message
```
AuthApiError: Invalid login credentials
```

### Causes & Solutions

**Cause 1: Wrong email or password**
```typescript
// User simply entered wrong credentials
// Solution: Show clear error message
toast.error("Email or password is incorrect");
```

**Cause 2: Email not confirmed**
```typescript
// Check if email confirmation is required
// In Supabase Dashboard: Authentication > Settings > Enable email confirmations

// Solution: Inform user
if (error.message.includes('Email not confirmed')) {
  toast.error("Please check your email to confirm your account");
}
```

**Cause 3: User doesn't exist**
```typescript
// Solution: Same error message as wrong password (security best practice)
toast.error("Email or password is incorrect");
```

---

## Error 2: "User already registered"

### Error Message
```
AuthApiError: User already registered
```

### Cause
Attempting to sign up with email that already exists.

### Solution
```typescript
try {
  const { data, error } = await supabase.auth.signUp({
    email: 'user@example.com',
    password: 'password123'
  });
  
  if (error) {
    if (error.message.includes('already registered')) {
      toast.error("An account with this email already exists. Try logging in instead.");
      // Optionally redirect to login page
    }
  }
} catch (error) {
  console.error(error);
}
```

---

## Error 3: "JWT expired"

### Error Message
```
AuthSessionMissingError: JWT expired
```

### Cause
User's session token has expired (typically after 1 hour).

### Solution
```typescript
// Automatic refresh is built-in, but handle explicitly:
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Session refreshed successfully');
  }
  
  if (event === 'SIGNED_OUT') {
    // Session expired and couldn't refresh
    toast.error("Your session has expired. Please log in again.");
    navigate('/login');
  }
});

// Manual refresh
const { data, error } = await supabase.auth.refreshSession();
if (error) {
  console.error('Failed to refresh session:', error);
}
```

---

## Error 4: "No API key found in request"

### Error Message
```
FunctionsHttpError: No API key found in request
```

### Cause
Missing or incorrect Supabase initialization.

### Solution
```typescript
// ❌ Wrong - Missing credentials
const supabase = createClient('', '');

// ✅ Correct - Use environment variables
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Verify environment variables exist
if (!import.meta.env.VITE_SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL');
}
```

---

## Error 5: Email Confirmation Not Working

### Symptoms
- User signs up but never receives confirmation email
- Confirmation link doesn't work

### Causes & Solutions

**Cause 1: Email confirmations disabled**
```
Solution: Supabase Dashboard > Authentication > Settings
Enable "Enable email confirmations"
```

**Cause 2: Wrong redirect URL**
```typescript
// Signup with correct redirect
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});

// Handle callback in /auth/callback route
useEffect(() => {
  const handleCallback = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
      navigate('/dashboard');
    }
  };
  handleCallback();
}, []);
```

**Cause 3: Email in spam**
```
Solution: Check spam folder, configure email domain in Supabase
```

---

## Error 6: "Session is null" / User Not Staying Logged In

### Symptoms
- User logs in but immediately logged out
- Session doesn't persist across page refreshes

### Causes & Solutions

**Cause 1: Not checking session on mount**
```typescript
// ❌ Wrong - Not checking for existing session
function App() {
  const [user, setUser] = useState(null);
  
  return user ? <Dashboard /> : <Login />;
}

// ✅ Correct - Check session on mount
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  
  return user ? <Dashboard /> : <Login />;
}
```

**Cause 2: LocalStorage not working**
```typescript
// Check if localStorage is available
if (typeof window !== 'undefined' && window.localStorage) {
  // LocalStorage available
} else {
  console.error('LocalStorage not available - sessions won\'t persist');
}
```

**Cause 3: CORS issues**
```typescript
// Ensure Supabase URL is correct and accessible
// Check browser console for CORS errors
// Verify Supabase project is not paused
```

---

## Error 7: "Password should be at least 6 characters"

### Error Message
```
AuthWeakPasswordError: Password should be at least 6 characters
```

### Solution
```typescript
// Validate password before submission
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  
  // Additional validation (optional but recommended)
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  return { valid: true };
}

// Use in form
const handleSignup = async (email: string, password: string) => {
  const validation = validatePassword(password);
  if (!validation.valid) {
    toast.error(validation.error);
    return;
  }
  
  const { data, error } = await supabase.auth.signUp({ email, password });
  // ...
};
```

---

## Error 8: Google OAuth Not Working

### Symptoms
- "Redirect URL not allowed" error
- OAuth window opens but doesn't redirect back

### Solutions

**Step 1: Configure redirect URLs**
```
Supabase Dashboard > Authentication > URL Configuration
Add to "Redirect URLs":
- http://localhost:5173/auth/callback (development)
- https://yourdomain.com/auth/callback (production)
```

**Step 2: Implement OAuth flow**
```typescript
// Trigger Google sign-in
const handleGoogleSignIn = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    console.error('OAuth error:', error);
    toast.error('Failed to sign in with Google');
  }
};

// Handle callback (in /auth/callback route)
useEffect(() => {
  const handleCallback = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Callback error:', error);
      navigate('/login');
      return;
    }
    
    if (session) {
      navigate('/dashboard');
    }
  };
  
  handleCallback();
}, []);
```

**Step 3: Enable Google provider**
```
Supabase Dashboard > Authentication > Providers > Google
- Enable Google provider
- Add OAuth credentials from Google Cloud Console
```

---

## Error 9: "Failed to fetch" During Auth

### Symptoms
- Login/signup buttons don't work
- Network errors in console

### Causes & Solutions

**Cause 1: Wrong Supabase URL**
```typescript
// Verify URL in environment variables
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
// Should be: https://xxxxxxxxxxxxx.supabase.co
```

**Cause 2: Supabase project paused**
```
Solution: Check Supabase Dashboard
Project may be paused due to inactivity (free tier)
Restore project if needed
```

**Cause 3: Network issues**
```typescript
// Add error handling
const { data, error } = await supabase.auth.signIn({
  email,
  password,
}).catch(err => {
  console.error('Network error:', err);
  toast.error('Network error. Please check your connection.');
});
```

---

## Error 10: Protected Routes Not Working

### Symptoms
- Unauthenticated users can access protected pages
- Redirects not working

### Solution
```typescript
// Create ProtectedRoute component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });
  }, [navigate]);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return user ? <>{children}</> : null;
}

// Use in routes
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

---

## Error 11: Sign Out Not Working

### Symptoms
- Sign out button doesn't log user out
- User still appears logged in after sign out

### Solution
```typescript
// ❌ Wrong - Not waiting for sign out
const handleSignOut = () => {
  supabase.auth.signOut(); // Fire and forget
  navigate('/login'); // Might happen before sign out completes
};

// ✅ Correct - Wait for sign out
const handleSignOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Sign out error:', error);
    toast.error('Failed to sign out');
    return;
  }
  
  // Clear any additional app state
  localStorage.clear();
  
  toast.success('Signed out successfully');
  navigate('/login');
};
```

---

## Error 12: Magic Link Authentication Issues

### Symptoms
- Magic link email not received
- Magic link doesn't log user in

### Solutions

**Step 1: Enable magic links**
```
Supabase Dashboard > Authentication > Email Auth
Enable "Enable email sign-in"
```

**Step 2: Send magic link**
```typescript
const sendMagicLink = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    toast.error('Failed to send magic link');
    return;
  }
  
  toast.success('Check your email for the login link');
};
```

**Step 3: Handle callback**
```typescript
// Same as OAuth callback (see Error 8)
```

---

## Auth Debugging Checklist

When debugging auth issues:

1. **Check session state**
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   console.log('Current session:', session);
   ```

2. **Check user state**
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   console.log('Current user:', user);
   ```

3. **Monitor auth events**
   ```typescript
   supabase.auth.onAuthStateChange((event, session) => {
     console.log('Auth event:', event, session);
   });
   ```

4. **Check environment variables**
   ```typescript
   console.log({
     url: import.meta.env.VITE_SUPABASE_URL,
     hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY
   });
   ```

5. **Check Supabase logs**
   - Go to Supabase Dashboard > Logs > Auth logs
   - Look for errors or warnings

6. **Test in incognito**
   - Rules out localStorage/cookie issues

7. **Check network tab**
   - Look for failed auth API calls
   - Check response bodies for error details

---

## Common Auth Patterns

### Pattern 1: Complete Auth Flow
```typescript
// 1. Initialize Supabase
const supabase = createClient(url, anonKey);

// 2. Sign up
await supabase.auth.signUp({ email, password });

// 3. Sign in
await supabase.auth.signInWithPassword({ email, password });

// 4. Check session
const { data: { session } } = await supabase.auth.getSession();

// 5. Sign out
await supabase.auth.signOut();
```

### Pattern 2: Auth Context
```typescript
// Create context for app-wide auth state
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
}>({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Use in components
const { user, loading } = useContext(AuthContext);
```

### Pattern 3: Protected API Calls
```typescript
// Automatically include auth token
const fetchProtectedData = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch('/api/protected', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  
  return response.json();
};
```

Remember: Auth errors are usually configuration issues. Check Supabase Dashboard settings, environment variables, and redirect URLs first.

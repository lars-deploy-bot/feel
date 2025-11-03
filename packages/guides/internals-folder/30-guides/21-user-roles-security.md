# User Roles: Security Implementation

## Critical Security Principle

**Roles MUST be stored in separate table**. Never store roles on profiles or users table - this leads to privilege escalation attacks.

## Secure Implementation

### Role Enum Definition

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
```

### User Roles Table

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

### Security Definer Function

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Using in RLS Policies

```sql
CREATE POLICY "admins_all_access"
ON some_table
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
```

## Critical Security Warning

**Never check admin status using client-side storage:**

```typescript
// ❌ WRONG - Can be manipulated
localStorage.setItem('isAdmin', 'true');
if (localStorage.getItem('isAdmin') === 'true') { }

// ❌ WRONG - Hardcoded credentials
if (password === 'admin123') { }

// ✅ CORRECT - Server-side validation
<!-- SUPABASE DISABLED: const isAdmin = await supabase.rpc('has_role', {  -->
  _user_id: user.id, 
  _role: 'admin' 
});
```

**Why**: Client-side checks are easily manipulated. Always validate server-side with proper authentication.

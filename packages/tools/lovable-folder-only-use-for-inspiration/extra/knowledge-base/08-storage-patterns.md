# Storage Patterns - File Upload & Management

**Category:** File Storage  
**Priority:** HIGH  
**Last Updated:** 2025-10-28

---

## Storage Overview

Supabase Storage provides object storage with:
- Secure file uploads and downloads
- Public and private buckets
- Row-Level Security (RLS) policies
- Integration with authentication
- CDN for fast global access

---

## Creating Storage Buckets

### Via SQL Migration

**ALWAYS write SQL migrations** for creating buckets:

```sql
-- Create public bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Create private bucket
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false);
```

### Deleting Buckets

```sql
delete from storage.buckets where id = 'avatars';
```

**Don't tell users to create buckets manually** - you can do it with SQL!

---

## Storage RLS Policies

### Pattern 1: User-Specific Uploads

Users can only upload/access files in their own folder:

```sql
-- Upload policy
create policy "Users can upload their own files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-uploads' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Download policy
create policy "Users can access their own files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-uploads' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Update policy
create policy "Users can update their own files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'user-uploads' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Delete policy
create policy "Users can delete their own files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'user-uploads' and
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**File path structure:** `user-uploads/USER_ID/filename.jpg`

---

### Pattern 2: Public Read, Authenticated Write

Anyone can view files, only authenticated users can upload:

```sql
-- Public can view
create policy "Public can view files"
on storage.objects
for select
to public
using (bucket_id = 'public-files');

-- Authenticated can upload
create policy "Authenticated can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'public-files' and
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### Pattern 3: Admin Override

Admins can access all files, users can access their own:

```sql
create policy "Admin or owner can access"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents' and (
    public.has_role(auth.uid(), 'admin') or
    auth.uid()::text = (storage.foldername(name))[1]
  )
);
```

---

## File Upload Patterns

### Client-Side Upload

```typescript
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export const FileUpload = () => {
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(fileName);

      console.log('File uploaded:', publicUrl);
      return publicUrl;
      
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return (
    <input
      type="file"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) uploadFile(file);
      }}
      disabled={uploading}
    />
  );
};
```

---

### Avatar Upload Pattern

```typescript
const uploadAvatar = async (file: File, userId: string) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/avatar.${fileExt}`;

  // Upload with upsert to replace existing
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true  // Replace existing file
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  // Update user profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (updateError) throw updateError;

  return publicUrl;
};
```

---

### Multi-File Upload

```typescript
const uploadMultipleFiles = async (files: FileList) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const uploads = Array.from(files).map(async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (error) throw error;
    return data;
  });

  const results = await Promise.all(uploads);
  return results;
};
```

---

## File Download Patterns

### Download Public File

```typescript
const downloadPublicFile = (bucketId: string, filePath: string) => {
  const { data: { publicUrl } } = supabase.storage
    .from(bucketId)
    .getPublicUrl(filePath);

  return publicUrl;
};
```

---

### Download Private File

```typescript
const downloadPrivateFile = async (bucketId: string, filePath: string) => {
  // Generate signed URL (expires after specified time)
  const { data, error } = await supabase.storage
    .from(bucketId)
    .createSignedUrl(filePath, 60); // 60 seconds

  if (error) throw error;

  return data.signedUrl;
};
```

---

### Download as Blob

```typescript
const downloadAsBlob = async (bucketId: string, filePath: string) => {
  const { data, error } = await supabase.storage
    .from(bucketId)
    .download(filePath);

  if (error) throw error;

  // Create download link
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filePath.split('/').pop() || 'file';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

---

## File Deletion Patterns

### Delete Single File

```typescript
const deleteFile = async (bucketId: string, filePath: string) => {
  const { error } = await supabase.storage
    .from(bucketId)
    .remove([filePath]);

  if (error) throw error;
};
```

---

### Delete Multiple Files

```typescript
const deleteMultipleFiles = async (bucketId: string, filePaths: string[]) => {
  const { error } = await supabase.storage
    .from(bucketId)
    .remove(filePaths);

  if (error) throw error;
};
```

---

### Delete User Folder

```typescript
const deleteUserFolder = async (userId: string) => {
  // List all files in user's folder
  const { data: files, error: listError } = await supabase.storage
    .from('user-uploads')
    .list(userId);

  if (listError) throw listError;

  // Delete all files
  const filePaths = files.map(file => `${userId}/${file.name}`);
  
  const { error: deleteError } = await supabase.storage
    .from('user-uploads')
    .remove(filePaths);

  if (deleteError) throw deleteError;
};
```

---

## Common Storage Issues

### Issue 1: Images Don't Display

**Problem:** Uploaded images/files don't display or are inaccessible

**Root Causes:**

1. **Bucket is not public:**
   ```sql
   -- Check bucket status
   select id, name, public from storage.buckets;
   
   -- Make bucket public
   update storage.buckets
   set public = true
   where id = 'avatars';
   ```

2. **Missing RLS policies:**
   ```sql
   -- Add public read policy
   create policy "Public can view files"
   on storage.objects
   for select
   to public
   using (bucket_id = 'avatars');
   ```

3. **Wrong file path:**
   ```typescript
   // ❌ WRONG: Missing user ID in path
   const url = supabase.storage.from('uploads').getPublicUrl('file.jpg');
   
   // ✅ CORRECT: Include full path
   const url = supabase.storage.from('uploads').getPublicUrl(`${userId}/file.jpg`);
   ```

---

### Issue 2: Upload Fails with "new row violates row-level security"

**Problem:** File upload fails despite being authenticated

**Solutions:**

1. **Check RLS policy exists:**
   ```sql
   select * from pg_policies 
   where tablename = 'objects' 
     and schemaname = 'storage';
   ```

2. **Ensure file path includes user ID:**
   ```typescript
   // ✅ CORRECT: Path starts with user ID
   const fileName = `${user.id}/documents/file.pdf`;
   ```

3. **Verify user is authenticated:**
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   if (!user) {
     throw new Error('Must be logged in to upload');
   }
   ```

---

### Issue 3: File Size Limit Exceeded

**Problem:** Large files fail to upload

**Solutions:**

1. **Check file size before upload:**
   ```typescript
   const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
   
   if (file.size > MAX_FILE_SIZE) {
     throw new Error('File too large (max 5MB)');
   }
   ```

2. **Compress images before upload:**
   ```typescript
   import imageCompression from 'browser-image-compression';
   
   const compressImage = async (file: File) => {
     const options = {
       maxSizeMB: 1,
       maxWidthOrHeight: 1920,
       useWebWorker: true
     };
     
     return await imageCompression(file, options);
   };
   ```

---

## Storage Schema Restrictions

**CRITICAL:** DO NOT modify the storage schema directly.

**❌ NEVER:**
- Create custom tables in `storage` schema
- Create custom functions in `storage` schema
- Drop existing storage tables or functions
- Create indexes on existing storage tables
- Perform destructive actions on `storage.migrations`

**✅ CORRECT: For custom functionality, use `public` schema:**

```sql
-- CORRECT: Create function in public schema
CREATE OR REPLACE FUNCTION public.admin_access_file(
  bucket_name TEXT,
  file_path TEXT
) 
RETURNS TABLE (
  content BYTEA,
  content_type TEXT,
  metadata JSONB
)
SECURITY DEFINER
SET search_path = public, storage
LANGUAGE plpgsql
AS $$
BEGIN
  -- Function implementation
END;
$$;
```

---

## Best Practices

### 1. Organize Files by User

```typescript
// ✅ CORRECT: Structured paths
const filePath = `${userId}/category/filename.ext`;

// Examples:
// users/123/avatars/profile.jpg
// users/123/documents/resume.pdf
// users/123/images/photo-2024-01-15.jpg
```

### 2. Generate Unique Filenames

```typescript
// Prevent filename collisions
const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
```

### 3. Set Appropriate Cache Headers

```typescript
await supabase.storage.from('bucket').upload(fileName, file, {
  cacheControl: '3600',  // Cache for 1 hour
  upsert: false
});
```

### 4. Handle File Type Validation

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Invalid file type');
}
```

### 5. Clean Up on Delete

When deleting a database record, also delete associated files:

```typescript
const deletePost = async (postId: string) => {
  // Get post to find image path
  const { data: post } = await supabase
    .from('posts')
    .select('image_url')
    .eq('id', postId)
    .single();

  // Delete from storage
  if (post?.image_url) {
    const filePath = post.image_url.split('/').slice(-2).join('/');
    await supabase.storage.from('images').remove([filePath]);
  }

  // Delete database record
  await supabase.from('posts').delete().eq('id', postId);
};
```

---

## Related Documentation

- [RLS Patterns](./07-rls-patterns.md)
- [Security Critical Rules](./06-security-critical-rules.md)
- [Supabase Integration Patterns](./02-supabase-integration-patterns.md)

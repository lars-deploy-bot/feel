# Tool Workflow: File Upload & Storage Implementation

## Scenario
User requests: "Let users upload images/files" or "Add profile picture upload"

## Agent Capabilities
<!-- SUPABASE DISABLED: - Backend enablement (supabase--enable) -->
- Code writing (alive-write, alive-line-replace)
- Code search (alive-search-files)

## Decision Tree

```
START: User needs file upload capability
│
├─→ PREREQUISITES:
│   ├─→ Check: Backend enabled?
<!-- SUPABASE DISABLED: │   │   ├─→ NO: supabase--enable() → WAIT -->
│   │   └─→ YES: Continue
│   │
│   └─→ Identify file type:
│       ├─→ Images (avatars, photos)
│       ├─→ Documents (PDFs, docs)
│       ├─→ Audio files
│       └─→ Video files
│
├─→ STORAGE BUCKET DESIGN:
│   ├─→ Determine bucket name:
│   │   ├─→ avatars (user profile pictures)
│   │   ├─→ documents (user documents)
│   │   ├─→ public-assets (public images)
│   │   └─→ private-files (sensitive files)
│   │
│   ├─→ Determine access policy:
│   │   ├─→ PUBLIC: Anyone can view
│   │   ├─→ PRIVATE: Only authenticated users
│   │   └─→ USER-SPECIFIC: Only file owner
│   │
│   └─→ Plan file path structure:
│       ├─→ By user: {user_id}/{filename}
│       ├─→ By date: {year}/{month}/{filename}
│       └─→ By type: {category}/{filename}
│
├─→ STORAGE POLICIES:
│   ├─→ IF public bucket:
│   │   ├─→ SELECT: Anyone (true)
│   │   ├─→ INSERT: Authenticated only
│   │   └─→ DELETE: Owner only
│   │
│   ├─→ IF private user files:
│   │   ├─→ SELECT: auth.uid() = owner_id
│   │   ├─→ INSERT: auth.uid() = path_user_id
│   │   └─→ DELETE: auth.uid() = path_user_id
│   │
│   └─→ IF role-based:
│       └─→ Use has_role() function in policies
│
├─→ DATABASE INTEGRATION:
│   ├─→ Check: Need to track files in database?
│   │   ├─→ YES: Create files table with metadata
│   │   └─→ NO: Just use storage
│   │
│   └─→ IF files table needed:
│       ├─→ id, user_id, file_path, file_name
│       ├─→ file_type, file_size, uploaded_at
│       └─→ RLS policies matching storage
│
└─→ CLIENT IMPLEMENTATION:
    ├─→ Upload component with preview
    ├─→ Progress indicator
    ├─→ File validation (size, type)
    ├─→ Error handling
    └─→ Display uploaded files
```

## Tool Sequences

### Sequence 1: Avatar Upload
Request: "Add profile picture upload"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->

2. SQL for bucket and policies:
   ```sql
<!-- SUPABASE DISABLED:    -- Create bucket (user does this in Supabase dashboard) -->
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('avatars', 'avatars', true);
   
   -- Storage policies
   CREATE POLICY "Avatar images are publicly accessible"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'avatars');
   
   CREATE POLICY "Users can upload own avatar"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'avatars' 
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   
   CREATE POLICY "Users can update own avatar"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (
     bucket_id = 'avatars' 
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   
   CREATE POLICY "Users can delete own avatar"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'avatars' 
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

3. Update profiles table:
   ```sql
   ALTER TABLE profiles ADD COLUMN avatar_url text;
   ```

4. Implementation (parallel):
   alive-write(src/components/AvatarUpload.tsx) ||
   alive-write(src/hooks/useAvatarUpload.ts) ||
   alive-line-replace(src/pages/Profile.tsx, add-avatar-upload)
```

### Sequence 2: Document Upload with Metadata
Request: "Let users upload PDF documents"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->

2. SQL for bucket, table, and policies:
   ```sql
   -- Bucket (created in dashboard)
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('documents', 'documents', false);
   
   -- Metadata table
   CREATE TABLE document_uploads (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
     file_name text NOT NULL,
     file_path text NOT NULL,
     file_type text NOT NULL,
     file_size bigint NOT NULL,
     uploaded_at timestamptz DEFAULT now() NOT NULL
   );
   
   ALTER TABLE document_uploads ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view own documents"
     ON document_uploads FOR SELECT
     USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can upload documents"
     ON document_uploads FOR INSERT
     WITH CHECK (auth.uid() = user_id);
   
   -- Storage policies
   CREATE POLICY "Users can view own documents"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (
     bucket_id = 'documents' 
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   
   CREATE POLICY "Users can upload own documents"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'documents' 
     AND (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

3. Implementation:
   alive-write(src/components/DocumentUpload.tsx) ||
   alive-write(src/hooks/useDocumentUpload.ts) ||
   alive-write(src/pages/Documents.tsx)
```

### Sequence 3: Image Gallery with Thumbnails
Request: "Create an image gallery for users"

```
<!-- SUPABASE DISABLED: 1. supabase--enable() if needed -->

2. SQL setup:
   ```sql
   -- Bucket for full images
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('gallery', 'gallery', true);
   
   -- Images table
   CREATE TABLE gallery_images (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users(id) NOT NULL,
     file_path text NOT NULL,
     thumbnail_path text,
     title text,
     description text,
     width integer,
     height integer,
     uploaded_at timestamptz DEFAULT now() NOT NULL
   );
   
   ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Images are publicly viewable"
     ON gallery_images FOR SELECT USING (true);
   
   CREATE POLICY "Users can upload images"
     ON gallery_images FOR INSERT
     WITH CHECK (auth.uid() = user_id);
   
   -- Storage policies
   CREATE POLICY "Anyone can view gallery images"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'gallery');
   
   CREATE POLICY "Authenticated users can upload"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'gallery');
   ```

3. Implementation with image processing:
   alive-write(src/components/ImageUpload.tsx) ||
   alive-write(src/components/ImageGallery.tsx) ||
   alive-write(src/hooks/useImageUpload.ts) ||
   alive-write(src/lib/imageProcessing.ts)
```

### Sequence 4: File Upload with Progress
Request: "Show upload progress for large files"

```
1. Bucket setup (via SQL as before)

2. Implementation with progress tracking:
   alive-write(src/components/FileUploadWithProgress.tsx)
   
   Key features:
   - useState for progress percentage
<!-- SUPABASE DISABLED:    - supabase.storage.from().upload() with onUploadProgress -->
   - Progress bar component
   - Cancel upload functionality
   - Error handling with retry
```

### Sequence 5: Multiple File Upload
Request: "Let users upload multiple files at once"

```
1. Bucket setup (via SQL)

2. Implementation with batch upload:
   alive-write(src/components/MultiFileUpload.tsx)
   
   Key features:
   - File input with multiple attribute
   - Queue management for uploads
   - Individual progress per file
   - Parallel uploads with Promise.all()
   - Overall progress calculation
   - Error handling per file
```

### Sequence 6: Drag & Drop Upload
Request: "Add drag and drop for file uploads"

```
1. Bucket setup (via SQL)

2. Implementation with drag/drop:
   alive-write(src/components/DragDropUpload.tsx)
   
   Key features:
   - onDragOver, onDragLeave, onDrop handlers
   - Visual feedback (border, background change)
   - File validation on drop
   - Fallback to click upload
   - Preview before upload
```

### Sequence 7: File Type Restrictions
Request: "Only allow image uploads"

```
1. Bucket setup with file type validation

2. Client-side validation:
   alive-write(src/lib/fileValidation.ts)
   
   ```typescript
   const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
   const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
   
   export const validateImageFile = (file: File) => {
     if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
       throw new Error('Only images are allowed');
     }
     if (file.size > MAX_FILE_SIZE) {
       throw new Error('File size must be less than 5MB');
     }
     return true;
   };
   ```

3. Integration:
   alive-line-replace(src/components/ImageUpload.tsx, add-validation)
```

### Sequence 8: Image Compression Before Upload
Request: "Compress images before uploading"

```
1. alive-add-dependency("browser-image-compression@latest")

2. Implementation:
   alive-write(src/lib/imageCompression.ts)
   
   ```typescript
   import imageCompression from 'browser-image-compression';
   
   export const compressImage = async (file: File) => {
     const options = {
       maxSizeMB: 1,
       maxWidthOrHeight: 1920,
       useWebWorker: true,
     };
     
     try {
       const compressedFile = await imageCompression(file, options);
       return compressedFile;
     } catch (error) {
       console.error('Compression failed:', error);
       return file; // Return original if compression fails
     }
   };
   ```

3. Integration:
   alive-line-replace(src/hooks/useImageUpload.ts, add-compression)
```

### Sequence 9: Signed URLs for Private Files
Request: "Let users download their private files"

```
1. Storage bucket with private access

2. Edge function for signed URLs:
<!-- SUPABASE DISABLED:    alive-write(supabase/functions/get-signed-url/index.ts) -->
   
   ```typescript
   serve(async (req) => {
     const { filePath } = await req.json();
<!-- SUPABASE DISABLED:      const supabase = createClient(/*...*/); -->
     
     // Verify user owns file
     const userId = req.headers.get('Authorization')?.split(' ')[1];
     if (!filePath.startsWith(`${userId}/`)) {
       return new Response('Unauthorized', { status: 403 });
     }
     
<!-- SUPABASE DISABLED:      const { data, error } = await supabase.storage -->
       .from('private-files')
       .createSignedUrl(filePath, 60); // 60 second expiry
     
     if (error) throw error;
     
     return new Response(JSON.stringify({ url: data.signedUrl }), {
       headers: { 'Content-Type': 'application/json' }
     });
   });
   ```

3. Frontend:
   alive-write(src/hooks/usePrivateFileDownload.ts)
```

### Sequence 10: File Delete Functionality
Request: "Let users delete their uploaded files"

```
1. Storage policy for deletion already in place

2. Implementation with database cleanup:
   alive-write(src/hooks/useFileDelete.ts)
   
   ```typescript
   export const useFileDelete = () => {
     const deleteFile = async (fileId: string, filePath: string) => {
       // Delete from storage
<!-- SUPABASE DISABLED:        const { error: storageError } = await supabase.storage -->
         .from('bucket-name')
         .remove([filePath]);
       
       if (storageError) throw storageError;
       
       // Delete from database
<!-- SUPABASE DISABLED:        const { error: dbError } = await supabase -->
         .from('files_table')
         .delete()
         .eq('id', fileId);
       
       if (dbError) throw dbError;
     };
     
     return { deleteFile };
   };
   ```

3. UI integration:
   alive-line-replace(src/components/FileList.tsx, add-delete-button)
```

## Critical Rules

<!-- SUPABASE DISABLED: 1. **Backend must be enabled** - Storage requires Supabase -->
2. **Buckets created in dashboard** - Provide SQL for policies only
3. **Always validate file type** - Client and server-side
4. **Always validate file size** - Prevent huge uploads
5. **Use path structure** - Organize by user_id or category
6. **Private files need signed URLs** - For secure download
7. **Clean up on delete** - Remove from both storage and database
8. **Add RLS to storage** - Protect user files
9. **Track metadata in database** - For listing and management

## Common Mistakes

❌ Not enabling backend before storage implementation
❌ Creating public buckets for private user files
❌ Not validating file types (security risk)
❌ Not validating file sizes (storage cost risk)
❌ Forgetting storage RLS policies
❌ Not organizing files by user_id in paths
❌ Deleting from database but not storage (orphaned files)
❌ Deleting from storage but not database (broken links)
❌ Not compressing images before upload
❌ Not showing upload progress for large files

# Database Scripts

## Generate TypeScript Types

Generate TypeScript types from Supabase database schemas.

### Quick Usage

```bash
# From project root or apps/web
bun run gen:db
```

### What it does

Generates TypeScript type definitions for all database schemas:
- `iam` schema → `apps/web/lib/supabase/iam.types.ts`
- `app` schema → `apps/web/lib/supabase/app.types.ts`
- `lockbox` schema → `apps/web/lib/supabase/lockbox.types.ts`

### Requirements

The script requires environment variables in `apps/web/.env`:
- `SUPABASE_ACCESS_TOKEN` - Your Supabase access token
- `SUPABASE_PROJECT_ID` - Your Supabase project ID (default: qnvprftdorualkdyogka)

To get your access token:
1. Go to <https://supabase.com/dashboard/account/tokens>
2. Create a new access token
3. Add to `apps/web/.env`:
   ```env
   SUPABASE_ACCESS_TOKEN=your_token_here
   ```

### Force Regeneration

To bypass the cooldown period and force regeneration:
```bash
cd apps/web && bun run gen:db:force
```

### Files in this directory

- `generate-types.sh` - Shell script wrapper for easy type generation
- `generate-preview-caddyfile.ts` - Generate Caddy configuration for preview domains
- `cleanup-test-database.ts` - Clean up test data from database
- `superclean.ts` - Deep cleanup of test data

### Notes

- The underlying TypeScript script (`apps/web/scripts/generate-db-types-improved.ts`) has a 2-hour cooldown to prevent excessive API calls
- Types are automatically cached in `apps/web/.tmp/supabase/`
- The shell script can be run from any directory in the project
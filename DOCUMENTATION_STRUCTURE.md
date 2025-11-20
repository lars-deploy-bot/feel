# Documentation Structure - Final

Clean, intelligent documentation with smart nesting and visible active work.

## Structure

```
/docs/
├── README.md                      # Navigation hub
├── GETTING_STARTED.md             # Setup guide
│
├── architecture/                  # Core system design (nested)
│   ├── README.md
│   ├── workspace-isolation.md
│   ├── message-handling.md
│   ├── session-management.md
│   └── credits-and-tokens.md
│
├── security/                      # Security patterns (nested)
│   ├── README.md
│   ├── authentication.md
│   ├── workspace-enforcement.md
│   ├── systemd-hardening.md
│   └── row-level-security.md      # ← Restored
│
├── testing/
│   └── README.md
│
├── features/
│   ├── README.md
│   └── user-prompts.md            # ← Restored
│
├── deployment/                    # Production mentioned 2x only
│   └── README.md
│
├── troubleshooting/
│   └── README.md
│
├── database/                      # ← Restored (reference)
│   ├── README.md
│   ├── ENABLE_RLS.md
│   ├── ES256_MIGRATION_COMPLETE.md
│   ├── ES256_MIGRATION_GUIDE.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── RLS-DEPLOYMENT.md
│   ├── RLS_ES256_STATUS.md
│   └── VERIFICATION_STATUS.md
│
├── integrations/                  # ← Restored
│   ├── README.md
│   └── supabase-setup.md
│
├── streaming/                     # ← Restored (reference)
│   ├── README.md
│   ├── cancellation-architecture.md
│   ├── cleanup-summary-2025-01-10.md
│   └── stream-handler-audit-2025-01-10.md
│
├── open-problems/                 # ✅ Active work (visible)
│   ├── README.md
│   ├── deployment-port-collision.md
│   └── deployment-port-collision-FIXES.md
│
├── currently-working-on-this/     # ✅ Active work (visible)
│   └── e2e-dev-conflict-fix.md
│
└── archive/                       # Historical docs
    ├── apps-web-docs-old/        # Old duplicate docs
    ├── BRIDGE_TYPING_AUDIT.md
    └── database-migration/       # Old migration notes
```

## What Was Kept vs Archived

### ✅ Kept (Production Reference)

- **database/** - Supabase, RLS, ES256 migration (important reference)
- **integrations/** - Supabase setup
- **streaming/** - SSE implementation details
- **features/user-prompts.md** - Feature documentation
- **security/row-level-security.md** - RLS patterns
- **open-problems/** - Active issues
- **currently-working-on-this/** - Work in progress

### 📦 Archived

- Old duplicate architecture docs
- Old debugging session notes
- Duplicate testing guides
- apps/web/docs/* duplicates

## Key Principles

1. **Reference docs kept visible** - Database, integrations, streaming
2. **Active work visible** - Open problems, current work
3. **Smart nesting** - Complex topics get nested structure
4. **Production refs** - Exactly 2 mentions (deployment/README.md)
5. **No duplication** - Single source of truth

## apps/web Structure

```
apps/web/
├── README.md           # Minimal, points to main docs
├── CLAUDE.md           # Web-specific notes only
└── (no docs/ dir)      # All docs in /docs at root
```

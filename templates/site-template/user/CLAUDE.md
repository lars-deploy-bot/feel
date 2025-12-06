# Project Architecture Documentation

## Framework: React + Vite + Hono + TypeScript

This is a **React frontend** with a **Hono API backend**, built with Vite and TypeScript.

## Architecture Overview

```
user/
├── client/                 ← Frontend (React)
│   ├── index.html          ← Entry point
│   ├── main.tsx            ← App initialization
│   ├── pages/              ← Page components
│   │   └── Index.tsx       ← MAIN CONTENT
│   ├── components/         ← Reusable components
│   └── lib/                ← Utilities
├── public/                 ← Static assets (robots.txt, favicons, etc.)
├── server.ts               ← Backend (Hono API)
├── vite.config.ts          ← Vite config (root: "client")
└── dist/                   ← Build output
    └── client/             ← Built frontend
```

## Where Content Lives

**Frontend (React):**
- `client/pages/Index.tsx` - Main page content
- `client/pages/` - Other page components
- `client/components/` - Reusable UI components

**Backend (Hono):**
- `server.ts` - API routes under `/api/*`

**Static Assets:**
- `public/` - robots.txt, favicons, etc. (copied to dist on build)

## Development

```bash
bun run dev        # Start dev server (Vite + API)
bun run build      # Build for production
bun run preview    # Preview production build
```

## Common Tasks

1. **Edit page content:** `client/pages/Index.tsx`
2. **Add components:** `client/components/`
3. **Add API routes:** `server.ts`
4. **Add static files:** `public/`

## Navigation

Uses React Router's `<Link>` components:
- **DO NOT** use `<a href="...">` (causes page reloads)
- **DO** use `<Link to="...">` for internal navigation

## Important Notes

- Frontend root is `client/` (vite.config has `root: "client"`)
- Public assets in `public/` (vite.config has `publicDir: "../public"`)
- Build output in `dist/client/`
- API served from same server in production

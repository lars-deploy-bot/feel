# Project Architecture Documentation

⚠️ **IMPORTANT**: You MUST update this CLAUDE.md file whenever:
- Creating a new site from this template
- Making significant architectural changes to the project
- Adding new frameworks, libraries, or major features
- Changing the file structure or development workflow

## Framework: React + Vite + TypeScript

This is a **React application** built with Vite and TypeScript. The architecture follows modern React patterns.

## 🚨 CRITICAL: Where Content Lives

**FOR CONTENT CHANGES, EDIT THESE FILES:**
- `src/pages/Index.tsx` - Main page content (THIS IS WHERE THE REAL CONTENT IS)
- `src/pages/` - Other page components
- `src/components/` - Reusable UI components

**DO NOT EDIT THESE FILES FOR CONTENT:**
- `index.html` - Just a shell/entry point, not the actual page content
- `src/index.html` - If it exists, it's also just an entry point

## Architecture Overview

```
user/
├── index.html          ← Entry point only (loads React app)
├── src/
│   ├── main.tsx        ← App initialization
│   ├── pages/
│   │   └── Index.tsx   ← MAIN CONTENT LIVES HERE
│   ├── components/     ← Reusable components
│   └── lib/           ← Utilities
├── package.json        ← Dependencies
└── vite.config.ts     ← Build configuration
```

## Development

- **Start dev server:** `bun run dev`
- **Build:** `bun run build`
- **Live reload:** Automatic via Vite HMR

## Common Tasks

1. **Change page content:** Edit `src/pages/Index.tsx`
2. **Add components:** Create in `src/components/`
3. **Add routing:** Use React Router in `src/main.tsx`
4. **Style changes:** Edit component files or global CSS

## Project Purpose

[REPLACE THIS: Describe what this specific website/project does]

## Important Notes

- This uses Vite for fast development and building
- Hot Module Replacement (HMR) provides instant updates
- TypeScript provides type safety
- Tailwind CSS for styling (if configured)
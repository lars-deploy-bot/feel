# Stage 3: Rebuild as Components

Only start this after stages 1-2 work and the site loads fully in isolation.

---

## When to do this

- You need to modify content or layout
- You want to add new pages or features
- You're preparing for production with real SEO, performance, etc.

**Don't do this just to be clean.** If the static serve works, leave it.

## Overview

The rebuild goes from scraped bundle → clean Vite + React project. The source uses React + motion library, so the rebuild is a React-to-React migration (not a framework change).

### What the scraped bundle contains

The `sites/HASH/` directory has ~163 `.mjs` files built by rolldown (a Rust-based bundler). Key runtime modules:

| Module pattern | Purpose |
|----------------|---------|
| `chunk-*.mjs` (largest) | React 18 runtime |
| `motion.*.mjs` | Animation runtime (motion library) |
| `page-*.mjs` | Per-section page components |
| `*_lazy-*.mjs` | Lazy-loaded sections (below fold) |
| `rolldown-runtime-*.mjs` | Module loader bootstrap |

Icon libraries (e.g. phosphor-icons) are separate packages under `sitemaker.example.com/m/` with `@` version suffixes in filenames (e.g., `icon.js@0.0.57`).

### Phase A: Analyze (before writing any code)

1. **Map page sections** — identify each visual block (hero, nav, carousel, grid, testimonials, CTA, footer)
2. **Map the JS dependency graph** — which `.mjs` imports which, what's runtime (react, motion) vs page components
3. **Extract CSS** — all styles are inline `<style>` blocks in the HTML (typically 10K+ lines). Map class names to sections.
4. **Identify animation patterns** — motion `animate`, `whileInView`, `variants`, `layoutId`. These must be preserved.
5. **List all assets** — images (with dimensions), fonts (with weights/styles), videos, SVGs

### Phase B: Set up project

1. Init Vite + React + TailwindCSS in `src/`
2. Install: `react`, `react-dom`, `motion` (animation library), carousel lib if needed (embla, swiper)
3. Move images/fonts/videos to `public/`
4. Set up responsive breakpoints matching the original (check `@media` queries in inline `<style>` blocks)

### Phase C: Rebuild sections (one at a time)

For each section, in order of complexity (easiest first):

| Section | Typical complexity | Notes |
|---------|-------------------|-------|
| Footer | Small | Links, logo, copyright. Static layout. |
| CTA banner | Small | Heading + button. Simple. |
| Navbar | Medium | Logo, links, hamburger menu on mobile. May have scroll effects. |
| Hero | Medium | Background video/image, heading, subtext, CTAs. Animations on load. |
| Feature grid | Medium | Repeated cards with icons. CSS grid. May use icon packages. |
| Testimonials | Medium | Quotes with images. May have carousel. |
| Architecture diagram | Medium | Layered visual. May be SVG or positioned elements. |
| Carousel/slider | Large | Touch gestures, pagination, breakpoint-aware. Use a library. |

**For each section:**
1. Screenshot the original for reference
2. Extract the HTML structure from the scraped file
3. Identify which inline `<style>` rules apply (search for class names)
4. Rebuild as a React component with Tailwind
5. Compare pixel-by-pixel with original
6. Replicate motion animations (`whileInView`, `variants`, `spring` transitions)

### Phase D: Wire up

1. Internal links (`./contact`, `./product/*`) — either separate HTML pages or React Router
2. Scroll animations — replicate with motion library (already used in source, just clean up)
3. Responsive — test all 3 breakpoints (desktop 1200px+, tablet 810px, mobile 390px)
4. Delete all scraped source files + symlinks (`<name>/`, `cdn/`)
5. Update server.ts to serve from `dist/` (Vite build output)

## Target structure

```
/srv/webalive/sites/<domain>/user/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.html
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── Hero.tsx
│   │   ├── Carousel.tsx
│   │   ├── FeatureGrid.tsx
│   │   ├── Architecture.tsx
│   │   ├── Testimonials.tsx
│   │   ├── CTA.tsx
│   │   └── Footer.tsx
│   ├── assets/
│   │   ├── images/
│   │   ├── fonts/
│   │   └── videos/
│   └── styles/
│       └── globals.css
├── public/
│   └── robots.txt
├── server.ts
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

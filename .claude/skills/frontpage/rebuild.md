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

| Module pattern | Purpose | Size |
|----------------|---------|------|
| `react.*.mjs` | React 18.2.0 runtime | 145KB |
| `motion.*.mjs` | Motion animation runtime | 151KB |
| `framer.*.mjs` (largest) | Framework runtime (carousel, layout, scroll) | 464KB |
| `page-*.mjs` | Per-section page components | varies |
| `*_lazy-*.mjs` | Lazy-loaded sections (below fold) | varies |
| `rolldown-runtime-*.mjs` | Module loader bootstrap | small |

### Dependencies discovered from bundle analysis

```bash
bun add react@18.2.0 react-dom@18.2.0 motion @phosphor-icons/react
bun add -d vite @vitejs/plugin-react tailwindcss @tailwindcss/vite
```

| Package | Version | Why | Found via |
|---------|---------|-----|-----------|
| `react` | 18.2.0 | Exact version in `react.*.mjs` (`createRoot`, `hydrateRoot`) | `grep -oP '\d+\.\d+\.\d+' react.*.mjs` |
| `react-dom` | 18.2.0 | Paired with React | same file |
| `motion` | latest | 893 `layoutId`, 375 `transition`, 301 `animate`, 101 `variants`, 10 `whileHover`, 5 `whileInView`, 3 `useScroll` usages across bundle | `grep -oP 'whileInView\|animate\|layoutId\|...' *.mjs \| sort \| uniq -c` |
| `@phosphor-icons/react` | latest | 5 icons used: ArrowsOut, Binoculars, Faders, House, ShieldCheck (at `@0.0.57` in scraped source) | `ls framer.com/m/phosphor-icons/` |
| `tailwindcss` | 4.x | Replacing all inline styles + `framer-*` classes | — |

**No carousel library needed.** The original uses native CSS `scroll-snap-type: x mandatory` (6 carousels, 30 carousel elements in the HTML). Reuse this pattern.

### Fonts (16 woff2 files)

| Font | Source | Usage |
|------|--------|-------|
| ABC Favorit Light | Custom (scraped to `assets/`) | Headings, hero text — weight 300, tracking -0.05em |
| Inter | Google Fonts (scraped to `fonts/`) | Body text, navigation, descriptions |
| Fragment Mono | Google Fonts (scraped to `fonts/`) | Code/mono sections |
| Ubuntu Mono | Google Fonts (scraped to `fonts/`) | Secondary mono |

Register in `globals.css` with `@font-face` pointing to `/fonts/` and `/assets/`.

### Responsive breakpoints (from HTML)

```
Desktop: min-width 1440px  (hash: 18bz23r)
Tablet:  880px – 1439px    (hash: 10amtx1)
Mobile:  max-width 879px   (hash: 1rgopjz)
```

The HTML has **80 SSR variant blocks** (`ssr-variant`) and **92 `hidden-*` classes** — three complete DOM trees rendered server-side, shown/hidden by CSS media queries. The rebuild merges these into one tree with Tailwind responsive prefixes.

### How to find dependencies for any scraped site

```bash
# React version
grep -oP '\d+\.\d+\.\d+' react.*.mjs | sort -u

# Motion API surface (what to implement)
grep -oP 'whileInView|whileHover|animate|variants|layoutId|useScroll|useTransform' *.mjs | sort | uniq -c | sort -rn

# Icon packages
ls <platform-dir>/m/

# Font families used
grep -oP 'font-family:[^;]+' index.html | sort -u

# Carousel type (native scroll-snap vs library)
grep -c 'scroll-snap-type\|framer--carousel\|aria-roledescription="carousel"' index.html

# SSR responsive variants (how many DOM trees to merge)
grep -c 'ssr-variant' index.html
```

---

## Chunk-and-Stitch

**Don't read or understand the HTML yourself.** Extract line ranges from `index.html`, prepend a short prompt, send to Groq. One section = one call. Many parallel calls.

### Why small beats big

Tested with `openai/gpt-oss-120b` on Groq ($0.15/$0.60 per MTok):
- **79K tokens (2250 lines, 7 components):** Generic shells. Truncated image paths. Ignored responsive variants. Invented content instead of reading it.
- **~1K tokens (19 lines, 1 component):** Perfect. Clean Tailwind, correct content, added gradient overlay unprompted.

**Rule: one section boundary = one call. Max ~200 lines per call.**

### Groq API

```bash
# Endpoint
POST https://api.groq.com/openai/v1/chat/completions

# Auth
Authorization: Bearer $GROQ_API_KEY

# Example call
curl https://api.groq.com/openai/v1/chat/completions -s \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -d '{
    "model": "openai/gpt-oss-120b",
    "messages": [{
      "role": "user",
      "content": "Convert this scraped HTML into a React + Tailwind component called DepartmentCard...\n\n---HTML---\n'"$(sed -n '9340,9358p' index.html)"'"
    }]
  }'
```

### Models and pricing (March 2026)

| Model ID | Context | Input $/MTok | Output $/MTok | Use for |
|----------|---------|-------------|--------------|---------|
| `openai/gpt-oss-120b` | 131K | $0.15 | $0.60 | Component extraction (tested, works) |
| `openai/gpt-oss-20b` | 131K | $0.075 | $0.30 | Data extraction, simple cards |
| `llama-3.3-70b-versatile` | 131K | $0.59 | $0.79 | Fallback, slightly better reasoning |

**Default: `openai/gpt-oss-120b`**. Tested and validated for HTML→React+Tailwind conversion.

For comparison: Opus is $15/$75 per MTok. A single 1K-token card extraction costs:
- Groq `gpt-oss-120b`: $0.00015 input + $0.0003 output = **$0.00045**
- Opus: $0.015 input + $0.0375 output = **$0.0525**
- **117x cheaper on Groq** for the same task with identical output quality.

### What goes to Groq vs Opus

| Groq | Opus |
|------|------|
| Single card/item (19-30 lines) | Merging 3 responsive DOM variants (80 SSR blocks) |
| Static sections (footer, CTA) | Navbar (dropdowns + mobile menu + scroll effects) |
| Section wrappers (grid/carousel layout) | Animation wiring (`motion` API integration) |
| CSS-to-Tailwind on isolated blocks | Complex debugging |
| Data extraction (link lists, image paths) | Final stitching (`App.tsx` + layout order) |

### How to extract chunks

**Don't read the file.** Use line numbers:

```bash
# Find section boundaries
grep -n 'data-framer-name=' index.html | head -60

# Extract a chunk
sed -n '9340,9358p' index.html > /tmp/chunk.html

# Check size (aim for <5KB)
wc -c /tmp/chunk.html
```

### Prompt template

```
Convert this scraped HTML into a React + Tailwind component called `{ComponentName}`.
Props: {name (string), description (string), image (string)}.
Remove all framer-* classes, data-framer-* attributes, CSS custom properties (--token-*, --extracted-*), and HTML comments.
Convert inline styles to Tailwind. Output ONLY the component code.

---HTML---
{raw lines from sed}
```

For repeated items (6 department cards, 8 carousel items): extract ONE item → Groq → get component back → Opus wires up the parent with data array.

### Parallel execution

```
index.html
├── lines 9340-9358  →  Groq  →  DepartmentCard.tsx       ($0.0005)
├── lines 9530-9545  →  Groq  →  IndustryCard.tsx          ($0.0005)
├── lines 11714-11942 →  Groq  →  Footer.tsx               ($0.005)
├── lines 10650-10700 →  Groq  →  CTABanner.tsx            ($0.001)
├── lines 11478-11580 →  Opus  →  Navbar.tsx               ($3-5)
└── lines 9228-9310  →  Opus  →  HeroSection.tsx           ($2-3)
```

All Groq calls run in parallel (~1 second). Opus handles the hard parts. One final Opus call to stitch into `App.tsx`.

---

### Phase A: Analyze (before writing any code)

Don't read the HTML manually. Run these commands:

```bash
# 1. Map all named sections
grep -n 'data-framer-name=' index.html | grep -v 'Text\|Image\|RichText' | head -40

# 2. Count responsive variants to merge
grep -c 'ssr-variant' index.html

# 3. Motion API surface (what animations to replicate)
grep -oP 'whileInView|whileHover|animate|variants|layoutId|useScroll' *.mjs | sort | uniq -c | sort -rn

# 4. List all image assets with sizes
find wonderful/ -name "*.jpg" -o -name "*.png" | while read f; do
  echo "$(identify -format '%wx%h' "$f" 2>/dev/null) $f"
done

# 5. List font files
ls wonderful/fonts/ wonderful/*/assets/*.woff2 2>/dev/null
```

### Phase B: Set up project

```bash
mkdir -p src/components src/assets/images src/assets/fonts src/assets/videos src/styles public

# Init
bun init -y

# Install exact deps
bun add react@18.2.0 react-dom@18.2.0 motion @phosphor-icons/react hono
bun add -d vite @vitejs/plugin-react tailwindcss @tailwindcss/vite typescript

# Copy assets
cp wonderful/framerusercontent.com/images/* src/assets/images/
cp wonderful/fonts/* wonderful/framerusercontent.com/assets/*.woff2 src/assets/fonts/
cp wonderful/videos/* src/assets/videos/
```

Tailwind config — match original breakpoints:

```ts
// tailwind.config.ts
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      sm: "880px",   // tablet (original: 880-1439px)
      lg: "1440px",  // desktop (original: 1440px+)
    },
    extend: {
      fontFamily: {
        favorit: ['"ABC Favorit Light"', 'sans-serif'],
        mono: ['"Fragment Mono"', '"Ubuntu Mono"', 'monospace'],
      },
    },
  },
}
```

### Phase C: Rebuild sections (chunk-and-stitch)

| Section | Lines | Chunk size | Model | Method | Cost |
|---------|-------|-----------|-------|--------|------|
| Footer | 11714-11942 | 229 lines | Groq | Single chunk | $0.005 |
| CTA banner | ~30 lines | 30 lines | Groq | Single chunk | $0.001 |
| Department cards | 9340-9358 | 19 lines x1 | Groq | One card → data array | $0.001 |
| Industry cards | 9530-9545 | 20 lines x1 | Groq | One card → carousel wrapper | $0.001 |
| Logo cloud | find image paths | data only | Groq | Extract paths, trivial component | $0.001 |
| Feature grid | ~20 lines x1 | 20 lines | Groq | One card → grid wrapper | $0.001 |
| Testimonials | ~30 lines x1 | 30 lines | Groq | Card cheap, carousel Opus | $0.50 |
| Hero | 9228-9310 | 82 lines | Opus | Video + animations + responsive | $3 |
| Navbar | 11478-11710 | 232 lines | Opus | 3 variants → 1 responsive | $5 |
| Architecture | ~200 lines | 200 lines | Opus | Layered visual | $2 |
| Stitch (App.tsx) | all outputs | summary | Opus | Import + layout order | $1 |

**Total Stage 3: ~$12** (Groq: ~$0.01, Opus: ~$12 for hard sections + stitching)

**For each section:**
1. `grep -n 'data-framer-name="SectionName"' index.html` → find boundaries
2. `sed -n 'START,ENDp' index.html` → extract chunk
3. Send to Groq (or Opus for hard sections)
4. `bun run dev` → verify it renders
5. For animations: Opus pass to add `motion` integration

### Phase D: Wire up

1. Internal links (`./contact`, `./product/*`) — React Router or separate HTML pages
2. Scroll animations — `motion` library: `whileInView`, `useScroll`, `variants`
3. Responsive — test all 3 breakpoints: 1440px+ (desktop), 880-1439px (tablet), <880px (mobile)
4. Delete scraped source: `rm -rf wonderful/ cdn/`
5. Update `server.ts` to serve Vite `dist/` output

## Target structure

```
/srv/webalive/sites/<domain>/user/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.html
│   ├── components/
│   │   ├── Navbar.tsx          # Opus (3 variants merged)
│   │   ├── Hero.tsx            # Opus (video + animations)
│   │   ├── DepartmentsGrid.tsx # Groq card + Opus wrapper
│   │   ├── DepartmentCard.tsx  # Groq
│   │   ├── IndustryCard.tsx    # Groq
│   │   ├── Carousel.tsx        # CSS scroll-snap (native, no library)
│   │   ├── FeatureGrid.tsx     # Groq
│   │   ├── Architecture.tsx    # Opus
│   │   ├── Testimonials.tsx    # Groq card + Opus carousel
│   │   ├── LogoCloud.tsx       # Groq
│   │   ├── CTABanner.tsx       # Groq
│   │   └── Footer.tsx          # Groq
│   ├── assets/
│   │   ├── images/             # ~40 files from wonderful/framerusercontent.com/images/
│   │   ├── fonts/              # 16 woff2: ABC Favorit, Inter, Fragment Mono, Ubuntu Mono
│   │   └── videos/             # 2 mp4: 16x9_Compressed.mp4, 9x16_Compressed.mp4
│   └── styles/
│       └── globals.css         # @font-face declarations, CSS reset
├── public/
│   └── robots.txt
├── server.ts                   # Hono serving dist/
├── package.json                # react 18.2.0, motion, @phosphor-icons/react, hono, vite, tailwindcss
├── vite.config.ts
└── tailwind.config.ts          # screens: sm:880px, lg:1440px
```

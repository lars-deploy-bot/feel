# SEO Best Practices for Alive Applications

## Overview

Search Engine Optimization (SEO) should be implemented automatically in every Alive application. This guide covers essential SEO practices that must be applied to all pages and components.

## Core SEO Requirements

These requirements are **mandatory** for every page and should be implemented automatically without user request.

### 1. Title Tags

**Requirements**:
- Include main keyword naturally
- Keep under 60 characters
- Unique for every page
- Descriptive and compelling

**Implementation**:
```typescript
// index.html
<head>
  <title>Your Primary Keyword - Brand Name</title>
</head>

// Or dynamic with React Helmet
import { Helmet } from 'react-helmet-async'

function ProductPage({ product }) {
  return (
    <>
      <Helmet>
        <title>{product.name} - Buy Online | Your Store</title>
      </Helmet>
      {/* page content */}
    </>
  )
}
```

**Examples**:
- Homepage: "Professional Web Design Services | YourBrand"
- Product: "Blue Wireless Headphones - Premium Sound | YourStore"
- Blog: "10 SEO Tips for 2025 - Digital Marketing Blog"

### 2. Meta Descriptions

**Requirements**:
- Maximum 160 characters
- Include target keyword naturally
- Compelling call-to-action
- Unique for every page

**Implementation**:
```typescript
<Helmet>
  <meta 
    name="description" 
    content="Discover premium wireless headphones with exceptional sound quality. Free shipping on all orders over $50. Shop now!"
  />
</Helmet>
```

### 3. Heading Structure

**Requirements**:
- Single H1 per page
- H1 must match page's primary intent
- Include main keyword in H1
- Logical hierarchy (H1 → H2 → H3)

**Implementation**:
```tsx
function ProductPage() {
  return (
    <main>
      <h1>Premium Wireless Headphones - Studio Quality Sound</h1>
      
      <section>
        <h2>Product Features</h2>
        <h3>Noise Cancellation</h3>
        <h3>Battery Life</h3>
      </section>
      
      <section>
        <h2>Customer Reviews</h2>
        <h3>5-Star Ratings</h3>
      </section>
    </main>
  )
}
```

**Anti-pattern**:
```tsx
// ❌ Wrong - Multiple H1 tags
<h1>Welcome</h1>
<h1>Our Products</h1>

// ❌ Wrong - Skipping levels
<h1>Title</h1>
<h4>Subtitle</h4>
```

### 4. Semantic HTML

**Requirements**:
- Use appropriate HTML5 semantic elements
- Improve accessibility and SEO simultaneously
- Clear document structure

**Implementation**:
```tsx
function Layout() {
  return (
    <>
      <header>
        <nav>{/* navigation */}</nav>
      </header>
      
      <main>
        <article>
          <h1>Article Title</h1>
          <section>
            <h2>Section Title</h2>
            {/* content */}
          </section>
        </article>
        
        <aside>
          {/* related content */}
        </aside>
      </main>
      
      <footer>
        {/* footer content */}
      </footer>
    </>
  )
}
```

**Key semantic elements**:
- `<header>`: Site or section header
- `<nav>`: Navigation links
- `<main>`: Primary page content
- `<article>`: Self-contained content
- `<section>`: Thematic grouping
- `<aside>`: Tangentially related content
- `<footer>`: Site or section footer

### 5. Image Optimization

**Requirements**:
- Every image must have descriptive `alt` attribute
- Include relevant keywords naturally
- Describe image content accurately
- Leave alt empty for decorative images (`alt=""`)

**Implementation**:
```tsx
// ✅ Correct - Descriptive alt text
<img 
  src="/products/headphones.jpg" 
  alt="Black wireless over-ear headphones with noise cancellation"
/>

// ✅ Correct - Decorative image
<img 
  src="/decorative-border.svg" 
  alt=""
  aria-hidden="true"
/>

// ❌ Wrong - Generic or missing alt
<img src="/product.jpg" alt="product" />
<img src="/product.jpg" />
```

**Additional optimization**:
```tsx
// Lazy loading for below-fold images
<img 
  src="/hero-image.jpg" 
  alt="Modern workspace with laptop"
  loading="lazy"
/>

// Responsive images
<img 
  src="/product-large.jpg"
  srcSet="/product-small.jpg 400w, /product-medium.jpg 800w, /product-large.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
  alt="Product name - detailed view"
/>
```

### 6. Structured Data (JSON-LD)

**Requirements**:
- Add schema.org markup for rich results
- Implement for products, articles, FAQs, organizations
- Validate with Google's Rich Results Test

**Implementation - Product**:
```tsx
function ProductPage({ product }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": product.imageUrl,
    "description": product.description,
    "brand": {
      "@type": "Brand",
      "name": "YourBrand"
    },
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": product.rating,
      "reviewCount": product.reviewCount
    }
  }

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      {/* page content */}
    </>
  )
}
```

**Implementation - Article**:
```tsx
const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Optimize Your Website for SEO",
  "image": "https://example.com/article-image.jpg",
  "author": {
    "@type": "Person",
    "name": "Jane Doe"
  },
  "publisher": {
    "@type": "Organization",
    "name": "YourSite",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  },
  "datePublished": "2025-01-15",
  "dateModified": "2025-01-20"
}
```

**Implementation - FAQ**:
```tsx
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How long does shipping take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Standard shipping takes 5-7 business days."
      }
    },
    {
      "@type": "Question",
      "name": "What is your return policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We accept returns within 30 days of purchase."
      }
    }
  ]
}
```

### 7. Performance Optimization

**Requirements**:
- Lazy load below-fold images
- Defer non-critical scripts
- Minimize render-blocking resources
- Optimize Core Web Vitals

**Implementation**:
```tsx
// Lazy loading images
<img src="/image.jpg" loading="lazy" alt="Description" />

// Lazy loading components
const HeavyComponent = lazy(() => import('./HeavyComponent'))

function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HeavyComponent />
    </Suspense>
  )
}

// Defer scripts
<Helmet>
  <script src="/analytics.js" defer />
  <script src="/chat-widget.js" async />
</Helmet>
```

### 8. Canonical Tags

**Requirements**:
- Prevent duplicate content issues
- Specify preferred URL version
- Essential for pagination and filters

**Implementation**:
```tsx
<Helmet>
  <link rel="canonical" href="https://example.com/products/headphones" />
</Helmet>

// For paginated content
<Helmet>
  <link rel="canonical" href="https://example.com/blog/article" />
  {pageNumber > 1 && (
    <link rel="prev" href={`https://example.com/blog?page=${pageNumber - 1}`} />
  )}
  {hasNextPage && (
    <link rel="next" href={`https://example.com/blog?page=${pageNumber + 1}`} />
  )}
</Helmet>
```

### 9. Mobile Optimization

**Requirements**:
- Responsive design on all pages
- Proper viewport meta tag
- Touch-friendly interactive elements
- Fast mobile load times

**Implementation**:
```html
<!-- index.html -->
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
```

```css
/* Mobile-first responsive design */
.container {
  width: 100%;
  padding: 1rem;
}

@media (min-width: 768px) {
  .container {
    max-width: 768px;
    margin: 0 auto;
  }
}

/* Touch-friendly buttons */
.button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 24px;
}
```

### 10. Clean URL Structure

**Requirements**:
- Descriptive, crawlable URLs
- Hyphens for word separation
- Lowercase letters
- Include keywords when natural

**Implementation**:
```tsx
// ✅ Good URLs
/products/wireless-headphones
/blog/seo-best-practices-2025
/about/our-team

// ❌ Bad URLs
/products?id=12345
/blog/post_1
/page.php?category=tech&id=5
```

**React Router setup**:
```tsx
<Routes>
  <Route path="/products/:slug" element={<ProductPage />} />
  <Route path="/blog/:category/:article-slug" element={<ArticlePage />} />
  <Route path="/services/:service-name" element={<ServicePage />} />
</Routes>
```

## Implementation Checklist

For every new page/component, verify:

- [ ] Title tag present and optimized (< 60 chars, includes keyword)
- [ ] Meta description present and compelling (< 160 chars)
- [ ] Single H1 tag that includes main keyword
- [ ] Logical heading hierarchy (H1 → H2 → H3)
- [ ] Semantic HTML structure used
- [ ] All images have descriptive alt attributes
- [ ] Structured data added (if applicable)
- [ ] Images lazy loaded when below fold
- [ ] Canonical tag present
- [ ] Mobile responsive design
- [ ] Clean, descriptive URL structure

## Tools and Validation

### Testing Tools
- **Google Search Console**: Monitor search performance
- **Google Rich Results Test**: Validate structured data
- **PageSpeed Insights**: Check performance metrics
- **Mobile-Friendly Test**: Ensure mobile compatibility
- **Lighthouse**: Comprehensive SEO audit

### Browser Extensions
- **SEO Meta in 1 Click**: Quick meta tag inspection
- **Detailed SEO Extension**: Comprehensive on-page analysis
- **Web Developer**: Inspect page structure

## Common SEO Mistakes to Avoid

```tsx
// ❌ Multiple H1 tags
<h1>Welcome</h1>
<h1>About Us</h1>

// ❌ Missing alt attributes
<img src="/hero.jpg" />

// ❌ Generic meta descriptions
<meta name="description" content="Welcome to our website" />

// ❌ No structured data for products/articles

// ❌ Blocking search engines
<meta name="robots" content="noindex" />

// ❌ Missing canonical tags on duplicate content

// ❌ Poor mobile experience
<meta name="viewport" content="width=1200">
```

## Advanced SEO Considerations

### International SEO

```tsx
<Helmet>
  <html lang="en" />
  <link rel="alternate" hrefLang="es" href="https://example.com/es/" />
  <link rel="alternate" hrefLang="fr" href="https://example.com/fr/" />
</Helmet>
```

### Open Graph Tags

```tsx
<Helmet>
  <meta property="og:title" content="Your Page Title" />
  <meta property="og:description" content="Page description" />
  <meta property="og:image" content="https://example.com/image.jpg" />
  <meta property="og:url" content="https://example.com/page" />
  <meta property="og:type" content="website" />
</Helmet>
```

### Twitter Cards

```tsx
<Helmet>
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Your Page Title" />
  <meta name="twitter:description" content="Page description" />
  <meta name="twitter:image" content="https://example.com/image.jpg" />
</Helmet>
```

---

**Key Principle**: SEO should be implemented automatically and comprehensively from the start. Never skip these fundamentals, as they directly impact discoverability and user experience.

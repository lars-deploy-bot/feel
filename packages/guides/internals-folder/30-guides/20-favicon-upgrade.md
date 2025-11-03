# Updating Application Favicon

## Critical Rule

**DO NOT CODE if user hasn't provided image or URL.** Always ask for the image/URL first.

## Implementation Approaches

### Approach 1: User-Uploaded Image

When user uploads image (available in `user-uploads://`):

**Step 1**: Copy to public directory
```
alive-copy user-uploads://uploaded-file.png public/favicon.png
```

**Step 2**: Update index.html
```html
<link rel="icon" href="/favicon.png" type="image/png">
```

### Approach 2: External URL

When user provides URL:

```html
<link rel="icon" href="https://example.com/favicon.ico" type="image/x-icon">
```

## File Requirements

- Copy files to project before referencing
- Files in public/ accessible at root path
- Example: `public/favicon.png` → `/favicon.png`

## Supported Formats

- **ICO**: Classic favicon format
- **PNG**: Modern, recommended
- **SVG**: Scalable, best for simple logos
- **GIF**: Animated favicons (limited support)

## Multiple Size Declaration

```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
```

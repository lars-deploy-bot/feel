# Claude Widget - Standalone Version

This directory contains an **alternative Go-based widget server** for ultra-optimized delivery.

## ⚠️ **Current Status: Not In Use**

The widget is currently served directly from the **Next.js app** at `/widget.js` for simplicity. This Go server was built for optimization but isn't needed yet.

## 🚀 **Active Implementation**

The widget currently works like this:

```html
<!-- ✅ CURRENT: Served from Next.js app -->
<script src="https://terminal.goalive.nl/widget.js" data-workspace="auto"></script>
```

**Files in use:**
- `apps/web/public/widget.js` - The actual widget script
- `apps/web/lib/cors-utils.ts` - CORS handling for cross-origin requests

## 📁 **What's In This Directory**

This folder contains a **future optimization** - a standalone Go server that could serve the widget with:

- **<3KB gzipped** widget delivery
- **Sub-50ms** response times
- **Zero dependencies** (stdlib only)
- **Independent deployment** from main app

## 🔧 **If You Want To Use The Go Server**

```bash
# Build minified widget
./build.sh

# Run Go server
go run main.go

# Widget available at: http://localhost:3001/widget.js
```

**Benefits:**
- Faster loading (Go vs Next.js)
- Independent scaling
- CDN-friendly deployment
- Minimal resource usage

## Performance

- **Original**: 11,855 bytes
- **Minified**: 8,274 bytes (30% reduction)
- **Gzipped**: 2,819 bytes (76% reduction) ✅

## Deployment Options

### 1. Standalone Service
```bash
# Build and run
go build -o widget-server
./widget-server
```

### 2. Docker Container
```bash
docker build -t claude-widget .
docker run -p 3001:3001 claude-widget
```

### 3. Edge/CDN Deploy
```bash
# Build static files
./build.sh

# Upload widget.min.js to:
# - Vercel Edge
# - Cloudflare Workers
# - AWS Lambda@Edge
# - Any CDN
```

## Configuration

Environment variables:

- `PORT`: Server port (default: 3001)

## Why Go?

- **Minimal footprint**: ~5MB Docker image vs 500MB+ Node.js
- **Instant startup**: <10ms vs seconds for Node
- **Zero dependencies**: No npm/security issues
- **Excellent caching**: Perfect for static widget delivery
- **Cross-platform**: Single binary deployment

## Architecture

```
Website → Widget Server → Claude Bridge API
  ↓           ↓               ↓
HTML    →   Go Server   →   Next.js API
            (3KB JS)         (Claude AI)
```

The widget server is completely independent and can be deployed anywhere, making it perfect for:

- CDN edge deployment
- Microservice architecture
- Multi-region distribution
- High-availability setups
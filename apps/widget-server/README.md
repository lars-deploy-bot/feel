# Claude Widget Server

Ultra-fast Go server that serves the minimal Claude Bridge widget.

## Features

- **<3KB gzipped** widget delivery
- **Sub-50ms** response times
- **Zero dependencies** (stdlib only)
- **Docker ready** for any platform
- **CORS optimized** for cross-origin loading

## Quick Start

```bash
# Build widget
./build.sh

# Run server
go run main.go

# Or with Docker
docker build -t claude-widget .
docker run -p 3001:3001 claude-widget
```

## Usage

Sites can now load the widget from the dedicated server:

```html
<!-- From widget server -->
<script src="http://widget-server:3001/widget.js" data-workspace="auto"></script>

<!-- Or from CDN/edge deployment -->
<script src="https://widgets.yoursite.com/widget.js" data-workspace="auto"></script>
```

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
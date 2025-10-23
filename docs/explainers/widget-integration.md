# Claude Bridge Widget Integration

Add Claude AI assistance to any website with a simple script injection.

## Quick Start

Add this script tag to any HTML page:

```html
<script src="https://terminal.goalive.nl/widget.js" data-workspace="auto"></script>
```

A chat button will appear in the bottom-right corner. Click it to start chatting with Claude!

## ✅ **Working Example**

Here's a complete working example you can test immediately:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Website with Claude</title>
</head>
<body>
    <h1>Welcome to My Site</h1>
    <p>Look for the chat button in the bottom-right corner!</p>

    <!-- Claude Widget - Works from any domain -->
    <script src="https://terminal.goalive.nl/widget.js" data-workspace="auto"></script>
</body>
</html>
```

**What happens:**
1. **💬 Chat button** appears in bottom-right corner
2. **Click to open** - Login panel appears
3. **Enter passcode** - Same one you use for Claude Bridge
4. **Start chatting** - Claude can read/edit files in your workspace!

## How It Works

The Claude Bridge Widget is a **self-contained frontend script** that:

1. **Injects a floating chat interface** into any webpage
2. **Communicates with Claude Bridge backend** using the same APIs
3. **Inherits workspace permissions** based on the site's domain or custom configuration
4. **Provides real-time streaming** of Claude's responses and tool usage

## Architecture

```
Your Website (under /sites)
├── index.html
├── styles.css
├── script.js
└── <script src="/claude-widget.js"> ← Injects Claude interface
    │
    └── Connects to Claude Bridge API (/api/claude/stream)
        │
        └── Claude works in your site's workspace directory
```

## Configuration Options

### Basic Usage (Auto Workspace)
```html
<script src="/claude-widget.js" data-workspace="auto"></script>
```
- Uses domain-based workspace: `/claude-bridge/sites/{domain}/src`
- Perfect for most scenarios

### Custom Workspace
```html
<script src="/claude-widget.js"
        data-workspace="webalive/sites/my-project"
        data-position="bottom-left">
</script>
```

### All Configuration Options
| Attribute | Default | Options | Description |
|-----------|---------|---------|-------------|
| `data-workspace` | `"auto"` | `"auto"` or custom path | Workspace directory for Claude |
| `data-position` | `"bottom-right"` | `bottom-right`, `bottom-left`, `top-right`, `top-left` | Widget position |
| `data-theme` | `"light"` | `light`, `dark` | Visual theme |

## JavaScript API

The widget exposes a global `ClaudeBridge` object:

```javascript
// Open/close widget programmatically
ClaudeBridge.open()
ClaudeBridge.close()

// Send message programmatically (requires authentication)
await ClaudeBridge.sendMessage("What files are in this project?")

// Clear conversation history
ClaudeBridge.clearMessages()
```

## Example Implementations

### E-commerce Site
```html
<!-- Product page with Claude assistance -->
<script src="/claude-widget.js" data-workspace="auto"></script>
<script>
// Auto-open widget when user clicks help
document.querySelector('.help-button').addEventListener('click', () => {
    ClaudeBridge.open()
})
</script>
```

### Portfolio Site
```html
<!-- Personal site with custom positioning -->
<script src="/claude-widget.js"
        data-workspace="webalive/sites/portfolio"
        data-position="top-right">
</script>
```

### Documentation Site
```html
<!-- Docs with context-aware Claude -->
<script src="/claude-widget.js" data-workspace="auto"></script>
<script>
// Pre-fill helpful context when widget opens
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#help') {
        ClaudeBridge.open()
    }
})
</script>
```

## What Claude Can Do

Through the widget, Claude has the same capabilities as the full Claude Bridge interface:

### File Operations
- **Read files**: "Show me the package.json file"
- **Edit files**: "Update the page title to 'My New Site'"
- **Create files**: "Create a new contact form component"
- **Search code**: "Find all TODO comments in this project"

### Project Analysis
- **Code review**: "Review this JavaScript file for improvements"
- **Structure analysis**: "What's the architecture of this project?"
- **Dependency audit**: "What npm packages is this project using?"

### Development Help
- **Bug fixing**: "The contact form isn't working, can you help?"
- **Feature development**: "Add a dark mode toggle to this site"
- **Optimization**: "How can I improve the performance of this page?"

## Security Features

### Workspace Isolation
- Claude can only access files within the designated workspace
- No access to system files or other websites
- Path traversal attacks are prevented

### Authentication
- Uses same passcode system as main Claude Bridge
- Session-based authentication with secure cookies
- Optional bypass for development environments

### Tool Restrictions
- Limited to safe file operations: Read, Write, Edit, Glob, Grep
- No shell access or dangerous operations
- All tool usage is logged and visible to user

## Widget Features

### Real-time Streaming
- See Claude's responses as they're generated
- Visual indicators when Claude uses tools
- Live updates of file operations

### Responsive Design
- Works on desktop and mobile devices
- Adapts to different screen sizes
- Non-intrusive overlay design

### User Experience
- Familiar chat interface
- Syntax highlighting for code
- Error handling and retry mechanisms
- Conversation history within session

## Deployment

### For Site Owners
1. Add the script tag to your HTML
2. Configure workspace and positioning
3. Test authentication with your Claude Bridge passcode

### For Platform Administrators
1. Ensure `claude-widget.js` is served from `/public`
2. Verify CORS settings for cross-site requests
3. Monitor usage via Claude Bridge logs

## Troubleshooting

### Widget Not Appearing
- Check that script loads without 404 errors
- Verify Claude Bridge backend is running
- Check browser console for JavaScript errors

### Authentication Issues
- Verify `BRIDGE_PASSCODE` environment variable
- Check that cookies are enabled
- Ensure same-site cookie policies allow authentication

### Workspace Errors
- Verify workspace directory exists
- Check file permissions
- Ensure workspace path doesn't contain `..` or invalid characters

### API Connection Issues
- Verify Claude Bridge backend is accessible
- Check network connectivity
- Review CORS headers if loading from different domain

## Advanced Usage

### Custom Styling
Override widget styles by adding CSS after the script:

```html
<script src="/claude-widget.js"></script>
<style>
#claude-bridge-widget-trigger {
    background: #your-brand-color !important;
}
</style>
```

### Event Handling
Listen for widget events:

```javascript
// Widget opened
window.addEventListener('claude-widget-opened', () => {
    console.log('Claude widget opened')
})

// Message sent
window.addEventListener('claude-widget-message', (event) => {
    console.log('Message sent:', event.detail.message)
})
```

### Integration with Analytics
Track widget usage:

```javascript
// Track widget interactions
ClaudeBridge.onOpen = () => {
    gtag('event', 'claude_widget_opened')
}

ClaudeBridge.onMessage = (message) => {
    gtag('event', 'claude_message_sent', {
        message_length: message.length
    })
}
```

## Performance

### Loading Impact
- Script is ~15KB minified
- Loads asynchronously without blocking page render
- Lazy-loads UI components on first interaction

### Resource Usage
- Minimal DOM footprint when closed
- Efficient event handling
- Streams responses to minimize memory usage

## Examples

See `/widget-example.html` for a complete demonstration of the widget's capabilities and integration options.
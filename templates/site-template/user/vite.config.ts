import path from "node:path"
import react from "@vitejs/plugin-react-swc"
import { componentTagger } from "lovable-tagger"
import { defineConfig, type Plugin } from "vite"

// Plugin to inject preview navigation sync script for Claude Bridge sandbox
// IMPORTANT: Message types MUST match PREVIEW_MESSAGES in @webalive/shared/constants.ts
// - NAVIGATION_START = "preview-navigation-start"
// - NAVIGATION = "preview-navigation"
function previewNavSync(): Plugin {
  return {
    name: "preview-nav-sync",
    transformIndexHtml(html) {
      const script = `<script>
(function() {
  if (window.parent === window) return;
  function sendStart() {
    window.parent.postMessage({ type: 'preview-navigation-start' }, '*');
  }
  function sendPath() {
    window.parent.postMessage({ type: 'preview-navigation', path: location.pathname }, '*');
  }
  sendPath();
  var origPush = history.pushState, origReplace = history.replaceState;
  history.pushState = function() { sendStart(); origPush.apply(this, arguments); sendPath(); };
  history.replaceState = function() { sendStart(); origReplace.apply(this, arguments); sendPath(); };
  window.addEventListener('popstate', function() { sendStart(); sendPath(); });
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href]');
    if (a && a.href && !a.target && a.origin === location.origin) sendStart();
  }, true);
  window.addEventListener('beforeunload', sendStart);
})();
</script>`
      // Inject at very start of head (before Vite's scripts)
      return html.replace("<head>", `<head>${script}`)
    },
  }
}

// In dev: Vite is the main server on PORT, API runs on internal port (PORT+1000)
// In prod: API server handles everything
const PORT = Number(process.env.PORT) || 8080
const API_PORT = PORT + 1000

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: "client",
  publicDir: "../public",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  server: {
    host: "::",
    port: PORT,
    allowedHosts: ["localhost", ".alive.best", ".preview.terminal.goalive.nl"],
    headers: {
      "X-Frame-Options": "ALLOWALL",
    },
    hmr: {
      // For reverse proxy (Caddy) with HTTPS - connect via public domain
      protocol: "wss",
      clientPort: 443,
    },
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "::",
    port: PORT,
    allowedHosts: ["localhost", ".alive.best", ".preview.terminal.goalive.nl"],
    headers: {
      "X-Frame-Options": "ALLOWALL",
    },
  },
  plugins: [previewNavSync(), react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
}))

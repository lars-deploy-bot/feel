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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    headers: {
      "X-Frame-Options": "ALLOWALL",
    },
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT || 4000}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    headers: {
      "X-Frame-Options": "ALLOWALL",
    },
  },
  plugins: [previewNavSync(), react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))

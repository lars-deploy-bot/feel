import { defineConfig } from 'vite'

export default defineConfig({
  // Development server for testing widget
  server: {
    port: 5173, // Vite default
    open: true
  },

  // Widget build configuration
  build: {
    lib: {
      entry: 'src/widget.ts',
      name: 'ClaudeWidget',
      fileName: 'claude-widget',
      formats: ['iife'] // Self-executing function for <script> tag
    },
    rollupOptions: {
      output: {
        // Minimize bundle size
        inlineDynamicImports: true,
        manualChunks: undefined
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },

  // Test configuration
  test: {
    environment: 'jsdom',
    globals: true
  }
})
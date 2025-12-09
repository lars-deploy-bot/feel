import { defineConfig, type PluginOption } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react() as PluginOption],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        upload: resolve(__dirname, "src/client/main.tsx"),
        editor: resolve(__dirname, "src/client/editor-main.tsx"),
        "shell-term": resolve(__dirname, "src/client/shell-main.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name].[ext]",
      },
    },
    minify: true,
  },
})

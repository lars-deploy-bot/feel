import { defineConfig, type PluginOption } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"

export default defineConfig({
  plugins: [react() as PluginOption, tailwindcss() as PluginOption],
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        upload: resolve(__dirname, "src/main.tsx"),
        editor: resolve(__dirname, "src/editor-main.tsx"),
        "shell-term": resolve(__dirname, "src/shell-main.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        // CSS from upload entry (main.tsx) should be named shell.css
        assetFileNames: assetInfo => {
          if (assetInfo.names?.[0] === "upload.css") {
            return "shell.css"
          }
          return "[name].[ext]"
        },
      },
    },
    minify: true,
    cssMinify: true,
  },
})

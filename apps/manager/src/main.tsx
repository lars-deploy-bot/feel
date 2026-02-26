import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/App"
import { queryClient } from "./lib/query"
import "./styles.css"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

createRoot(root).render(
  <StrictMode>
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </NuqsAdapter>
  </StrictMode>,
)

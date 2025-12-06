import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ShellApp } from "./components/shell/ShellApp"
import "./styles/shell.css"
import "./styles/shell-tabs.css"
import "@xterm/xterm/css/xterm.css"

const root = document.getElementById("root") || document.body
createRoot(root).render(
  <StrictMode>
    <ShellApp />
  </StrictMode>,
)

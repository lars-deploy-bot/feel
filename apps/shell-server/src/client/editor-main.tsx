import { createRoot } from "react-dom/client"
import { EditorApp } from "./components/editor/EditorApp"

const container = document.getElementById("app")
if (container) {
  const root = createRoot(container)
  root.render(<EditorApp />)
}

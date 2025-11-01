import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export function useWorkspace() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState("")
  const [isTerminal, setIsTerminal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsTerminal(window.location.hostname.startsWith("terminal."))
  }, [])

  useEffect(() => {
    if (isTerminal) {
      const savedWorkspace = sessionStorage.getItem("workspace")
      if (savedWorkspace) {
        setWorkspace(savedWorkspace)
      } else {
        // Redirect to workspace setup
        router.push("/workspace")
      }
    }
  }, [isTerminal, router])

  return { workspace, isTerminal, mounted }
}

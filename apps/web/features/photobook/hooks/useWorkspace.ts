import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { isTerminalMode } from "@/features/workspace/types/workspace"

export function useWorkspace() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState("")
  const [isTerminal, setIsTerminal] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsTerminal(isTerminalMode(window.location.hostname))
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

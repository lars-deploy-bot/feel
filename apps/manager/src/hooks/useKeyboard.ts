import { useEffect } from "react"

export function useKeyboard(key: string, handler: () => void, deps: unknown[] = []) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === key) handler()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handler, ...deps])
}

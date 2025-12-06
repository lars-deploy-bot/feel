import { useCallback, useEffect, useRef, useState } from "react"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { Terminal } from "@xterm/xterm"

interface TerminalTab {
  id: string
  name: string
  terminal: Terminal
  fitAddon: FitAddon
  ws: WebSocket
}

const MAX_TABS = 10

const terminalTheme = {
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  cursor: "#0dbc79",
  cursorAccent: "#1e1e1e",
  selectionBackground: "rgba(13, 188, 121, 0.3)",
  black: "#1e1e1e",
  red: "#f14c4c",
  green: "#0dbc79",
  yellow: "#e5c07b",
  blue: "#2472c8",
  magenta: "#c678dd",
  cyan: "#56b6c2",
  white: "#d4d4d4",
  brightBlack: "#5c5c5c",
  brightRed: "#f14c4c",
  brightGreen: "#0dbc79",
  brightYellow: "#e5c07b",
  brightBlue: "#2472c8",
  brightMagenta: "#c678dd",
  brightCyan: "#56b6c2",
  brightWhite: "#ffffff",
}

// Get URL params
const params = new URLSearchParams(window.location.search)
const workspace = params.get("workspace") || "root"
const backUrl = params.get("back") || "/dashboard"
const backLabel = params.get("backLabel") || "Dashboard"

// Detect mobile
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768
const fontSize = isMobile ? 16 : 14

export function ShellApp() {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const tabCounter = useRef(0)
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const createTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) {
      alert(`Maximum ${MAX_TABS} tabs allowed`)
      return null
    }

    tabCounter.current++
    const id = `tab-${tabCounter.current}`
    const name = `Terminal ${tabCounter.current}`

    const term = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
      scrollback: 1000,
      theme: terminalTheme,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?workspace=${workspace}`)

    ws.onopen = () => {
      setLoading(false)
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }))
    }

    ws.onmessage = event => {
      const msg = JSON.parse(event.data)
      if (msg.type === "data") {
        term.write(msg.data)
      } else if (msg.type === "exit") {
        term.write(`\r\n\r\n[Process exited with code ${msg.exitCode}]\r\n`)
      }
    }

    ws.onerror = () => {
      setLoading(false)
      term.write("\r\n\x1b[31mConnection error\x1b[0m\r\n")
    }

    ws.onclose = () => {
      term.write("\r\n\x1b[33mConnection closed\x1b[0m\r\n")
    }

    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }))
      }
    })

    const newTab: TerminalTab = { id, name, terminal: term, fitAddon, ws }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)

    return newTab
  }, [tabs.length])

  const closeTab = useCallback(
    (id: string) => {
      if (tabs.length <= 1) return

      const tab = tabs.find(t => t.id === id)
      if (tab) {
        tab.ws.close()
        tab.terminal.dispose()
      }

      setTabs(prev => {
        const newTabs = prev.filter(t => t.id !== id)
        if (activeTabId === id && newTabs.length > 0) {
          const closedIndex = prev.findIndex(t => t.id === id)
          const newIndex = Math.min(closedIndex, newTabs.length - 1)
          setActiveTabId(newTabs[newIndex].id)
        }
        return newTabs
      })
    },
    [tabs, activeTabId],
  )

  const switchTab = useCallback((id: string) => {
    setActiveTabId(id)
  }, [])

  // Create initial tab
  useEffect(() => {
    if (tabs.length === 0) {
      createTab()
    }
  }, [])

  // Open terminal when tab becomes active or ref is available
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (!activeTab) return

    const container = terminalRefs.current.get(activeTabId!)
    if (!container) return

    // Check if already opened in this container
    if (container.querySelector(".xterm")) {
      // Just fit and focus
      requestAnimationFrame(() => {
        try {
          activeTab.fitAddon.fit()
          if (activeTab.ws.readyState === WebSocket.OPEN) {
            activeTab.ws.send(
              JSON.stringify({
                type: "resize",
                cols: activeTab.terminal.cols,
                rows: activeTab.terminal.rows,
              }),
            )
          }
        } catch (e) {
          console.error("Failed to fit terminal:", e)
        }
        activeTab.terminal.focus()
      })
      return
    }

    // Open terminal in container
    activeTab.terminal.open(container)

    requestAnimationFrame(() => {
      try {
        activeTab.fitAddon.fit()
        if (activeTab.ws.readyState === WebSocket.OPEN) {
          activeTab.ws.send(
            JSON.stringify({
              type: "resize",
              cols: activeTab.terminal.cols,
              rows: activeTab.terminal.rows,
            }),
          )
        }
      } catch (e) {
        console.error("Failed to fit terminal:", e)
      }
      activeTab.terminal.focus()
    })
  }, [activeTabId, tabs])

  // Handle window resize
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout>

    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const activeTab = tabs.find(t => t.id === activeTabId)
        if (!activeTab) return

        try {
          activeTab.fitAddon.fit()
          if (activeTab.ws.readyState === WebSocket.OPEN) {
            activeTab.ws.send(
              JSON.stringify({
                type: "resize",
                cols: activeTab.terminal.cols,
                rows: activeTab.terminal.rows,
              }),
            )
          }
        } catch (e) {
          console.error("Failed to fit terminal:", e)
        }
      }, 100)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [tabs, activeTabId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault()
        createTab()
      }
      if (e.ctrlKey && e.shiftKey && e.key === "W") {
        e.preventDefault()
        if (activeTabId && tabs.length > 1) {
          closeTab(activeTabId)
        }
      }
      if (e.ctrlKey && e.key === "Tab" && !e.shiftKey) {
        e.preventDefault()
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        const nextIndex = (currentIndex + 1) % tabs.length
        switchTab(tabs[nextIndex].id)
      }
      if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
        e.preventDefault()
        const currentIndex = tabs.findIndex(t => t.id === activeTabId)
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
        switchTab(tabs[prevIndex].id)
      }
    }

    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [tabs, activeTabId, createTab, closeTab, switchTab])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tabs.forEach(tab => {
        tab.ws.close()
        tab.terminal.dispose()
      })
    }
  }, [])

  return (
    <div className="shell-root">
      {/* Header */}
      <header className="shell-header">
        <h1>Shell</h1>
        <div className="shell-header-actions">
          <a href={backUrl} className="btn btn-accent">
            {backLabel}
          </a>
          <a href="/logout" className="btn btn-danger">
            Logout
          </a>
        </div>
      </header>

      {/* Error */}
      {error && <div className="shell-error">{error}</div>}

      {/* Loading */}
      {loading && <div className="shell-loading">Connecting to shell...</div>}

      {/* Main */}
      <main className="shell-main">
        {/* Sidebar */}
        <aside className="shell-sidebar">
          <div className="shell-tab-list">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`shell-tab-item ${tab.id === activeTabId ? "active" : ""}`}
                onClick={() => switchTab(tab.id)}
              >
                <span className="shell-tab-icon">$</span>
                <span className="shell-tab-name">{tab.name}</span>
                {tabs.length > 1 && (
                  <button
                    className="shell-tab-close"
                    onClick={e => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button className="shell-add-tab" onClick={() => createTab()}>
            + New Tab
          </button>
        </aside>

        {/* Terminal area */}
        <div className="shell-terminal-area">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`shell-terminal-wrapper ${tab.id === activeTabId ? "active" : ""}`}
              ref={el => {
                if (el) terminalRefs.current.set(tab.id, el)
              }}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

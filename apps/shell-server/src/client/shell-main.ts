import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"
import "./styles/shell-tabs.css"

// Get workspace from URL params
const params = new URLSearchParams(window.location.search)
const workspace = params.get("workspace") || "root"

// Detect mobile device
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768

// Same font size on both - 14 is readable and saves space on mobile
const fontSize = 14

// Terminal theme
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

// Tab management
interface TerminalTab {
  id: string
  name: string
  terminal: Terminal
  fitAddon: FitAddon
  ws: WebSocket
  element: HTMLDivElement
}

const tabs: TerminalTab[] = []
let activeTabId: string | null = null
let tabCounter = 0
const MAX_TABS = 10

// DOM elements
const shellContainer = document.getElementById("shell-container")
const tabList = document.getElementById("tab-list")
const addTabBtn = document.getElementById("add-tab-btn")
const loadingEl = document.getElementById("loading")
const errorEl = document.getElementById("error")
const mobileTabsInner = document.getElementById("mobile-tabs-inner")
const swipeIndicator = document.getElementById("swipe-indicator")

if (!shellContainer || !tabList || !addTabBtn) {
  throw new Error("Required elements not found")
}

function createTab(): TerminalTab | null {
  if (tabs.length >= MAX_TABS) {
    alert(`Maximum ${MAX_TABS} tabs allowed`)
    return null
  }

  tabCounter++
  const id = `tab-${tabCounter}`
  const name = `Terminal ${tabCounter}`

  // Create terminal wrapper element
  const wrapper = document.createElement("div")
  wrapper.id = `terminal-${id}`
  wrapper.className = "terminal-wrapper"
  shellContainer!.appendChild(wrapper)

  // Create scroll-to-bottom button (useful on mobile)
  const scrollBtn = document.createElement("button")
  scrollBtn.className = "scroll-bottom-btn"
  scrollBtn.innerHTML = "↓"
  scrollBtn.title = "Scroll to bottom"
  wrapper.appendChild(scrollBtn)

  // Create terminal
  const term = new Terminal({
    cursorBlink: true,
    fontSize,
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
    scrollback: isMobile ? 2000 : 1000,
    theme: terminalTheme,
    // Mobile scroll improvements
    smoothScrollDuration: isMobile ? 100 : 0,
    scrollSensitivity: isMobile ? 3 : 1,
    fastScrollSensitivity: isMobile ? 10 : 5,
    // Better touch support
    allowProposedApi: true,
  })

  const fitAddon = new FitAddon()
  const webLinksAddon = new WebLinksAddon()

  term.loadAddon(fitAddon)
  term.loadAddon(webLinksAddon)
  term.open(wrapper)

  // Create WebSocket connection
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws?workspace=${workspace}`)

  ws.onopen = () => {
    if (loadingEl) loadingEl.style.display = "none"
    ws.send(
      JSON.stringify({
        type: "resize",
        cols: term.cols,
        rows: term.rows,
      }),
    )
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
    if (loadingEl) loadingEl.style.display = "none"
    term.write("\r\n\x1b[31mConnection error\x1b[0m\r\n")
  }

  ws.onclose = () => {
    term.write("\r\n\x1b[33mConnection closed\x1b[0m\r\n")
  }

  // Send input to server
  term.onData(data => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "input", data }))
    }
  })

  // Scroll-to-bottom button logic
  let isAtBottom = true
  term.onScroll(() => {
    const viewport = wrapper.querySelector(".xterm-viewport")
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      isAtBottom = scrollTop + clientHeight >= scrollHeight - 50
      scrollBtn.classList.toggle("visible", !isAtBottom)
    }
  })

  scrollBtn.addEventListener("click", () => {
    term.scrollToBottom()
    scrollBtn.classList.remove("visible")
  })

  // Mobile: tap anywhere on terminal to focus (helps with keyboard)
  if (isMobile) {
    wrapper.addEventListener("click", e => {
      // Don't interfere with scroll button
      if ((e.target as HTMLElement).classList.contains("scroll-bottom-btn")) return
      term.focus()
    })
  }

  const tab: TerminalTab = {
    id,
    name,
    terminal: term,
    fitAddon,
    ws,
    element: wrapper,
  }

  tabs.push(tab)
  renderTabList()
  switchToTab(id)

  return tab
}

function closeTab(id: string) {
  const index = tabs.findIndex(t => t.id === id)
  if (index === -1) return

  // Don't close if it's the last tab
  if (tabs.length === 1) {
    return
  }

  const tab = tabs[index]

  // Close WebSocket
  tab.ws.close()

  // Dispose terminal
  tab.terminal.dispose()

  // Remove DOM element
  tab.element.remove()

  // Remove from array
  tabs.splice(index, 1)

  // Switch to another tab if this was active
  if (activeTabId === id) {
    const newIndex = Math.min(index, tabs.length - 1)
    switchToTab(tabs[newIndex].id)
  }

  renderTabList()
}

function switchToTab(id: string) {
  const tab = tabs.find(t => t.id === id)
  if (!tab) return

  // Hide all terminals
  tabs.forEach(t => {
    t.element.classList.remove("active")
  })

  // Show selected terminal
  tab.element.classList.add("active")
  activeTabId = id

  // Expose active terminal and websocket for inline scripts (long press scroll, send button)
  ;(window as unknown as { __activeTerminal: Terminal; __activeWebSocket: WebSocket }).__activeTerminal = tab.terminal
  ;(window as unknown as { __activeWebSocket: WebSocket }).__activeWebSocket = tab.ws

  // Fit terminal after switching (with delay for DOM update)
  requestAnimationFrame(() => {
    try {
      tab.fitAddon.fit()
      if (tab.ws.readyState === WebSocket.OPEN) {
        tab.ws.send(
          JSON.stringify({
            type: "resize",
            cols: tab.terminal.cols,
            rows: tab.terminal.rows,
          }),
        )
      }
    } catch (e) {
      console.error("Failed to fit terminal:", e)
    }
    tab.terminal.focus()
  })

  renderTabList()
}

function renderTabList() {
  // Desktop tab list
  tabList!.innerHTML = ""

  tabs.forEach(tab => {
    const item = document.createElement("div")
    item.className = `tab-item${tab.id === activeTabId ? " active" : ""}`
    item.innerHTML = `
      <span class="tab-icon">$</span>
      <span class="tab-name">${tab.name}</span>
      ${tabs.length > 1 ? '<span class="tab-close">×</span>' : ""}
    `

    item.addEventListener("click", e => {
      const target = e.target as HTMLElement
      if (target.classList.contains("tab-close")) {
        e.stopPropagation()
        closeTab(tab.id)
      } else {
        switchToTab(tab.id)
      }
    })

    tabList!.appendChild(item)
  })

  // Mobile tab bar
  if (mobileTabsInner) {
    mobileTabsInner.innerHTML = ""

    tabs.forEach(tab => {
      const mobileTab = document.createElement("div")
      mobileTab.className = `mobile-tab${tab.id === activeTabId ? " active" : ""}`
      mobileTab.innerHTML = `
        <span>$ ${tab.name}</span>
        ${tabs.length > 1 ? '<span class="mobile-tab-close">×</span>' : ""}
      `

      mobileTab.addEventListener("click", e => {
        const target = e.target as HTMLElement
        if (target.classList.contains("mobile-tab-close")) {
          e.stopPropagation()
          closeTab(tab.id)
        } else {
          switchToTab(tab.id)
        }
      })

      mobileTabsInner.appendChild(mobileTab)
    })

    // Add new tab button
    const addBtn = document.createElement("div")
    addBtn.className = "mobile-add-tab"
    addBtn.textContent = "+"
    addBtn.addEventListener("click", () => createTab())
    mobileTabsInner.appendChild(addBtn)

    // Scroll active tab into view
    const activeTab = mobileTabsInner.querySelector(".mobile-tab.active")
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }
  }
}

// Handle resize - throttled to prevent excessive calls
let resizeTimeout: ReturnType<typeof setTimeout>
function handleResize() {
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

// Mobile: Handle visual viewport changes (keyboard appearing/disappearing)
if (isMobile && window.visualViewport) {
  let lastHeight = window.visualViewport.height
  const mainContainer = document.getElementById("main-container")
  const mobileToolbar = document.getElementById("mobile-toolbar")

  const adjustForKeyboard = () => {
    const vv = window.visualViewport!
    const keyboardHeight = window.innerHeight - vv.height

    if (keyboardHeight > 100) {
      // Keyboard is open - adjust layout
      if (mainContainer) {
        mainContainer.style.bottom = `${keyboardHeight}px`
      }
      if (mobileToolbar) {
        mobileToolbar.style.bottom = `${keyboardHeight}px`
        mobileToolbar.style.paddingBottom = "8px"
      }
    } else {
      // Keyboard closed - reset
      if (mainContainer) {
        mainContainer.style.bottom = ""
      }
      if (mobileToolbar) {
        mobileToolbar.style.bottom = ""
        mobileToolbar.style.paddingBottom = ""
      }
    }

    // Refit terminal
    handleResize()
  }

  window.visualViewport.addEventListener("resize", () => {
    const currentHeight = window.visualViewport!.height

    if (Math.abs(currentHeight - lastHeight) > 50) {
      adjustForKeyboard()
      lastHeight = currentHeight
    }
  })

  window.visualViewport.addEventListener("scroll", adjustForKeyboard)
}

// Add tab button click handler
addTabBtn.addEventListener("click", () => {
  createTab()
})

// Handle beforeunload
window.addEventListener("beforeunload", () => {
  tabs.forEach(tab => tab.ws.close())
})

// Keyboard shortcuts
window.addEventListener("keydown", e => {
  // Ctrl+Shift+T: New tab
  if (e.ctrlKey && e.shiftKey && e.key === "T") {
    e.preventDefault()
    createTab()
  }
  // Ctrl+Shift+W: Close tab
  if (e.ctrlKey && e.shiftKey && e.key === "W") {
    e.preventDefault()
    if (activeTabId && tabs.length > 1) {
      closeTab(activeTabId)
    }
  }
  // Ctrl+Tab: Next tab
  if (e.ctrlKey && e.key === "Tab" && !e.shiftKey) {
    e.preventDefault()
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const nextIndex = (currentIndex + 1) % tabs.length
    switchToTab(tabs[nextIndex].id)
  }
  // Ctrl+Shift+Tab: Previous tab
  if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
    e.preventDefault()
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
    switchToTab(tabs[prevIndex].id)
  }
})

// Mobile toolbar button handlers
function sendToActiveTerminal(data: string) {
  const activeTab = tabs.find(t => t.id === activeTabId)
  if (activeTab && activeTab.ws.readyState === WebSocket.OPEN) {
    activeTab.ws.send(JSON.stringify({ type: "input", data }))
  }
}

function setupMobileToolbar() {
  const btnCtrlC = document.getElementById("btn-ctrl-c")
  const btnEsc = document.getElementById("btn-esc")
  const btnTab = document.getElementById("btn-tab")
  const btnScrollUp = document.getElementById("btn-scroll-up")
  const btnScrollDown = document.getElementById("btn-scroll-down")
  const btnPaste = document.getElementById("btn-paste")
  const btnKeyboard = document.getElementById("btn-keyboard")

  btnCtrlC?.addEventListener("click", () => sendToActiveTerminal("\x03"))
  btnEsc?.addEventListener("click", () => sendToActiveTerminal("\x1b"))
  btnTab?.addEventListener("click", () => sendToActiveTerminal("\t"))

  // Scroll buttons - scroll the terminal viewport
  btnScrollUp?.addEventListener("click", () => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab) {
      activeTab.terminal.scrollLines(-5)
    }
  })
  btnScrollDown?.addEventListener("click", () => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab) {
      activeTab.terminal.scrollLines(5)
    }
  })

  btnPaste?.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText()
      sendToActiveTerminal(text)
    } catch {
      // Fallback: prompt for text
      const text = prompt("Paste text:")
      if (text) sendToActiveTerminal(text)
    }
  })

  // Keyboard toggle - focus terminal to show keyboard
  btnKeyboard?.addEventListener("click", () => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab) {
      activeTab.terminal.focus()
      // On iOS, we need to trigger a textarea focus
      const textarea = activeTab.element.querySelector("textarea")
      if (textarea) {
        textarea.focus()
      }
    }
  })
}

// Mobile swipe gesture handling
function setupSwipeGestures() {
  if (!isMobile) return

  let touchStartX = 0
  let touchStartY = 0
  let isSwiping = false

  shellContainer?.addEventListener(
    "touchstart",
    e => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
      isSwiping = false
    },
    { passive: true },
  )

  shellContainer?.addEventListener(
    "touchmove",
    e => {
      if (tabs.length <= 1) return

      const deltaX = e.touches[0].clientX - touchStartX
      const deltaY = e.touches[0].clientY - touchStartY

      // Only trigger if horizontal movement is dominant
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
        isSwiping = true
        if (swipeIndicator) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId)

          if (deltaX > 0 && currentIndex > 0) {
            swipeIndicator.textContent = `← ${tabs[currentIndex - 1].name}`
            swipeIndicator.className = "left"
            swipeIndicator.style.display = "block"
          } else if (deltaX < 0 && currentIndex < tabs.length - 1) {
            swipeIndicator.textContent = `${tabs[currentIndex + 1].name} →`
            swipeIndicator.className = "right"
            swipeIndicator.style.display = "block"
          } else {
            swipeIndicator.style.display = "none"
          }
        }
      }
    },
    { passive: true },
  )

  shellContainer?.addEventListener("touchend", e => {
    if (!isSwiping || tabs.length <= 1) {
      if (swipeIndicator) swipeIndicator.style.display = "none"
      return
    }

    const deltaX = e.changedTouches[0].clientX - touchStartX
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)

    if (Math.abs(deltaX) > 80) {
      if (deltaX > 0 && currentIndex > 0) {
        switchToTab(tabs[currentIndex - 1].id)
      } else if (deltaX < 0 && currentIndex < tabs.length - 1) {
        switchToTab(tabs[currentIndex + 1].id)
      }
    }

    if (swipeIndicator) swipeIndicator.style.display = "none"
    isSwiping = false
  })
}

// Initialize mobile features
setupMobileToolbar()
setupSwipeGestures()

// Create initial tab
createTab()

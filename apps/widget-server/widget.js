/**
 * Claude Bridge Widget - Ultra-minimal injectable interface
 * Optimized for <3KB gzipped
 */
;(function () {
  "use strict"

  // Config from script tag
  const script = document.currentScript || document.querySelector('script[src*="widget"]')
  const config = {
    workspace: script?.dataset.workspace || "auto",
    position: script?.dataset.position || "bottom-right",
    api: script?.dataset.api || window.location.origin,
  }

  // Widget state
  let isOpen = false
  let authed = false
  let messages = []
  let busy = false

  // Create minimal styles
  const css = `
.cw{position:fixed;z-index:9999;font-family:system-ui,sans-serif}
.cw-btn{position:fixed;${config.position.includes("right") ? "right:20px" : "left:20px"};${config.position.includes("top") ? "top:20px" : "bottom:20px"};width:56px;height:56px;background:#000;border:0;border-radius:50%;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);font-size:20px;transition:transform .2s}
.cw-btn:hover{transform:scale(1.05)}
.cw-panel{position:fixed;${config.position.includes("right") ? "right:20px" : "left:20px"};${config.position.includes("top") ? "top:85px" : "bottom:85px"};width:320px;height:480px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden}
.cw-panel.open{display:flex}
.cw-header{background:#000;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:500}
.cw-close{background:0;border:0;color:#fff;cursor:pointer;font-size:16px}
.cw-ws{background:#f8f9fa;padding:6px 16px;font-size:11px;color:#666;border-bottom:1px solid #eee}
.cw-msgs{flex:1;overflow-y:auto;padding:12px}
.cw-form{border-top:1px solid #eee;padding:12px}
.cw-input{width:100%;min-height:60px;padding:8px;border:1px solid #ddd;border-radius:6px;resize:none;font-size:13px;font-family:inherit}
.cw-send{margin-top:6px;background:#000;color:#fff;border:0;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;float:right}
.cw-send:disabled{opacity:.5}
.cw-msg{margin-bottom:12px}
.cw-user{text-align:right}
.cw-user-bubble{display:inline-block;background:#007bff;color:#fff;padding:6px 10px;border-radius:12px;max-width:80%;font-size:13px}
.cw-asst{background:#f1f3f4;padding:8px;border-radius:8px;font-size:13px;line-height:1.4}
.cw-tool{background:#e8f5e8;color:#166534;padding:4px 8px;border-radius:4px;font-size:11px;margin:2px 0}
.cw-err{background:#fee;color:#c53030;padding:6px 8px;border-radius:4px;font-size:12px}
.cw-thinking{color:#666;font-style:italic;font-size:12px}
.cw-auth{padding:20px;text-align:center}
.cw-auth input{width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;margin:10px 0}
.cw-auth button{background:#000;color:#fff;border:0;padding:10px 20px;border-radius:6px;cursor:pointer;width:100%}
`

  // Inject styles
  const style = document.createElement("style")
  style.textContent = css
  document.head.appendChild(style)

  // API functions
  async function auth(pass) {
    try {
      const r = await fetch(`${config.api}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: pass }),
        credentials: "include",
      })
      return r.ok
    } catch {
      return false
    }
  }

  async function sendMsg(msg) {
    const body = config.workspace === "auto" ? { message: msg } : { message: msg, workspace: config.workspace }
    const r = await fetch(`${config.api}/api/claude/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.body
  }

  // Message rendering
  function renderMsg(msg) {
    const div = document.createElement("div")
    div.className = "cw-msg"

    if (msg.type === "user") {
      div.className += " cw-user"
      div.innerHTML = `<div class="cw-user-bubble">${esc(msg.content)}</div>`
    } else if (msg.type === "assistant") {
      div.innerHTML = `<div class="cw-asst">${esc(msg.content)}</div>`
    } else if (msg.type === "tool") {
      div.innerHTML = `<div class="cw-tool">🔧 ${msg.tool}: ${esc(msg.content)}</div>`
    } else if (msg.type === "error") {
      div.innerHTML = `<div class="cw-err">❌ ${esc(msg.content)}</div>`
    } else if (msg.type === "thinking") {
      div.innerHTML = `<div class="cw-thinking">Thinking...</div>`
    }

    return div
  }

  function esc(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  function updateMsgs() {
    const container = document.querySelector(".cw-msgs")
    container.innerHTML = ""
    messages.forEach(msg => container.appendChild(renderMsg(msg)))
    container.scrollTop = container.scrollHeight
  }

  // Stream processing
  async function processStream(stream, userMsg) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()

    messages.push({ type: "user", content: userMsg, id: Date.now() })
    updateMsgs()

    const thinking = { type: "thinking", content: "", id: Date.now() + 1 }
    messages.push(thinking)
    updateMsgs()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6))
              processEvent(event, thinking)
            } catch (e) {
              console.warn("Parse error:", line)
            }
          }
        }
      }
    } catch (err) {
      messages = messages.filter(m => m.id !== thinking.id)
      messages.push({ type: "error", content: err.message, id: Date.now() })
      updateMsgs()
    }
  }

  function processEvent(event, thinking) {
    if (event.type === "message") {
      const content = event.data.content

      if (content.type === "assistant" && content.message?.content) {
        messages = messages.filter(m => m.id !== thinking.id)

        content.message.content.forEach(item => {
          if (item.type === "text") {
            messages.push({
              type: "assistant",
              content: item.text,
              id: Date.now() + Math.random(),
            })
          } else if (item.type === "tool_use") {
            messages.push({
              type: "tool",
              tool: item.name,
              content: "Running...",
              id: Date.now() + Math.random(),
            })
          }
        })
        updateMsgs()
      }
    }
  }

  // Widget creation
  function createWidget() {
    const widget = document.createElement("div")
    widget.className = "cw"
    widget.innerHTML = `
            <button class="cw-btn">💬</button>
            <div class="cw-panel">
                <div class="cw-header">
                    <span>Claude</span>
                    <button class="cw-close">×</button>
                </div>
                ${config.workspace !== "auto" ? `<div class="cw-ws">Workspace: ${config.workspace}</div>` : ""}
                <div class="cw-content">
                    ${
                      !authed
                        ? `
                        <div class="cw-auth">
                            <h4>Authentication</h4>
                            <input type="password" placeholder="Passcode" class="cw-pass">
                            <button class="cw-login">Login</button>
                        </div>
                    `
                        : `
                        <div class="cw-msgs"></div>
                        <form class="cw-form">
                            <textarea class="cw-input" placeholder="Ask Claude..."></textarea>
                            <button type="submit" class="cw-send">Send</button>
                        </form>
                    `
                    }
                </div>
            </div>
        `

    document.body.appendChild(widget)
    setupEvents()
  }

  function setupEvents() {
    // Toggle
    document.querySelector(".cw-btn").onclick = () => {
      isOpen = !isOpen
      document.querySelector(".cw-panel").classList.toggle("open", isOpen)
    }

    // Close
    document.querySelector(".cw-close").onclick = () => {
      isOpen = false
      document.querySelector(".cw-panel").classList.remove("open")
    }

    // Auth
    const loginBtn = document.querySelector(".cw-login")
    if (loginBtn) {
      loginBtn.onclick = async () => {
        const pass = document.querySelector(".cw-pass").value
        if (await auth(pass)) {
          authed = true
          updateWidget()
        } else {
          alert("Auth failed")
        }
      }
    }

    // Send
    const form = document.querySelector(".cw-form")
    if (form) {
      form.onsubmit = async e => {
        e.preventDefault()
        const input = document.querySelector(".cw-input")
        const send = document.querySelector(".cw-send")
        const msg = input.value.trim()

        if (!msg || busy) return

        busy = true
        send.disabled = true
        input.value = ""

        try {
          const stream = await sendMsg(msg)
          await processStream(stream, msg)
        } catch (err) {
          messages.push({
            type: "error",
            content: err.message,
            id: Date.now(),
          })
          updateMsgs()
        }

        busy = false
        send.disabled = false
      }

      // Enter to send
      document.querySelector(".cw-input").onkeydown = e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          form.dispatchEvent(new Event("submit"))
        }
      }
    }
  }

  function updateWidget() {
    document.querySelector(".cw-content").innerHTML = `
            <div class="cw-msgs"></div>
            <form class="cw-form">
                <textarea class="cw-input" placeholder="Ask Claude..."></textarea>
                <button type="submit" class="cw-send">Send</button>
            </form>
        `
    setupEvents()
    updateMsgs()
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget)
  } else {
    createWidget()
  }

  // Global API
  window.ClaudeBridge = {
    open: () => {
      isOpen = true
      document.querySelector(".cw-panel").classList.add("open")
    },
    close: () => {
      isOpen = false
      document.querySelector(".cw-panel").classList.remove("open")
    },
    clear: () => {
      messages = []
      updateMsgs()
    },
  }
})()

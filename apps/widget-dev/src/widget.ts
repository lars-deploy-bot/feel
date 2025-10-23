/**
 * Claude Bridge Widget - TypeScript Development Version
 *
 * This is the main widget source file that gets built into the final widget.js
 */

interface WidgetConfig {
  workspace?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  api?: string
}

interface WidgetState {
  isOpen: boolean
  isAuthenticated: boolean
  messages: any[]
  isBusy: boolean
}

class ClaudeWidget {
  private config: WidgetConfig
  private state: WidgetState
  private elements: {
    button?: HTMLElement
    panel?: HTMLElement
    messagesContainer?: HTMLElement
    input?: HTMLTextAreaElement
  } = {}

  constructor(config: WidgetConfig = {}) {
    this.config = {
      workspace: config.workspace || 'auto',
      position: config.position || 'bottom-right',
      api: config.api || 'https://terminal.goalive.nl'
    }

    this.state = {
      isOpen: false,
      isAuthenticated: false,
      messages: [],
      isBusy: false
    }

    this.init()
  }

  private init() {
    this.injectStyles()
    this.createWidget()
    this.setupEventListeners()

    // Notify that widget is ready
    window.dispatchEvent(new CustomEvent('claude-widget-ready'))
  }

  private injectStyles() {
    const css = `
      .claude-widget {
        position: fixed;
        z-index: 9999;
        font-family: system-ui, sans-serif;
      }

      .claude-widget-button {
        position: fixed;
        ${this.config.position?.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        ${this.config.position?.includes('top') ? 'top: 20px;' : 'bottom: 20px;'}
        width: 56px;
        height: 56px;
        background: #000;
        border: 0;
        border-radius: 50%;
        color: #fff;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,.2);
        font-size: 20px;
        transition: transform .2s;
      }

      .claude-widget-button:hover {
        transform: scale(1.05);
      }

      .claude-widget-panel {
        position: fixed;
        ${this.config.position?.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        ${this.config.position?.includes('top') ? 'top: 85px;' : 'bottom: 85px;'}
        width: 320px;
        height: 480px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,.15);
        display: none;
        flex-direction: column;
        overflow: hidden;
      }

      .claude-widget-panel.open {
        display: flex;
      }

      /* Add more styles here */
    `

    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
  }

  private createWidget() {
    const widget = document.createElement('div')
    widget.className = 'claude-widget'

    widget.innerHTML = `
      <button class="claude-widget-button">💬</button>
      <div class="claude-widget-panel">
        <div class="claude-widget-header">
          <span>Claude</span>
          <button class="claude-widget-close">×</button>
        </div>
        <div class="claude-widget-content">
          <!-- Content will be added based on authentication state -->
        </div>
      </div>
    `

    document.body.appendChild(widget)

    // Store element references
    this.elements.button = widget.querySelector('.claude-widget-button')!
    this.elements.panel = widget.querySelector('.claude-widget-panel')!
  }

  private setupEventListeners() {
    // Toggle widget
    this.elements.button?.addEventListener('click', () => {
      this.toggle()
    })

    // Close widget
    this.elements.panel?.querySelector('.claude-widget-close')?.addEventListener('click', () => {
      this.close()
    })
  }

  // Public API
  public open() {
    this.state.isOpen = true
    this.elements.panel?.classList.add('open')
  }

  public close() {
    this.state.isOpen = false
    this.elements.panel?.classList.remove('open')
  }

  public toggle() {
    if (this.state.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  public clear() {
    this.state.messages = []
    this.updateMessages()
  }

  private updateMessages() {
    // Update messages display
    console.log('Messages updated:', this.state.messages)
  }

  // Authentication methods
  private async authenticate(passcode: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.api}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
        credentials: 'include'
      })

      if (response.ok) {
        this.state.isAuthenticated = true
        return true
      }
      return false
    } catch (error) {
      console.error('Authentication failed:', error)
      return false
    }
  }

  // Message sending
  private async sendMessage(message: string) {
    if (!this.state.isAuthenticated) {
      throw new Error('Not authenticated')
    }

    const requestBody = this.config.workspace === 'auto'
      ? { message }
      : { message, workspace: this.config.workspace }

    const response = await fetch(`${this.config.api}/api/claude/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return response.body
  }
}

// Auto-initialize if script tag found
function autoInit() {
  const script = document.currentScript as HTMLScriptElement ||
                 document.querySelector('script[src*="widget"]') as HTMLScriptElement

  if (script) {
    const config: WidgetConfig = {
      workspace: script.dataset.workspace,
      position: script.dataset.position as any,
      api: script.dataset.api
    }

    const widget = new ClaudeWidget(config)

    // Expose to global scope
    ;(window as any).ClaudeWidget = widget
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit)
} else {
  autoInit()
}

export { ClaudeWidget }
export type { WidgetConfig }
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

const widget = `/**
 * Alive Badge Widget — "The Secret"
 * Usage: <script src="https://alive.best/widget.js" defer></script>
 */
;(function () {
  "use strict"

  var i18n = {
    en: {
      badge: "alive",
      hook: "This site was built",
      hookEm: "by talking to it.",
      sub: "Describe what you want. Watch it happen live.",
      edit: "Edit this site",
      make: "Make your own"
    },
    pt: {
      badge: "alive",
      hook: "Este site foi construído",
      hookEm: "conversando com ele.",
      sub: "Descreva o que você quer. Veja acontecer ao vivo.",
      edit: "Editar este site",
      make: "Crie o seu"
    }
  }

  function detectLang() {
    var h = location.hostname.toLowerCase()
    if (h.includes("cafecomcacao") || h.includes(".com.br") || h.endsWith(".br")) return "pt"
    var bl = (navigator.language || "").slice(0, 2)
    return i18n[bl] ? bl : "en"
  }
  var L = i18n[detectLang()] || i18n.en
  var isOpen = false
  var popup = null
  var overlay = null
  var badge = null
  var isMobile = window.innerWidth < 640

  function injectStyles() {
    var s = document.createElement("style")
    s.textContent =
      "@keyframes aliveGlow{0%,100%{box-shadow:0 0 4px 1px rgba(52,211,153,.2),0 0 8px 2px rgba(52,211,153,.1)}50%{box-shadow:0 0 8px 3px rgba(52,211,153,.4),0 0 16px 6px rgba(52,211,153,.15)}}" +
      "@keyframes aliveUp{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}" +
      "@keyframes aliveReveal{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}"
    document.head.appendChild(s)
  }

  function createBadge() {
    injectStyles()
    badge = document.createElement("button")
    badge.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:9999;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;border:1px solid rgba(228,228,231,.5);background:#fff;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;transition:all .3s;box-shadow:none;outline:none"
    badge.innerHTML =
      '<span style="display:inline-flex;width:8px;height:8px;border-radius:50%;background:#34d399;animation:aliveGlow 3s ease-in-out infinite;flex-shrink:0"></span>' +
      '<span style="font-size:11px;font-weight:500;color:#a1a1aa;transition:color .3s">' + L.badge + '</span>'
    badge.onmouseover = function () {
      this.style.borderColor = "rgba(167,243,208,.6)"
      this.style.boxShadow = "0 0 12px rgba(52,211,153,.15)"
      this.querySelector("span:last-child").style.color = "#047857"
    }
    badge.onmouseout = function () {
      if (isOpen) return
      this.style.borderColor = "rgba(228,228,231,.5)"
      this.style.boxShadow = "none"
      this.querySelector("span:last-child").style.color = "#a1a1aa"
    }
    badge.onclick = function (e) { e.preventDefault(); e.stopPropagation(); toggle() }
    document.body.appendChild(badge)
  }

  function toggle() {
    if (isOpen) { close(); return }
    isMobile = window.innerWidth < 640

    var hostname = window.location.hostname
    var editUrl = "https://app.alive.best/chat?wk=" + encodeURIComponent(hostname)

    // Overlay
    overlay = document.createElement("div")
    overlay.style.cssText = "position:fixed;inset:0;z-index:9997;" + (isMobile ? "background:rgba(0,0,0,.2)" : "")
    overlay.onclick = close

    // Popup container
    popup = document.createElement("div")
    if (isMobile) {
      popup.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:9998;animation:aliveUp .3s cubic-bezier(.16,1,.3,1) both"
    } else {
      popup.style.cssText = "position:fixed;bottom:48px;right:12px;width:280px;z-index:9998;animation:aliveUp .3s cubic-bezier(.16,1,.3,1) both"
    }

    // Card
    var card = document.createElement("div")
    var radius = isMobile ? "16px 16px 0 0" : "16px"
    card.style.cssText = "border-radius:" + radius + ";background:#09090b;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;" +
      (isMobile
        ? "border-top:1px solid rgba(255,255,255,.06);box-shadow:0 -8px 40px rgba(0,0,0,.3)"
        : "border:1px solid rgba(255,255,255,.06);box-shadow:0 20px 60px rgba(0,0,0,.4)")

    // Inner content
    var inner = document.createElement("div")
    inner.style.cssText = "padding:20px"

    // Headline
    var h = document.createElement("p")
    h.style.cssText = "margin:0;font-size:15px;color:#fff;font-weight:500;line-height:1.4;letter-spacing:-.01em;animation:aliveReveal .3s ease-out .1s both"
    h.innerHTML = L.hook + '<br><em style="font-style:normal;color:#34d399">' + L.hookEm + '</em>'
    inner.appendChild(h)

    // Subtext
    var sub = document.createElement("p")
    sub.style.cssText = "margin:12px 0 0;font-size:12px;color:#71717a;line-height:1.5;animation:aliveReveal .3s ease-out .35s both"
    sub.textContent = L.sub
    inner.appendChild(sub)

    // CTA container
    var ctas = document.createElement("div")
    ctas.style.cssText = "margin-top:20px;display:flex;flex-direction:column;gap:8px;animation:aliveReveal .3s ease-out .5s both"

    // Edit CTA
    var py = isMobile ? "12px" : "10px"
    var a1 = document.createElement("a")
    a1.href = editUrl
    a1.target = "_blank"
    a1.rel = "noopener noreferrer"
    a1.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:" + py + " 16px;border-radius:12px;background:rgba(52,211,153,.1);text-decoration:none;transition:background .2s"
    a1.innerHTML =
      '<span style="font-size:13px;font-weight:500;color:#34d399;transition:color .2s">' + L.edit + '</span>' +
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M6 4l4 4-4 4" stroke="rgba(52,211,153,.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    a1.onmouseover = function () { this.style.background = "rgba(52,211,153,.15)"; this.querySelector("path").setAttribute("stroke","rgba(52,211,153,.8)") }
    a1.onmouseout = function () { this.style.background = "rgba(52,211,153,.1)"; this.querySelector("path").setAttribute("stroke","rgba(52,211,153,.5)") }
    ctas.appendChild(a1)

    // Make your own CTA
    var a2 = document.createElement("a")
    a2.href = "https://app.alive.best/chat"
    a2.target = "_blank"
    a2.rel = "noopener noreferrer"
    a2.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:" + py + " 16px;border-radius:12px;text-decoration:none;transition:background .2s"
    a2.innerHTML =
      '<span style="font-size:12px;color:#52525b;transition:color .2s">' + L.make + '</span>' +
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M6 4l4 4-4 4" stroke="#3f3f46" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    a2.onmouseover = function () { this.style.background = "rgba(255,255,255,.03)"; this.querySelector("span").style.color = "#a1a1aa" }
    a2.onmouseout = function () { this.style.background = "none"; this.querySelector("span").style.color = "#52525b" }
    ctas.appendChild(a2)

    inner.appendChild(ctas)
    card.appendChild(inner)

    // Safe area spacer for mobile home indicator
    if (isMobile) {
      var safe = document.createElement("div")
      safe.style.cssText = "height:env(safe-area-inset-bottom)"
      card.appendChild(safe)
    }

    popup.appendChild(card)
    document.body.appendChild(overlay)
    document.body.appendChild(popup)
    isOpen = true

    // Update badge state
    if (badge) {
      badge.style.borderColor = "rgba(167,243,208,.6)"
      badge.style.boxShadow = "0 0 12px rgba(52,211,153,.15)"
      badge.querySelector("span:last-child").style.color = "#047857"
    }
  }

  function close() {
    if (popup) { popup.remove(); popup = null }
    if (overlay) { overlay.remove(); overlay = null }
    isOpen = false
    if (badge) {
      badge.style.borderColor = "rgba(228,228,231,.5)"
      badge.style.boxShadow = "none"
      badge.querySelector("span:last-child").style.color = "#a1a1aa"
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createBadge)
  } else {
    createBadge()
  }
})();`

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "5050"
	}

	// Widget endpoint
	http.HandleFunc("/widget.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=3600") // 1 hour cache
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Write([]byte(widget))
	})

	// Health check
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","time":"%s"}`, time.Now().UTC().Format(time.RFC3339))
	})

	// Root redirect
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		http.Redirect(w, r, "https://alive.best", http.StatusFound)
	})

	log.Printf("Widget server starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

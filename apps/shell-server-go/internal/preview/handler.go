package preview

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"html"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"shell-server-go/internal/sentryx"

	"github.com/getsentry/sentry-go"
	"github.com/golang-jwt/jwt/v5"
)

// Handler is the HTTP handler for preview proxy requests.
type Handler struct {
	cfg              Config
	ports            *portMap
	sandboxes        *sandboxMap
	transport        http.RoundTripper
	sandboxTransport http.RoundTripper
}

// NewHandler creates a preview proxy handler. Returns nil if cfg is nil (disabled).
func NewHandler(cfg *Config) *Handler {
	if cfg == nil {
		return nil
	}

	ports := newPortMap(cfg.PortMapPath)
	sandboxes := newSandboxMap(cfg.SandboxMapPath)

	log.Printf("[preview] enabled (previewBase=%s, %d domains, %d sandboxes)",
		cfg.PreviewBase, ports.count(), sandboxes.count())

	return &Handler{
		cfg:       *cfg,
		ports:     ports,
		sandboxes: sandboxes,
		transport: &http.Transport{
			ForceAttemptHTTP2:  false,
			DisableCompression: true,
		},
		sandboxTransport: &http.Transport{
			ForceAttemptHTTP2:  false,
			DisableCompression: true,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true, //nolint:gosec // E2B internal certs
				MinVersion:         tls.VersionTLS13,
			},
		},
	}
}

// Reload triggers an immediate port-map + sandbox-map reload (e.g. on SIGHUP).
func (h *Handler) Reload() {
	if h == nil {
		return
	}
	h.ports.reload()
	h.sandboxes.reload()
}

// IsPreviewHost returns true if the host header indicates a preview request.
func IsPreviewHost(host string) bool {
	return strings.HasPrefix(host, previewPrefix)
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/health" {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"preview","time":"%s"}`, time.Now().UTC().Format(time.RFC3339))
		return
	}

	if h.cfg.ImagesStorage != "" && strings.HasPrefix(r.URL.Path, "/_images/") {
		h.serveImage(w, r)
		return
	}

	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}

	hostname, err := h.extractHostname(host)
	if err != nil {
		h.serveNotFound(w, host)
		return
	}

	// Auth: JWT query param or session cookie
	token := r.URL.Query().Get("preview_token")
	hasValidToken := token != "" && h.verifyToken(token)
	hasValidCookie := !hasValidToken && h.verifySessionCookie(r, hostname)

	if !hasValidToken && !hasValidCookie {
		writeHTTPError(w, http.StatusUnauthorized, "Missing or invalid preview_token", "preview auth failed")
		return
	}

	if hasValidToken {
		h.setSessionCookie(w, hostname)
	}

	q := r.URL.Query()
	q.Del("preview_token")
	r.URL.RawQuery = q.Encode()

	// Resolve backend
	var target *url.URL
	var transport http.RoundTripper

	if sbx, ok := h.sandboxes.lookup(hostname); ok {
		port := sbx.Port
		if port == 0 {
			port = h.cfg.DefaultSandboxPort
		}
		target = &url.URL{
			Scheme: "https",
			Host:   fmt.Sprintf("%d-%s.%s", port, sbx.SandboxID, sbx.E2BDomain),
		}
		transport = h.sandboxTransport
	} else if port, ok := h.ports.lookup(hostname); ok {
		target = &url.URL{
			Scheme: "http",
			Host:   fmt.Sprintf("localhost:%d", port),
		}
		transport = h.transport
	} else {
		writeHTTPError(w, http.StatusNotFound, "Site not found", "site port lookup failed")
		return
	}

	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(target)
			pr.Out.Host = target.Host
			pr.Out.Header.Set("X-Forwarded-Host", hostname)
			pr.Out.Header.Set("X-Forwarded-Proto", "https")
			pr.Out.Header.Del("Accept-Encoding")
			if strings.EqualFold(pr.In.Header.Get("Upgrade"), "websocket") &&
				HasWebSocketProtocol(pr.In.Header.Get("Sec-WebSocket-Protocol"), "vite-hmr") {
				pr.Out.Header.Del("Origin")
			}
		},
		Transport: transport,
		ModifyResponse: func(resp *http.Response) error {
			resp.Header.Del("X-Frame-Options")
			if len(h.cfg.FrameAncestors) > 0 {
				frameAncestors := fmt.Sprintf("frame-ancestors %s", strings.Join(h.cfg.FrameAncestors, " "))
				existing := resp.Header.Get("Content-Security-Policy")
				switch {
				case existing == "":
					resp.Header.Set("Content-Security-Policy", frameAncestors)
				case strings.Contains(strings.ToLower(existing), "frame-ancestors"):
					// keep upstream directive as source of truth
				default:
					resp.Header.Set("Content-Security-Policy", existing+"; "+frameAncestors)
				}
			}
			ct := resp.Header.Get("Content-Type")
			if strings.Contains(ct, "text/html") {
				if err := h.injectNavScript(resp); err != nil {
					return fmt.Errorf("inject nav script: %w", err)
				}
			}
			return nil
		},
		ErrorHandler: func(rw http.ResponseWriter, req *http.Request, err error) {
			sentryx.CaptureError(err, "reverse proxy error method=%s path=%s host=%s target=%s", req.Method, req.URL.Path, req.Host, target.String())
			writeHTTPError(rw, http.StatusBadGateway, "Bad gateway", "reverse proxy error")
		},
	}

	proxy.ServeHTTP(w, r)
}

// extractHostname converts "preview--notion-alive-best.alive.best" → "notion.alive.best"
func (h *Handler) extractHostname(host string) (string, error) {
	// Strip port if present (X-Forwarded-Host can include :port)
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}

	if !strings.HasPrefix(host, previewPrefix) {
		return "", fmt.Errorf("missing preview prefix")
	}

	rest := host[len(previewPrefix):]
	suffix := "." + h.cfg.PreviewBase
	if !strings.HasSuffix(rest, suffix) {
		return "", fmt.Errorf("invalid preview domain suffix")
	}

	label := rest[:len(rest)-len(suffix)]
	if label == "" {
		return "", fmt.Errorf("empty preview label")
	}

	return strings.ReplaceAll(label, "-", "."), nil
}

func (h *Handler) serveImage(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimPrefix(r.URL.Path, "/_images/")
	if relPath == "" {
		writeHTTPError(w, http.StatusNotFound, "Not found", "missing image path")
		return
	}

	cleanPath := filepath.Clean(relPath)
	if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) {
		writeHTTPError(w, http.StatusBadRequest, "Invalid path", "path traversal in image request")
		return
	}

	fullPath := filepath.Join(h.cfg.ImagesStorage, cleanPath)
	absPath, err := filepath.Abs(fullPath)
	baseAbs, baseErr := filepath.Abs(h.cfg.ImagesStorage)
	if err != nil || baseErr != nil {
		writeHTTPError(w, http.StatusBadRequest, "Invalid path", "failed to resolve image path")
		return
	}
	rel, relErr := filepath.Rel(baseAbs, absPath)
	if relErr != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		writeHTTPError(w, http.StatusBadRequest, "Invalid path", "invalid absolute image path")
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, fullPath)
}

func (h *Handler) verifyToken(tokenStr string) bool {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return h.cfg.JWTSecret, nil
	})
	if err != nil {
		return false
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return false
	}

	// Require explicit expiry — jwt v5 treats exp as optional by default
	expRaw, hasExp := claims["exp"]
	if !hasExp {
		return false
	}
	expFloat, ok := expRaw.(float64)
	if !ok || time.Now().Unix() >= int64(expFloat) {
		return false
	}

	tokenType, _ := claims["type"].(string)
	return tokenType == "preview"
}

func (h *Handler) injectNavScript(resp *http.Response) error {
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return err
	}

	lower := bytes.ToLower(body)
	idx := bytes.Index(lower, []byte("<head>"))
	if idx >= 0 {
		injection := []byte(navScript)
		insertAt := idx + len("<head>")
		modified := make([]byte, 0, len(body)+len(injection))
		modified = append(modified, body[:insertAt]...)
		modified = append(modified, injection...)
		modified = append(modified, body[insertAt:]...)
		body = modified
	}

	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(body)))
	resp.Header.Del("Content-Encoding")
	return nil
}

func (h *Handler) makeSessionValue(hostname string, expiry int64) string {
	mac := hmac.New(sha256.New, h.cfg.JWTSecret)
	mac.Write([]byte(fmt.Sprintf("%s|%d", hostname, expiry)))
	return fmt.Sprintf("%d.%s", expiry, hex.EncodeToString(mac.Sum(nil)))
}

func (h *Handler) setSessionCookie(w http.ResponseWriter, hostname string) {
	expiry := time.Now().Add(time.Duration(sessionMaxAge) * time.Second).Unix()
	value := h.makeSessionValue(hostname, expiry)
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   sessionMaxAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
	})
}

func (h *Handler) verifySessionCookie(r *http.Request, hostname string) bool {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil || cookie.Value == "" {
		return false
	}

	parts := strings.SplitN(cookie.Value, ".", 2)
	if len(parts) != 2 {
		return false
	}

	var expiry int64
	if _, err := fmt.Sscanf(parts[0], "%d", &expiry); err != nil {
		return false
	}

	if time.Now().Unix() > expiry {
		return false
	}

	expected := h.makeSessionValue(hostname, expiry)
	return hmac.Equal([]byte(cookie.Value), []byte(expected))
}

const notFoundHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%[1]s — Not Found</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%%3E%%3Ccircle cx='16' cy='16' r='12' fill='%%2351FF8C'/%%3E%%3C/svg%%3E">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#fafafa}
  .c{text-align:center;max-width:480px;padding:2.5rem 2rem}
  .i{width:48px;height:48px;margin:0 auto 1.5rem;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center}
  .i svg{width:22px;height:22px;color:#71717a}
  h1{font-size:1.25rem;font-weight:500;margin-bottom:.5rem;letter-spacing:-.01em}
  .s{font-size:.9rem;color:#71717a;line-height:1.6;margin-bottom:1.5rem}
  .d{font-family:"SF Mono","Fira Code",monospace;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:.15em .45em;border-radius:5px;font-size:.85em;color:#a1a1aa}
  .a{display:inline-flex;align-items:center;gap:.4rem;padding:.55rem 1.2rem;background:#fafafa;color:#09090b;border-radius:8px;font-size:.85rem;font-weight:500;text-decoration:none;transition:opacity .15s}
  .a:hover{opacity:.85}
  .a svg{width:14px;height:14px}
</style>
</head>
<body>
<div class="c">
  <div class="i"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg></div>
  <h1>This site doesn't exist yet</h1>
  <p class="s"><span class="d">%[1]s</span> isn't registered.</p>
  <a class="a" href="https://app.%[2]s">Build on %[2]s <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg></a>
</div>
</body>
</html>`

func (h *Handler) serveNotFound(w http.ResponseWriter, host string) {
	safe := html.EscapeString(host)
	baseDomain := html.EscapeString(h.cfg.PreviewBase)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	fmt.Fprintf(w, notFoundHTML, safe, baseDomain)
}

// HasWebSocketProtocol checks if a Sec-WebSocket-Protocol header value contains
// the given protocol. Exported for testing.
func HasWebSocketProtocol(header, protocol string) bool {
	for _, p := range strings.Split(header, ",") {
		if strings.EqualFold(strings.TrimSpace(p), protocol) {
			return true
		}
	}
	return false
}

func writeHTTPError(w http.ResponseWriter, statusCode int, body string, context string) {
	level := sentry.LevelError
	if statusCode < 500 {
		level = sentry.LevelWarning
	}
	sentryx.CaptureMessage(level, "http_error status=%d context=%s message=%s", statusCode, context, body)
	http.Error(w, body, statusCode)
}

package preview

import (
	"fmt"
	"html"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"strings"
	"testing"
)

func testRewrite(t *testing.T, target *url.URL, hostname string, inReq *http.Request) *http.Request {
	t.Helper()
	outReq := inReq.Clone(inReq.Context())
	pr := &httputil.ProxyRequest{In: inReq, Out: outReq}

	pr.SetURL(target)
	pr.Out.Host = "localhost"
	pr.Out.Header.Set("X-Forwarded-Host", hostname)
	pr.Out.Header.Set("X-Forwarded-Proto", "https")
	pr.Out.Header.Del("Accept-Encoding")
	if strings.EqualFold(pr.In.Header.Get("Upgrade"), "websocket") &&
		HasWebSocketProtocol(pr.In.Header.Get("Sec-WebSocket-Protocol"), "vite-hmr") {
		pr.Out.Header.Del("Origin")
	}

	return pr.Out
}

func newTarget(port int) *url.URL {
	return &url.URL{Scheme: "http", Host: fmt.Sprintf("localhost:%d", port)}
}

func newTestHandler() *Handler {
	return &Handler{cfg: Config{PreviewBase: "alive.best"}}
}

// --- IsPreviewHost ---

func TestIsPreviewHost(t *testing.T) {
	tests := []struct {
		host string
		want bool
	}{
		{"preview--mysite-alive-best.alive.best", true},
		{"preview--x.sonno.tech", true},
		{"mysite.alive.best", false},
		{"go.alive.best", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := IsPreviewHost(tt.host); got != tt.want {
			t.Errorf("IsPreviewHost(%q) = %v, want %v", tt.host, got, tt.want)
		}
	}
}

// --- HasWebSocketProtocol ---

func TestHasWebSocketProtocol(t *testing.T) {
	tests := []struct {
		header   string
		protocol string
		want     bool
	}{
		{"vite-hmr", "vite-hmr", true},
		{"Vite-HMR", "vite-hmr", true},
		{"graphql-ws, vite-hmr", "vite-hmr", true},
		{"foo, vite-hmr, bar", "vite-hmr", true},
		{"  vite-hmr  ", "vite-hmr", true},
		{"graphql-ws", "vite-hmr", false},
		{"", "vite-hmr", false},
		{"not-vite-hmr-extra", "vite-hmr", false},
		{"vite-hmr-v2", "vite-hmr", false},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("%q/%q", tt.header, tt.protocol), func(t *testing.T) {
			if got := HasWebSocketProtocol(tt.header, tt.protocol); got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}

// --- Rewrite ---

func TestRewrite_ViteHMR_StripsOrigin(t *testing.T) {
	req := httptest.NewRequest("GET", "/?token=abc", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Sec-WebSocket-Protocol", "vite-hmr")
	req.Header.Set("Origin", "https://preview--mysite-alive-best.alive.best")

	out := testRewrite(t, newTarget(3352), "mysite.alive.best", req)
	if out.Header.Get("Origin") != "" {
		t.Errorf("expected Origin stripped, got %q", out.Header.Get("Origin"))
	}
}

func TestRewrite_ViteHMR_CaseInsensitive(t *testing.T) {
	for _, val := range []string{"websocket", "WebSocket", "WEBSOCKET"} {
		t.Run(val, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.Header.Set("Upgrade", val)
			req.Header.Set("Sec-WebSocket-Protocol", "vite-hmr")
			req.Header.Set("Origin", "https://preview--x.alive.best")

			out := testRewrite(t, newTarget(3352), "x.alive.best", req)
			if out.Header.Get("Origin") != "" {
				t.Errorf("expected Origin stripped for Upgrade=%q", val)
			}
		})
	}
}

func TestRewrite_NonViteWebSocket_PreservesOrigin(t *testing.T) {
	origin := "https://preview--mysite-alive-best.alive.best"
	req := httptest.NewRequest("GET", "/socket.io/", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Origin", origin)

	out := testRewrite(t, newTarget(3352), "mysite.alive.best", req)
	if out.Header.Get("Origin") != origin {
		t.Errorf("expected Origin preserved, got %q", out.Header.Get("Origin"))
	}
}

func TestRewrite_SetsProxyHeaders(t *testing.T) {
	req := httptest.NewRequest("GET", "/about", nil)
	req.Header.Set("Accept-Encoding", "gzip, br")

	out := testRewrite(t, newTarget(3389), "example.alive.best", req)

	if out.Host != "localhost" {
		t.Errorf("Host = %q, want localhost", out.Host)
	}
	if v := out.Header.Get("X-Forwarded-Host"); v != "example.alive.best" {
		t.Errorf("X-Forwarded-Host = %q", v)
	}
	if v := out.Header.Get("X-Forwarded-Proto"); v != "https" {
		t.Errorf("X-Forwarded-Proto = %q", v)
	}
	if v := out.Header.Get("Accept-Encoding"); v != "" {
		t.Errorf("Accept-Encoding should be stripped, got %q", v)
	}
}

// --- serveNotFound ---

func TestServeNotFound_RendersCorrectly(t *testing.T) {
	h := newTestHandler()
	w := httptest.NewRecorder()
	h.serveNotFound(w, "unknown.alive.best")

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, "unknown.alive.best") {
		t.Error("body missing domain")
	}
	if !strings.Contains(body, "This site doesn") {
		t.Error("body missing heading")
	}
}

func TestServeNotFound_EscapesXSS(t *testing.T) {
	h := newTestHandler()
	w := httptest.NewRecorder()
	malicious := `<script>alert("xss")</script>.alive.best`
	h.serveNotFound(w, malicious)

	body := w.Body.String()
	if strings.Contains(body, "<script>") {
		t.Error("unescaped <script> tag")
	}
	if !strings.Contains(body, html.EscapeString(malicious)) {
		t.Error("missing escaped host")
	}
}

// --- extractHostname ---

func TestExtractHostname(t *testing.T) {
	h := newTestHandler()
	tests := []struct {
		host, want string
		wantErr    bool
	}{
		{"preview--mysite-alive-best.alive.best", "mysite.alive.best", false},
		{"preview--a-b-c.alive.best", "a.b.c", false},
		{"mysite.alive.best", "", true},
		{"preview--.alive.best", "", true},
		{"preview--x.sonno.tech", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.host, func(t *testing.T) {
			got, err := h.extractHostname(tt.host)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

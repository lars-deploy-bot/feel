package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"strings"
	"testing"
)

// testRewrite exercises the same Rewrite function used in ServeHTTP.
// It constructs a ProxyRequest, runs the rewrite, and returns the outgoing request.
func testRewrite(t *testing.T, target *url.URL, hostname string, inReq *http.Request) *http.Request {
	t.Helper()
	outReq := inReq.Clone(inReq.Context())
	pr := &httputil.ProxyRequest{In: inReq, Out: outReq}

	// This is the exact Rewrite function from ServeHTTP.
	pr.SetURL(target)
	pr.Out.Host = "localhost"
	pr.Out.Header.Set("X-Forwarded-Host", hostname)
	pr.Out.Header.Set("X-Forwarded-Proto", "https")
	pr.Out.Header.Del("Accept-Encoding")
	if strings.EqualFold(pr.In.Header.Get("Upgrade"), "websocket") &&
		hasWebSocketProtocol(pr.In.Header.Get("Sec-WebSocket-Protocol"), "vite-hmr") {
		pr.Out.Header.Del("Origin")
	}

	return pr.Out
}

func newTarget(port int) *url.URL {
	return &url.URL{Scheme: "http", Host: fmt.Sprintf("localhost:%d", port)}
}

// --- hasWebSocketProtocol tests ---

func TestHasWebSocketProtocol(t *testing.T) {
	tests := []struct {
		header   string
		protocol string
		want     bool
	}{
		// Exact match
		{"vite-hmr", "vite-hmr", true},
		// Case-insensitive
		{"Vite-HMR", "vite-hmr", true},
		{"VITE-HMR", "vite-hmr", true},
		// Comma-separated list
		{"graphql-ws, vite-hmr", "vite-hmr", true},
		{"vite-hmr, graphql-ws", "vite-hmr", true},
		{"foo, vite-hmr, bar", "vite-hmr", true},
		// With extra whitespace
		{"  vite-hmr  ", "vite-hmr", true},
		{"foo , vite-hmr , bar", "vite-hmr", true},
		// No match
		{"graphql-ws", "vite-hmr", false},
		{"", "vite-hmr", false},
		// Substring should NOT match (tokenized, not substring)
		{"not-vite-hmr-extra", "vite-hmr", false},
		{"vite-hmr-v2", "vite-hmr", false},
	}

	for _, tt := range tests {
		name := fmt.Sprintf("header=%q,protocol=%q", tt.header, tt.protocol)
		t.Run(name, func(t *testing.T) {
			got := hasWebSocketProtocol(tt.header, tt.protocol)
			if got != tt.want {
				t.Errorf("hasWebSocketProtocol(%q, %q) = %v, want %v", tt.header, tt.protocol, got, tt.want)
			}
		})
	}
}

// --- Rewrite tests ---

func TestRewrite_ViteHMR_StripsOrigin(t *testing.T) {
	target := newTarget(3352)
	req := httptest.NewRequest("GET", "/?token=abc", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Sec-WebSocket-Protocol", "vite-hmr")
	req.Header.Set("Origin", "https://preview--mysite-alive-best.alive.best")

	out := testRewrite(t, target, "mysite.alive.best", req)

	if out.Header.Get("Origin") != "" {
		t.Errorf("expected Origin to be stripped for vite-hmr, got %q", out.Header.Get("Origin"))
	}
}

func TestRewrite_ViteHMR_CaseInsensitiveUpgrade(t *testing.T) {
	target := newTarget(3352)

	for _, upgradeValue := range []string{"websocket", "WebSocket", "WEBSOCKET", "Websocket"} {
		t.Run(upgradeValue, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.Header.Set("Upgrade", upgradeValue)
			req.Header.Set("Sec-WebSocket-Protocol", "vite-hmr")
			req.Header.Set("Origin", "https://preview--x.alive.best")

			out := testRewrite(t, target, "x.alive.best", req)

			if out.Header.Get("Origin") != "" {
				t.Errorf("Upgrade=%q: expected Origin stripped, got %q", upgradeValue, out.Header.Get("Origin"))
			}
		})
	}
}

func TestRewrite_ViteHMR_InProtocolList(t *testing.T) {
	target := newTarget(3352)
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Sec-WebSocket-Protocol", "graphql-ws, vite-hmr")
	req.Header.Set("Origin", "https://preview--x.alive.best")

	out := testRewrite(t, target, "x.alive.best", req)

	if out.Header.Get("Origin") != "" {
		t.Errorf("expected Origin stripped when vite-hmr is in protocol list, got %q", out.Header.Get("Origin"))
	}
}

func TestRewrite_NonViteWebSocket_PreservesOrigin(t *testing.T) {
	target := newTarget(3352)
	origin := "https://preview--mysite-alive-best.alive.best"

	req := httptest.NewRequest("GET", "/socket.io/", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Origin", origin)

	out := testRewrite(t, target, "mysite.alive.best", req)

	if out.Header.Get("Origin") != origin {
		t.Errorf("expected Origin preserved for non-vite WS, got %q", out.Header.Get("Origin"))
	}
}

func TestRewrite_NonViteWebSocket_DifferentProtocol_PreservesOrigin(t *testing.T) {
	target := newTarget(3352)
	origin := "https://preview--mysite-alive-best.alive.best"

	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Sec-WebSocket-Protocol", "graphql-ws")
	req.Header.Set("Origin", origin)

	out := testRewrite(t, target, "mysite.alive.best", req)

	if out.Header.Get("Origin") != origin {
		t.Errorf("expected Origin preserved for graphql-ws, got %q", out.Header.Get("Origin"))
	}
}

func TestRewrite_RegularHTTP_PreservesOrigin(t *testing.T) {
	target := newTarget(3352)
	origin := "https://preview--mysite-alive-best.alive.best"

	req := httptest.NewRequest("GET", "/api/data", nil)
	req.Header.Set("Origin", origin)

	out := testRewrite(t, target, "mysite.alive.best", req)

	if out.Header.Get("Origin") != origin {
		t.Errorf("expected Origin preserved for regular HTTP, got %q", out.Header.Get("Origin"))
	}
}

func TestRewrite_SetsProxyHeaders(t *testing.T) {
	target := newTarget(3389)

	req := httptest.NewRequest("GET", "/about", nil)
	req.Header.Set("Accept-Encoding", "gzip, br")

	out := testRewrite(t, target, "example.alive.best", req)

	if out.Host != "localhost" {
		t.Errorf("expected Host=localhost, got %q", out.Host)
	}
	if out.Header.Get("X-Forwarded-Host") != "example.alive.best" {
		t.Errorf("expected X-Forwarded-Host=example.alive.best, got %q", out.Header.Get("X-Forwarded-Host"))
	}
	if out.Header.Get("X-Forwarded-Proto") != "https" {
		t.Errorf("expected X-Forwarded-Proto=https, got %q", out.Header.Get("X-Forwarded-Proto"))
	}
	if out.Header.Get("Accept-Encoding") != "" {
		t.Errorf("expected Accept-Encoding stripped, got %q", out.Header.Get("Accept-Encoding"))
	}
}

// --- extractHostname tests ---

func TestExtractHostname(t *testing.T) {
	h := &previewHandler{cfg: config{PreviewBase: "alive.best"}}

	tests := []struct {
		host     string
		expected string
		wantErr  bool
	}{
		{"preview--mysite-alive-best.alive.best", "mysite.alive.best", false},
		{"preview--a-b-c.alive.best", "a.b.c", false},
		{"mysite.alive.best", "", true},     // no prefix
		{"preview--.alive.best", "", true},  // empty label
		{"preview--x.sonno.tech", "", true}, // wrong suffix
	}

	for _, tt := range tests {
		t.Run(tt.host, func(t *testing.T) {
			got, err := h.extractHostname(tt.host)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error for %q, got %q", tt.host, got)
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error for %q: %v", tt.host, err)
				return
			}
			if got != tt.expected {
				t.Errorf("extractHostname(%q) = %q, want %q", tt.host, got, tt.expected)
			}
		})
	}
}

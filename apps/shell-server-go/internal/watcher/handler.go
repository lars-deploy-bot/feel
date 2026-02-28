package watcher

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"shell-server-go/internal/config"
	"shell-server-go/internal/httpx/response"
	workspacepkg "shell-server-go/internal/workspace"
)

// worktreeSlugRegex validates worktree slugs: lowercase alphanumeric + hyphens, 1-49 chars.
var worktreeSlugRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,48}$`)

const (
	watchLeaseTTL = 90 * time.Second
	writeTimeout  = 10 * time.Second
	pingInterval  = 30 * time.Second
	pongTimeout   = 5 * time.Minute
	batchInterval = 50 * time.Millisecond
)

// WatchLease authorizes a single WebSocket watch connection.
type WatchLease struct {
	Workspace string
	Cwd       string
	ExpiresAt time.Time
}

// WatchHandler handles file watch WebSocket connections.
type WatchHandler struct {
	config   *config.AppConfig
	resolver *workspacepkg.Resolver
	manager  *Manager
	upgrader websocket.Upgrader

	leaseMu sync.Mutex
	leases  map[string]WatchLease
}

// NewWatchHandler creates a new watch handler.
func NewWatchHandler(cfg *config.AppConfig, mgr *Manager) *WatchHandler {
	return &WatchHandler{
		config:   cfg,
		resolver: workspacepkg.NewResolver(cfg),
		manager:  mgr,
		leases:   make(map[string]WatchLease),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 4096,
			CheckOrigin: func(r *http.Request) bool {
				host := r.Host
				if idx := strings.LastIndex(host, ":"); idx != -1 {
					host = host[:idx]
				}
				origin := r.Header.Get("Origin")
				return isAllowedOrigin(origin, host)
			},
		},
	}
}

func isAllowedOrigin(origin, host string) bool {
	if origin == "" {
		return true
	}
	parsed, err := parseOriginHost(origin)
	if err != nil {
		return false
	}
	if parsed == host || parsed == "localhost" || parsed == "127.0.0.1" {
		return true
	}
	baseDomain := extractBaseDomain(host)
	return baseDomain != "" && (parsed == baseDomain || strings.HasSuffix(parsed, "."+baseDomain))
}

func parseOriginHost(origin string) (string, error) {
	// Simple origin parsing: scheme://host[:port]
	idx := strings.Index(origin, "://")
	if idx < 0 {
		return "", http.ErrNotSupported
	}
	host := origin[idx+3:]
	if portIdx := strings.LastIndex(host, ":"); portIdx != -1 {
		host = host[:portIdx]
	}
	return host, nil
}

func extractBaseDomain(host string) string {
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	parts := strings.Split(host, ".")
	if len(parts) < 2 {
		return ""
	}
	return parts[len(parts)-2] + "." + parts[len(parts)-1]
}

// CreateInternalLease issues a watch lease via internal API (X-Internal-Secret auth).
func (h *WatchHandler) CreateInternalLease(w http.ResponseWriter, r *http.Request) {
	secret := r.Header.Get("X-Internal-Secret")
	if secret == "" || subtle.ConstantTimeCompare([]byte(secret), []byte(h.config.ShellPassword)) != 1 {
		response.Error(w, http.StatusUnauthorized, "Invalid internal secret")
		return
	}

	var body struct {
		Workspace string `json:"workspace"`
		Worktree  string `json:"worktree,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	sw, err := workspacepkg.ResolveShellWorkspace(
		h.resolver,
		h.config.ResolvedDefaultCwd,
		h.config.ResolvedSitesPath,
		body.Workspace,
	)
	if err != nil {
		log.Error("Failed to resolve workspace for watch lease | workspace=%s err=%v", body.Workspace, err)
		response.Error(w, http.StatusBadRequest, "Invalid workspace")
		return
	}

	// If worktree slug is provided, resolve to worktree directory instead.
	watchCwd := sw.Cwd
	if body.Worktree != "" {
		resolved, resolveErr := resolveWorktreeCwd(sw.Cwd, body.Worktree, h.config.ResolvedSitesPath)
		if resolveErr != nil {
			log.Error("Failed to resolve worktree | workspace=%s worktree=%s err=%v", body.Workspace, body.Worktree, resolveErr)
			response.Error(w, http.StatusBadRequest, "Invalid worktree")
			return
		}
		watchCwd = resolved
	}

	// Validate directory exists
	dirInfo, err := os.Stat(watchCwd)
	if err != nil || !dirInfo.IsDir() {
		response.Error(w, http.StatusNotFound, "Workspace not found")
		return
	}

	token, err := generateToken()
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to create watch lease")
		return
	}

	lease := WatchLease{
		Workspace: sw.Workspace,
		Cwd:       watchCwd,
		ExpiresAt: time.Now().Add(watchLeaseTTL),
	}

	h.leaseMu.Lock()
	h.pruneExpiredLocked(time.Now())
	h.leases[token] = lease
	h.leaseMu.Unlock()

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"lease":     token,
		"workspace": lease.Workspace,
		"expiresAt": lease.ExpiresAt.UnixMilli(),
	})
}

// Handle upgrades the connection to WebSocket and streams file change events.
func (h *WatchHandler) Handle(w http.ResponseWriter, r *http.Request) {
	leaseToken := strings.TrimSpace(r.URL.Query().Get("lease"))
	if leaseToken == "" {
		response.Error(w, http.StatusUnauthorized, "Missing lease")
		return
	}

	lease, ok := h.consumeLease(leaseToken)
	if !ok {
		response.Error(w, http.StatusUnauthorized, "Invalid or expired lease")
		return
	}

	// Defense-in-depth: re-validate workspace boundary for site workspaces
	if lease.Workspace != "root" {
		if err := workspacepkg.ValidateSiteWorkspaceBoundary(lease.Cwd, h.config.ResolvedSitesPath); err != nil {
			log.Warn("Watch workspace boundary re-validation failed: %v", err)
			response.Error(w, http.StatusForbidden, "Invalid workspace")
			return
		}
	}

	// Validate directory still exists
	dirInfo, err := os.Stat(lease.Cwd)
	if err != nil || !dirInfo.IsDir() {
		response.Error(w, http.StatusNotFound, "Workspace not found")
		return
	}

	// Ensure proxy chain preserves WebSocket stream behavior
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Cache-Control", "no-cache, no-transform")

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error("Watch WebSocket upgrade failed: %v", err)
		return
	}

	log.Info("Watch connection opened | workspace=%s cwd=%s", lease.Workspace, lease.Cwd)

	watcher, err := h.manager.Acquire(lease.Cwd)
	if err != nil {
		log.Error("Failed to acquire watcher: %v", err)
		sendJSON(conn, map[string]string{"type": "error", "message": "Failed to start file watcher"})
		conn.Close()
		return
	}

	ch := watcher.Subscribe()

	// Send connected message
	sendJSON(conn, map[string]interface{}{
		"type":      "connected",
		"watchRoot": "user/",
	})

	// Setup ping/pong
	conn.SetReadDeadline(time.Now().Add(pongTimeout))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongTimeout))
		return nil
	})

	done := make(chan struct{})
	writerDone := make(chan struct{})

	// Reader goroutine: detect close + handle pongs.
	// Limit inbound frames to 4KB — watcher only processes pongs, no payload needed.
	conn.SetReadLimit(4096)
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	// Writer goroutine: batch events and send
	go func() {
		defer close(writerDone)
		pingTicker := time.NewTicker(pingInterval)
		batchTicker := time.NewTicker(batchInterval)
		defer pingTicker.Stop()
		defer batchTicker.Stop()

		var batch []Event

		for {
			select {
			case ev, ok := <-ch:
				if !ok {
					return // watcher closed
				}
				batch = append(batch, ev)

			case <-batchTicker.C:
				if len(batch) == 0 {
					continue
				}
				toSend := batch
				batch = nil
				conn.SetWriteDeadline(time.Now().Add(writeTimeout))
				err := conn.WriteJSON(map[string]interface{}{
					"type":   "fs_event",
					"events": toSend,
				})
				if err != nil {
					log.Debug("Watch WebSocket write failed: %v", err)
					return
				}

			case <-pingTicker.C:
				conn.SetWriteDeadline(time.Now().Add(writeTimeout))
				err := conn.WriteMessage(websocket.PingMessage, nil)
				if err != nil {
					return
				}

			case <-done:
				return
			}
		}
	}()

	// Wait for either reader or writer to finish — whichever exits first triggers cleanup.
	select {
	case <-done:
		// Reader exited (client disconnected or pong timeout)
	case <-writerDone:
		// Writer exited (write error) — close conn to unblock reader
		conn.Close()
		<-done
	}

	// Cleanup
	watcher.Unsubscribe(ch)
	h.manager.Release(lease.Cwd)
	conn.Close() // safe to call multiple times

	log.Info("Watch connection closed | workspace=%s", lease.Workspace)
}

// resolveWorktreeCwd validates a worktree slug and returns its directory path.
// baseCwd is the workspace user/ directory (e.g. /srv/webalive/sites/example.com/user/).
// Worktrees live at <siteRoot>/worktrees/<slug>/ where siteRoot is the parent of baseCwd.
func resolveWorktreeCwd(baseCwd, slug, sitesPath string) (string, error) {
	if !worktreeSlugRegex.MatchString(slug) {
		return "", fmt.Errorf("invalid worktree slug: %q", slug)
	}
	// Reserved slugs that would collide with existing directories
	switch slug {
	case "user", "worktrees":
		return "", fmt.Errorf("reserved worktree slug: %q", slug)
	}

	siteRoot := filepath.Dir(baseCwd) // e.g. /srv/webalive/sites/example.com/
	worktreePath := filepath.Join(siteRoot, "worktrees", slug)

	// Resolve symlinks and validate path is within sites boundary
	resolved, err := filepath.EvalSymlinks(worktreePath)
	if err != nil {
		return "", fmt.Errorf("worktree path does not exist: %w", err)
	}

	if err := workspacepkg.ValidateSiteWorkspaceBoundary(resolved, sitesPath); err != nil {
		return "", fmt.Errorf("worktree path outside boundary: %w", err)
	}

	return resolved, nil
}

func (h *WatchHandler) consumeLease(token string) (WatchLease, bool) {
	now := time.Now()

	h.leaseMu.Lock()
	lease, ok := h.leases[token]
	if ok {
		delete(h.leases, token) // single-use
	}
	h.pruneExpiredLocked(now)
	h.leaseMu.Unlock()

	if !ok || now.After(lease.ExpiresAt) {
		return WatchLease{}, false
	}
	return lease, true
}

func (h *WatchHandler) pruneExpiredLocked(now time.Time) {
	for token, lease := range h.leases {
		if now.After(lease.ExpiresAt) {
			delete(h.leases, token)
		}
	}
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func sendJSON(conn *websocket.Conn, v interface{}) error {
	conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	return conn.WriteJSON(v)
}

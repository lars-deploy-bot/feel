package preview

import (
	"log"
	"os"
	"strings"
)

const (
	previewPrefix     = "preview--"
	sessionCookieName = "__alive_preview"
	sessionMaxAge     = 300 // 5 minutes (matches JWT expiry)
)

// Config holds configuration for the preview proxy handler.
type Config struct {
	PreviewBase        string   // e.g. "alive.best"
	FrameAncestors     []string // e.g. ["https://app.alive.best", ...]
	JWTSecret          []byte
	PortMapPath        string
	SandboxMapPath     string
	ImagesStorage      string // e.g. "/srv/webalive/storage" — serves /_images/* directly
	DefaultSandboxPort int    // default port for E2B sandbox dev servers (e.g. 5173)
}

// LoadConfig builds a Config from environment variables.
// Returns nil if PREVIEW_BASE is not set (preview proxy disabled).
// Fatals if PREVIEW_BASE is set but other required vars are missing.
func LoadConfig() *Config {
	previewBase := os.Getenv("PREVIEW_BASE")
	if previewBase == "" {
		return nil
	}

	jwtSecret := requireEnv("JWT_SECRET", "PREVIEW_BASE is set")
	portMapPath := requireEnv("PORT_MAP_PATH", "PREVIEW_BASE is set")
	imagesStorage := requireEnv("IMAGES_STORAGE", "PREVIEW_BASE is set")
	ancestorsStr := requireEnv("FRAME_ANCESTORS", "PREVIEW_BASE is set")
	var ancestors []string
	if ancestorsStr != "" {
		for _, a := range strings.Split(ancestorsStr, ",") {
			if trimmed := strings.TrimSpace(a); trimmed != "" {
				ancestors = append(ancestors, trimmed)
			}
		}
	}

	return &Config{
		PreviewBase:        previewBase,
		FrameAncestors:     ancestors,
		JWTSecret:          []byte(jwtSecret),
		PortMapPath:        portMapPath,
		SandboxMapPath:     os.Getenv("SANDBOX_MAP_PATH"), // optional, sandbox-map.json may not exist
		ImagesStorage:      imagesStorage,
		DefaultSandboxPort: 5173,
	}
}

func requireEnv(key, because string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("FATAL: %s is required (%s)", key, because)
	}
	return v
}

// Enabled reports whether the preview handler should be created.
// Useful for callers that want to check without loading full config.
func Enabled() bool {
	return os.Getenv("PREVIEW_BASE") != ""
}

// MustHaveEnv is a build-time assertion — call from main/init to
// verify all preview env vars are present when PREVIEW_BASE is set.
// This is intentionally redundant with LoadConfig so the crash
// happens at process start, not on first request.
func MustHaveEnv() {
	if !Enabled() {
		return
	}
	for _, key := range []string{"JWT_SECRET", "PORT_MAP_PATH", "IMAGES_STORAGE", "FRAME_ANCESTORS"} {
		if os.Getenv(key) == "" {
			log.Fatalf("FATAL: %s is required when PREVIEW_BASE is set", key)
		}
	}
}

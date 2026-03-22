package preview

import (
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"

	"shell-server-go/internal/sentryx"
)

const mapRefreshInterval = 30 * time.Second

// portMap caches hostname→port mappings, refreshed periodically from a JSON file.
type portMap struct {
	mu       sync.RWMutex
	ports    map[string]int
	filePath string
}

func newPortMap(filePath string) *portMap {
	pm := &portMap{filePath: filePath, ports: make(map[string]int)}
	pm.reload()
	if pm.count() == 0 {
		log.Printf("[port-map] WARNING: empty at startup — all requests will 404 until next refresh")
	}
	go pm.refreshLoop()
	return pm
}

func (pm *portMap) reload() {
	data, err := os.ReadFile(pm.filePath)
	if err != nil {
		sentryx.CaptureError(err, "port map read failed: %s", pm.filePath)
		log.Printf("[port-map] failed to read %s: %v", pm.filePath, err)
		return
	}
	var ports map[string]int
	if err := json.Unmarshal(data, &ports); err != nil {
		sentryx.CaptureError(err, "port map parse failed: %s", pm.filePath)
		log.Printf("[port-map] failed to parse %s: %v", pm.filePath, err)
		return
	}
	pm.mu.Lock()
	pm.ports = ports
	pm.mu.Unlock()
	log.Printf("[port-map] loaded %d domains", len(ports))
}

func (pm *portMap) refreshLoop() {
	ticker := time.NewTicker(mapRefreshInterval)
	defer ticker.Stop()
	for range ticker.C {
		pm.reload()
	}
}

func (pm *portMap) lookup(hostname string) (int, bool) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	port, ok := pm.ports[hostname]
	return port, ok
}

func (pm *portMap) count() int {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return len(pm.ports)
}

// sandboxEntry represents an E2B sandbox backend for a domain.
type sandboxEntry struct {
	SandboxID string `json:"sandboxId"`
	E2BDomain string `json:"e2bDomain"`
	Port      int    `json:"port"`
}

// sandboxMap caches hostname→sandbox mappings, refreshed alongside portMap.
type sandboxMap struct {
	mu       sync.RWMutex
	entries  map[string]sandboxEntry
	filePath string
}

func newSandboxMap(filePath string) *sandboxMap {
	sm := &sandboxMap{filePath: filePath, entries: make(map[string]sandboxEntry)}
	sm.reload()
	go sm.refreshLoop()
	return sm
}

func (sm *sandboxMap) reload() {
	data, err := os.ReadFile(sm.filePath)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("[sandbox-map] failed to read %s: %v", sm.filePath, err)
		}
		return
	}
	var entries map[string]sandboxEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		log.Printf("[sandbox-map] failed to parse %s: %v", sm.filePath, err)
		return
	}
	sm.mu.Lock()
	sm.entries = entries
	sm.mu.Unlock()
	if len(entries) > 0 {
		log.Printf("[sandbox-map] loaded %d sandbox domains", len(entries))
	}
}

func (sm *sandboxMap) refreshLoop() {
	ticker := time.NewTicker(mapRefreshInterval)
	defer ticker.Stop()
	for range ticker.C {
		sm.reload()
	}
}

func (sm *sandboxMap) lookup(hostname string) (sandboxEntry, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	entry, ok := sm.entries[hostname]
	return entry, ok
}

func (sm *sandboxMap) count() int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return len(sm.entries)
}

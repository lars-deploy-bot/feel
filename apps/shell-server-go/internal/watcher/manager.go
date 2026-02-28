package watcher

import (
	"fmt"
	"sync"
)

// Manager provides ref-counted per-workspace watcher lifecycle.
// Multiple browser tabs watching the same workspace share one inotify watcher.
type Manager struct {
	mu       sync.Mutex
	watchers map[string]*refCounted
	closed   bool
}

type refCounted struct {
	watcher  *WorkspaceWatcher
	refCount int
}

// NewManager creates a new watcher manager.
func NewManager() *Manager {
	return &Manager{
		watchers: make(map[string]*refCounted),
	}
}

// Acquire returns a watcher for the given root path, creating one if needed.
// Each call increments the reference count; callers must call Release when done.
func (m *Manager) Acquire(rootPath string) (*WorkspaceWatcher, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.closed {
		return nil, fmt.Errorf("watcher manager is shut down")
	}

	if rc, ok := m.watchers[rootPath]; ok {
		rc.refCount++
		log.Debug("Watcher reused | root=%s refs=%d", rootPath, rc.refCount)
		return rc.watcher, nil
	}

	w, err := newWorkspaceWatcher(rootPath)
	if err != nil {
		return nil, fmt.Errorf("create watcher for %s: %w", rootPath, err)
	}

	m.watchers[rootPath] = &refCounted{watcher: w, refCount: 1}
	log.Info("Watcher created | root=%s", rootPath)
	return w, nil
}

// Release decrements the reference count for a workspace watcher.
// When the count reaches zero, the watcher is closed and removed.
func (m *Manager) Release(rootPath string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	rc, ok := m.watchers[rootPath]
	if !ok {
		return
	}

	rc.refCount--
	log.Debug("Watcher released | root=%s refs=%d", rootPath, rc.refCount)

	if rc.refCount <= 0 {
		rc.watcher.Close()
		delete(m.watchers, rootPath)
	}
}

// Shutdown closes all watchers. Called during server shutdown.
func (m *Manager) Shutdown() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.closed = true
	for rootPath, rc := range m.watchers {
		rc.watcher.Close()
		delete(m.watchers, rootPath)
	}
	log.Info("All watchers shut down")
}

// Stats returns the number of active watchers and total subscribers.
func (m *Manager) Stats() (watchers int, totalRefs int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, rc := range m.watchers {
		watchers++
		totalRefs += rc.refCount
	}
	return
}

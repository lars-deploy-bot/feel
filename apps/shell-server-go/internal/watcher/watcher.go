package watcher

import (
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"shell-server-go/internal/logger"
	"shell-server-go/internal/workspace"
)

var log = logger.WithComponent("WATCHER")

// Event represents a file system change relative to the watch root.
type Event struct {
	Op    string `json:"op"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
}

const debounceDelay = 100 * time.Millisecond

// excludedDirs extends workspace.DefaultExcludedDirs with build-specific dirs.
var excludedDirs = func() map[string]bool {
	m := make(map[string]bool, len(workspace.DefaultExcludedDirs)+3)
	for k, v := range workspace.DefaultExcludedDirs {
		m[k] = v
	}
	m[".bun"] = true
	m[".cache"] = true
	m[".next"] = true
	return m
}()

// WorkspaceWatcher watches a workspace directory tree for file changes.
type WorkspaceWatcher struct {
	root    string
	watcher *fsnotify.Watcher

	mu          sync.Mutex
	subscribers map[chan Event]struct{}
	closed      bool

	// debounce: per-path timers that coalesce rapid events
	debounceMu    sync.Mutex
	debounce      map[string]*time.Timer
	debounceEvent map[string]*Event
}

func newWorkspaceWatcher(root string) (*WorkspaceWatcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	w := &WorkspaceWatcher{
		root:          root,
		watcher:       fsw,
		subscribers:   make(map[chan Event]struct{}),
		debounce:      make(map[string]*time.Timer),
		debounceEvent: make(map[string]*Event),
	}

	// Walk and add directories recursively (skip excluded)
	if err := w.addRecursive(root); err != nil {
		fsw.Close()
		return nil, err
	}

	go w.loop()

	log.Info("Started watcher | root=%s", root)
	return w, nil
}

func (w *WorkspaceWatcher) addRecursive(dir string) error {
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip unreadable
		}
		if !info.IsDir() {
			return nil
		}
		if excludedDirs[info.Name()] && path != dir {
			return filepath.SkipDir
		}
		return w.watcher.Add(path)
	})
}

func (w *WorkspaceWatcher) loop() {
	for {
		select {
		case ev, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			w.handleFSEvent(ev)

		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			log.Warn("fsnotify error | root=%s err=%v", w.root, err)
		}
	}
}

func (w *WorkspaceWatcher) handleFSEvent(ev fsnotify.Event) {
	// Determine if path is a directory (stat may fail for removes)
	isDir := false
	if info, err := os.Stat(ev.Name); err == nil {
		isDir = info.IsDir()
	}

	// Auto-add new directories (unless excluded)
	if ev.Has(fsnotify.Create) && isDir {
		base := filepath.Base(ev.Name)
		if !excludedDirs[base] {
			w.addRecursive(ev.Name)
		}
	}

	op := mapOp(ev.Op)
	if op == "" {
		return
	}

	relPath, err := filepath.Rel(w.root, ev.Name)
	if err != nil {
		return
	}
	// Normalize to forward slashes for consistent client-side handling
	relPath = filepath.ToSlash(relPath)

	// Debounce: coalesce rapid events on the same path.
	// Preserve the most significant op (create/remove/rename > modify)
	// so that a Create+Write pair doesn't downgrade to just "modify".
	w.debounceMu.Lock()
	if t, exists := w.debounce[relPath]; exists {
		t.Stop()
	}
	event := Event{Op: op, Path: relPath, IsDir: isDir}
	if prev, exists := w.debounceEvent[relPath]; exists && op == "modify" && prev.Op != "modify" {
		// Keep the more significant op (create, remove, rename) instead of modify
		event.Op = prev.Op
	}
	w.debounceEvent[relPath] = &event
	w.debounce[relPath] = time.AfterFunc(debounceDelay, func() {
		w.debounceMu.Lock()
		ev := w.debounceEvent[relPath]
		delete(w.debounce, relPath)
		delete(w.debounceEvent, relPath)
		w.debounceMu.Unlock()
		w.publish(*ev)
	})
	w.debounceMu.Unlock()
}

func mapOp(op fsnotify.Op) string {
	switch {
	case op.Has(fsnotify.Create):
		return "create"
	case op.Has(fsnotify.Write):
		return "modify"
	case op.Has(fsnotify.Remove):
		return "remove"
	case op.Has(fsnotify.Rename):
		return "rename"
	default:
		return ""
	}
}

func (w *WorkspaceWatcher) publish(ev Event) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return
	}
	for ch := range w.subscribers {
		select {
		case ch <- ev:
		default:
			// Drop if subscriber is slow — they'll refetch on reconnect
		}
	}
}

// Subscribe returns a channel that receives file change events.
// The caller must pass the same channel to Unsubscribe when done.
func (w *WorkspaceWatcher) Subscribe() chan Event {
	ch := make(chan Event, 64)
	w.mu.Lock()
	w.subscribers[ch] = struct{}{}
	w.mu.Unlock()
	return ch
}

// Unsubscribe removes a subscriber channel.
func (w *WorkspaceWatcher) Unsubscribe(ch chan Event) {
	w.mu.Lock()
	delete(w.subscribers, ch)
	w.mu.Unlock()
}

// Close shuts down the watcher.
func (w *WorkspaceWatcher) Close() {
	w.mu.Lock()
	if w.closed {
		w.mu.Unlock()
		return
	}
	w.closed = true
	for ch := range w.subscribers {
		close(ch)
	}
	w.subscribers = make(map[chan Event]struct{})
	w.mu.Unlock()

	// Stop all pending debounce timers to prevent callbacks firing after Close.
	w.debounceMu.Lock()
	for _, t := range w.debounce {
		t.Stop()
	}
	w.debounce = make(map[string]*time.Timer)
	w.debounceEvent = make(map[string]*Event)
	w.debounceMu.Unlock()

	w.watcher.Close()
	log.Info("Stopped watcher | root=%s", w.root)
}

package handlers

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

	"shell-server-go/internal/config"
	"shell-server-go/internal/logger"
)

const (
	// MaxZipEntries is the maximum number of files in a ZIP archive
	MaxZipEntries = 10000
	// MaxZipTotalSize is the maximum total uncompressed size of a ZIP archive (500MB)
	MaxZipTotalSize = 500 << 20
	// MaxZipCompressionRatio is the maximum compression ratio to prevent zip bombs
	MaxZipCompressionRatio = 100
)

var filesLog = logger.WithComponent("FILES")

// FileHandler handles file operations
type FileHandler struct {
	config *config.AppConfig
}

// NewFileHandler creates a new file handler
func NewFileHandler(cfg *config.AppConfig) *FileHandler {
	return &FileHandler{config: cfg}
}

// TreeNode represents a file tree node
type TreeNode struct {
	Text     string     `json:"text"`
	Icon     string     `json:"icon"`
	State    *NodeState `json:"state,omitempty"`
	Data     NodeData   `json:"data"`
	Children []TreeNode `json:"children,omitempty"`
}

// NodeState represents node state in tree
type NodeState struct {
	Opened bool `json:"opened"`
}

// NodeData represents node data
type NodeData struct {
	Path string `json:"path"`
	Type string `json:"type"`
}

// resolveBasePath resolves workspace to base path
func (h *FileHandler) resolveBasePath(workspace string) string {
	if strings.HasPrefix(workspace, "site:") {
		siteName := strings.TrimPrefix(workspace, "site:")
		return filepath.Join(h.config.ResolvedSitesPath, siteName, "user")
	} else if workspace == "root" {
		return h.config.ResolvedUploadCwd
	}
	return filepath.Join(h.config.ResolvedSitesPath, workspace)
}

// isPathSafe checks if path is within base
func isPathSafe(resolved, base string) bool {
	return strings.HasPrefix(resolved, base+string(os.PathSeparator)) || resolved == base
}

// resolveSafePath resolves a path safely, following symlinks and checking bounds
// Returns the resolved path if safe, or an error if unsafe
func resolveSafePath(basePath, userPath string) (string, error) {
	// First resolve the base path (follow symlinks)
	realBase, err := filepath.EvalSymlinks(basePath)
	if err != nil {
		// If base doesn't exist, use the absolute path
		realBase, err = filepath.Abs(basePath)
		if err != nil {
			return "", fmt.Errorf("invalid base path: %w", err)
		}
	}

	// Join and get absolute path
	joined := filepath.Join(basePath, userPath)
	absPath, err := filepath.Abs(joined)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}

	// Check for basic path traversal before following symlinks
	if !isPathSafe(absPath, realBase) {
		return "", fmt.Errorf("path traversal detected")
	}

	// If the path exists, resolve symlinks and check again
	if _, err := os.Lstat(absPath); err == nil {
		realPath, err := filepath.EvalSymlinks(absPath)
		if err != nil {
			return "", fmt.Errorf("cannot resolve path: %w", err)
		}
		// Check the real path is within base
		if !isPathSafe(realPath, realBase) {
			filesLog.Warn("Symlink escape attempt: %s -> %s (base: %s)", absPath, realPath, realBase)
			return "", fmt.Errorf("symlink escape detected")
		}
		return realPath, nil
	}

	// Path doesn't exist yet, return the absolute path
	return absPath, nil
}

// CheckDirectory handles POST /api/check-directory
func (h *FileHandler) CheckDirectory(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		if err := r.ParseForm(); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
	}

	workspace := r.FormValue("workspace")
	if workspace == "" {
		workspace = "root"
	}
	targetDir := r.FormValue("targetDir")
	if targetDir == "" {
		targetDir = "./"
	}

	basePath := h.resolveBasePath(workspace)
	resolvedTarget, err := filepath.Abs(filepath.Join(basePath, targetDir))
	if err != nil || !isPathSafe(resolvedTarget, basePath) {
		jsonError(w, "Path traversal detected", http.StatusBadRequest)
		return
	}

	_, err = os.Stat(resolvedTarget)
	exists := err == nil

	jsonResponse(w, map[string]interface{}{
		"exists":  exists,
		"path":    resolvedTarget,
		"message": fmt.Sprintf("Directory %s: %s", map[bool]string{true: "exists", false: "does not exist"}[exists], targetDir),
	})
}

// CreateDirectory handles POST /api/create-directory
func (h *FileHandler) CreateDirectory(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		if err := r.ParseForm(); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
	}

	workspace := r.FormValue("workspace")
	if workspace == "" {
		workspace = "root"
	}
	targetDir := r.FormValue("targetDir")
	if targetDir == "" {
		jsonError(w, "No directory path provided", http.StatusBadRequest)
		return
	}

	// Validate directory name - reject dangerous patterns
	if strings.Contains(targetDir, "..") {
		jsonError(w, "Invalid directory path", http.StatusBadRequest)
		return
	}

	basePath := h.resolveBasePath(workspace)
	resolvedTarget, err := filepath.Abs(filepath.Join(basePath, targetDir))
	if err != nil || !isPathSafe(resolvedTarget, basePath) {
		jsonError(w, "Path traversal detected", http.StatusBadRequest)
		return
	}

	// Check if already exists
	if info, err := os.Stat(resolvedTarget); err == nil {
		if info.IsDir() {
			jsonResponse(w, map[string]interface{}{
				"success": true,
				"message": fmt.Sprintf("Directory already exists: %s", targetDir),
				"path":    resolvedTarget,
				"created": false,
			})
			return
		}
		jsonError(w, "A file with that name already exists", http.StatusConflict)
		return
	}

	// Create the directory
	if err := os.MkdirAll(resolvedTarget, 0755); err != nil {
		filesLog.Error("Failed to create directory %s: %v", resolvedTarget, err)
		jsonError(w, "Failed to create directory", http.StatusInternalServerError)
		return
	}

	filesLog.Info("Created directory: %s", resolvedTarget)
	jsonResponse(w, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Created directory: %s", targetDir),
		"path":    resolvedTarget,
		"created": true,
	})
}

// Upload handles POST /api/upload
// Supports both ZIP files (extracted) and regular files (saved with optional custom name)
func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (100MB limit)
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		jsonError(w, "File too large (max 100MB)", http.StatusBadRequest)
		return
	}

	workspace := r.FormValue("workspace")
	if workspace == "" {
		workspace = "root"
	}
	targetDir := r.FormValue("targetDir")
	if targetDir == "" {
		targetDir = "./"
	}
	// Optional custom filename for non-ZIP files
	customName := r.FormValue("name")

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "No file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	originalFilename := header.Filename
	isZipFile := strings.HasSuffix(strings.ToLower(originalFilename), ".zip")

	basePath := h.resolveBasePath(workspace)
	resolvedTarget, err := filepath.Abs(filepath.Join(basePath, targetDir))
	if err != nil || !isPathSafe(resolvedTarget, basePath) {
		jsonError(w, "Path traversal detected", http.StatusBadRequest)
		return
	}

	// Save to temp file
	tempExt := filepath.Ext(originalFilename)
	tempFile, err := os.CreateTemp("", "upload-*"+tempExt)
	if err != nil {
		jsonError(w, "Failed to create temp file", http.StatusInternalServerError)
		return
	}
	tempPath := tempFile.Name()
	defer os.Remove(tempPath)

	if _, err := io.Copy(tempFile, file); err != nil {
		tempFile.Close()
		jsonError(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	tempFile.Close()

	// Handle non-ZIP files: save directly
	if !isZipFile {
		// Determine filename
		destFilename := originalFilename
		if customName != "" {
			destFilename = customName
		}

		// Validate filename
		if strings.Contains(destFilename, "/") || strings.Contains(destFilename, "\\") || destFilename == ".." {
			jsonError(w, "Invalid filename", http.StatusBadRequest)
			return
		}

		destPath := filepath.Join(resolvedTarget, destFilename)
		if !isPathSafe(destPath, basePath) {
			jsonError(w, "Path traversal detected", http.StatusBadRequest)
			return
		}

		// Check if file already exists
		if _, err := os.Stat(destPath); err == nil {
			jsonResponse(w, map[string]interface{}{
				"error":         "File already exists",
				"existingItems": []string{destFilename},
				"targetDir":     resolvedTarget,
				"hint":          "Delete existing file first or use a different name",
			}, http.StatusConflict)
			return
		}

		// Create target directory
		if err := os.MkdirAll(resolvedTarget, 0755); err != nil {
			jsonError(w, "Failed to create directory", http.StatusInternalServerError)
			return
		}

		// Copy file to destination
		if err := copyFile(tempPath, destPath); err != nil {
			jsonError(w, "Failed to save file", http.StatusInternalServerError)
			return
		}

		jsonResponse(w, map[string]interface{}{
			"success":     true,
			"message":     fmt.Sprintf("Uploaded %s to %s", destFilename, targetDir),
			"extractedTo": resolvedTarget,
			"fileCount":   1,
			"filename":    destFilename,
		})
		return
	}

	// Handle ZIP files: extract contents
	zipReader, err := zip.OpenReader(tempPath)
	if err != nil {
		jsonError(w, "Invalid ZIP file", http.StatusBadRequest)
		return
	}
	defer zipReader.Close()

	// Validate ZIP: check entry count, total size, and collect root items
	if len(zipReader.File) > MaxZipEntries {
		filesLog.Warn("ZIP rejected: too many entries (%d > %d)", len(zipReader.File), MaxZipEntries)
		jsonError(w, fmt.Sprintf("ZIP has too many files (max %d)", MaxZipEntries), http.StatusBadRequest)
		return
	}

	var totalUncompressedSize uint64
	rootItems := make(map[string]struct{})
	for _, f := range zipReader.File {
		// Check for path traversal in archive
		destPath := filepath.Join(resolvedTarget, f.Name)
		if !strings.HasPrefix(destPath, resolvedTarget) {
			filesLog.Warn("ZIP rejected: path traversal in archive: %s", f.Name)
			jsonError(w, "Malicious ZIP detected (path traversal in archive)", http.StatusBadRequest)
			return
		}

		// Check compression ratio for zip bomb detection
		if f.CompressedSize64 > 0 {
			ratio := f.UncompressedSize64 / f.CompressedSize64
			if ratio > MaxZipCompressionRatio {
				filesLog.Warn("ZIP rejected: suspicious compression ratio (%d:1) for %s", ratio, f.Name)
				jsonError(w, "Malicious ZIP detected (suspicious compression ratio)", http.StatusBadRequest)
				return
			}
		}

		totalUncompressedSize += f.UncompressedSize64
		if totalUncompressedSize > MaxZipTotalSize {
			filesLog.Warn("ZIP rejected: total size exceeds limit (%d > %d)", totalUncompressedSize, MaxZipTotalSize)
			jsonError(w, fmt.Sprintf("ZIP uncompressed size too large (max %dMB)", MaxZipTotalSize>>20), http.StatusBadRequest)
			return
		}

		parts := strings.Split(f.Name, "/")
		if len(parts) > 0 && parts[0] != "" {
			rootItems[parts[0]] = struct{}{}
		}
	}

	// Check for conflicts
	var existingItems []string
	for item := range rootItems {
		itemPath := filepath.Join(resolvedTarget, item)
		if _, err := os.Stat(itemPath); err == nil {
			existingItems = append(existingItems, item)
		}
	}

	if len(existingItems) > 0 {
		jsonResponse(w, map[string]interface{}{
			"error":         "Cannot extract - items already exist in target",
			"existingItems": existingItems,
			"targetDir":     resolvedTarget,
			"hint":          "Delete existing items first or remove them from ZIP",
		}, http.StatusConflict)
		return
	}

	// Create target directory
	if err := os.MkdirAll(resolvedTarget, 0755); err != nil {
		jsonError(w, "Failed to create directory", http.StatusInternalServerError)
		return
	}

	// Extract files
	for _, f := range zipReader.File {
		destPath := filepath.Join(resolvedTarget, f.Name)

		if f.FileInfo().IsDir() {
			os.MkdirAll(destPath, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			jsonError(w, "Failed to create directory", http.StatusInternalServerError)
			return
		}

		srcFile, err := f.Open()
		if err != nil {
			jsonError(w, "Failed to extract file", http.StatusInternalServerError)
			return
		}

		destFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			srcFile.Close()
			jsonError(w, "Failed to write file", http.StatusInternalServerError)
			return
		}

		_, err = io.Copy(destFile, srcFile)
		srcFile.Close()
		destFile.Close()
		if err != nil {
			jsonError(w, "Failed to extract file", http.StatusInternalServerError)
			return
		}
	}

	jsonResponse(w, map[string]interface{}{
		"success":     true,
		"message":     fmt.Sprintf("Extracted %d files to %s", len(zipReader.File), targetDir),
		"extractedTo": resolvedTarget,
		"fileCount":   len(zipReader.File),
	})
}

// ListFiles handles POST /api/list-files
func (h *FileHandler) ListFiles(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		if err := r.ParseForm(); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
	}

	workspace := r.FormValue("workspace")
	if workspace == "" {
		workspace = "root"
	}

	basePath := h.resolveBasePath(workspace)
	if _, err := os.Stat(basePath); os.IsNotExist(err) {
		jsonResponse(w, map[string]interface{}{
			"error": "Directory not found",
			"path":  basePath,
		}, http.StatusNotFound)
		return
	}

	excludeDirs := map[string]bool{
		"node_modules": true,
		"dist":         true,
		".git":         true,
		".turbo":       true,
	}

	tree := buildTree(basePath, "", 0, 4, excludeDirs)
	jsonResponse(w, map[string]interface{}{
		"path": basePath,
		"tree": tree,
	})
}

func buildTree(dirPath, relativePath string, depth, maxDepth int, excludeDirs map[string]bool) []TreeNode {
	if depth >= maxDepth {
		return nil
	}

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil
	}

	// Filter and sort entries
	var filtered []os.DirEntry
	for _, e := range entries {
		if !excludeDirs[e.Name()] {
			filtered = append(filtered, e)
		}
	}
	sort.Slice(filtered, func(i, j int) bool {
		iDir := filtered[i].IsDir()
		jDir := filtered[j].IsDir()
		if iDir != jDir {
			return iDir
		}
		return filtered[i].Name() < filtered[j].Name()
	})

	var nodes []TreeNode
	for _, entry := range filtered {
		entryRelPath := entry.Name()
		if relativePath != "" {
			entryRelPath = relativePath + "/" + entry.Name()
		}

		if entry.IsDir() {
			subPath := filepath.Join(dirPath, entry.Name())
			node := TreeNode{
				Text: entry.Name(),
				Icon: "jstree-folder",
				Data: NodeData{Path: entryRelPath, Type: "directory"},
			}
			if depth < 2 {
				node.State = &NodeState{Opened: true}
			}
			node.Children = buildTree(subPath, entryRelPath, depth+1, maxDepth, excludeDirs)
			nodes = append(nodes, node)
		} else {
			nodes = append(nodes, TreeNode{
				Text: entry.Name(),
				Icon: "jstree-file",
				Data: NodeData{Path: entryRelPath, Type: "file"},
			})
		}
	}
	return nodes
}

// ReadFile handles POST /api/read-file
func (h *FileHandler) ReadFile(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		if err := r.ParseForm(); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
	}

	workspace := r.FormValue("workspace")
	if workspace == "" {
		workspace = "root"
	}
	filePath := r.FormValue("path")
	if filePath == "" {
		jsonError(w, "No file path provided", http.StatusBadRequest)
		return
	}

	basePath := h.resolveBasePath(workspace)
	resolvedPath, err := resolveSafePath(basePath, filePath)
	if err != nil {
		filesLog.Warn("Path resolution failed for %s: %v", filePath, err)
		jsonError(w, "Invalid path", http.StatusBadRequest)
		return
	}

	info, err := os.Stat(resolvedPath)
	if os.IsNotExist(err) {
		jsonError(w, "File not found", http.StatusNotFound)
		return
	}

	// Size limit 1MB
	if info.Size() > 1024*1024 {
		jsonResponse(w, map[string]interface{}{
			"error": "File too large for preview (max 1MB)",
			"size":  info.Size(),
		}, http.StatusRequestEntityTooLarge)
		return
	}

	// Check binary
	binaryExts := map[string]bool{
		".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".ico": true,
		".webp": true, ".bmp": true, ".svg": true, ".pdf": true, ".zip": true,
		".tar": true, ".gz": true, ".rar": true, ".7z": true, ".mp3": true,
		".mp4": true, ".wav": true, ".avi": true, ".mov": true, ".mkv": true,
		".exe": true, ".dll": true, ".so": true, ".dylib": true, ".woff": true,
		".woff2": true, ".ttf": true, ".eot": true, ".otf": true, ".node": true,
		".wasm": true,
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	if binaryExts[ext] {
		jsonResponse(w, map[string]interface{}{
			"error":     "Binary file cannot be previewed",
			"binary":    true,
			"extension": ext,
		}, http.StatusUnsupportedMediaType)
		return
	}

	content, err := os.ReadFile(resolvedPath)
	if err != nil {
		jsonError(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	filename := filepath.Base(filePath)
	jsonResponse(w, map[string]interface{}{
		"content":  string(content),
		"path":     resolvedPath,
		"filename": filename,
		"size":     info.Size(),
	})
}

// DeleteFolder handles POST /api/delete-folder
func (h *FileHandler) DeleteFolder(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		if err := r.ParseForm(); err != nil {
			jsonError(w, "Invalid request", http.StatusBadRequest)
			return
		}
	}

	workspace := r.FormValue("workspace")
	if workspace == "" {
		workspace = "root"
	}
	folderPath := r.FormValue("path")
	if folderPath == "" {
		jsonError(w, "No folder path provided", http.StatusBadRequest)
		return
	}

	// Prevent root deletion
	if folderPath == "" || folderPath == "/" || folderPath == "." {
		jsonError(w, "Cannot delete root directory", http.StatusBadRequest)
		return
	}

	// Security validation
	if strings.Contains(folderPath, "..") || strings.HasPrefix(folderPath, "/") {
		jsonError(w, "Invalid path", http.StatusBadRequest)
		return
	}

	var basePath string
	isRootWorkspace := false

	if strings.HasPrefix(workspace, "site:") {
		siteName := strings.TrimPrefix(workspace, "site:")
		// Validate site name
		matched, _ := regexp.MatchString(`^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$`, siteName)
		if !matched {
			jsonError(w, "Invalid site name", http.StatusBadRequest)
			return
		}
		basePath = filepath.Join(h.config.ResolvedSitesPath, siteName, "user")
	} else if workspace == "root" {
		basePath = h.config.ResolvedUploadCwd
		isRootWorkspace = true
	} else {
		jsonError(w, "Invalid workspace", http.StatusBadRequest)
		return
	}

	resolvedPath, err := filepath.Abs(filepath.Join(basePath, folderPath))
	if err != nil {
		jsonError(w, "Invalid path", http.StatusBadRequest)
		return
	}

	normalizedBase, _ := filepath.Abs(basePath)

	// Security checks
	if !strings.HasPrefix(resolvedPath, normalizedBase+string(os.PathSeparator)) {
		jsonError(w, "Path traversal detected", http.StatusBadRequest)
		return
	}

	if !isRootWorkspace {
		normalizedSites, _ := filepath.Abs(h.config.ResolvedSitesPath)
		if !strings.HasPrefix(resolvedPath, normalizedSites+string(os.PathSeparator)) {
			jsonError(w, "Path outside sites directory", http.StatusBadRequest)
			return
		}
		if resolvedPath == normalizedBase {
			jsonError(w, "Cannot delete the user directory itself", http.StatusBadRequest)
			return
		}
	}

	if isRootWorkspace {
		normalizedUpload, _ := filepath.Abs(h.config.ResolvedUploadCwd)
		if !strings.HasPrefix(resolvedPath, normalizedUpload+string(os.PathSeparator)) {
			jsonError(w, "Can only delete folders within uploads directory", http.StatusBadRequest)
			return
		}
	}

	info, err := os.Stat(resolvedPath)
	if os.IsNotExist(err) {
		jsonError(w, "Path not found", http.StatusNotFound)
		return
	}

	isDirectory := info.IsDir()
	typeStr := "file"
	if isDirectory {
		typeStr = "directory"
	}

	if err := os.RemoveAll(resolvedPath); err != nil {
		jsonError(w, "Failed to delete", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"success":     true,
		"message":     fmt.Sprintf("Deleted %s: %s", typeStr, folderPath),
		"deletedPath": resolvedPath,
		"type":        typeStr,
	})
}

// ListSites handles GET /api/sites
func (h *FileHandler) ListSites(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(h.config.ResolvedSitesPath)
	if err != nil {
		jsonError(w, "Failed to list sites", http.StatusInternalServerError)
		return
	}

	var sites []string
	for _, entry := range entries {
		if entry.IsDir() && !entry.Type().IsRegular() {
			userDir := filepath.Join(h.config.ResolvedSitesPath, entry.Name(), "user")
			if _, err := os.Stat(userDir); err == nil {
				sites = append(sites, entry.Name())
			}
		} else if entry.IsDir() {
			userDir := filepath.Join(h.config.ResolvedSitesPath, entry.Name(), "user")
			if _, err := os.Stat(userDir); err == nil {
				sites = append(sites, entry.Name())
			}
		}
	}

	sort.Strings(sites)
	jsonResponse(w, map[string]interface{}{
		"sites":     sites,
		"sitesPath": h.config.ResolvedSitesPath,
	})
}

// ServerStats holds server statistics for health checks
type ServerStats struct {
	Status       string `json:"status"`
	Uptime       string `json:"uptime"`
	Goroutines   int    `json:"goroutines"`
	MemoryMB     uint64 `json:"memoryMB"`
	Environment  string `json:"environment"`
}

var serverStartTime = time.Now()

// Health handles GET /health
func (h *FileHandler) Health(w http.ResponseWriter, r *http.Request) {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	stats := ServerStats{
		Status:       "ok",
		Uptime:       time.Since(serverStartTime).Round(time.Second).String(),
		Goroutines:   runtime.NumGoroutine(),
		MemoryMB:     memStats.Alloc / 1024 / 1024,
		Environment:  h.config.Env,
	}

	jsonResponse(w, stats)
}

// Helper functions
func jsonResponse(w http.ResponseWriter, data interface{}, statusCodes ...int) {
	statusCode := http.StatusOK
	if len(statusCodes) > 0 {
		statusCode = statusCodes[0]
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, message string, statusCode int) {
	jsonResponse(w, map[string]string{"error": message}, statusCode)
}

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

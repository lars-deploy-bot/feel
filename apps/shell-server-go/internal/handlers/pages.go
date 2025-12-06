package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"shell-server-go/internal/config"
)

// PageHandler handles page routes
type PageHandler struct {
	config    *config.AppConfig
	templates *Templates
}

// NewPageHandler creates a new page handler
func NewPageHandler(cfg *config.AppConfig, templates *Templates) *PageHandler {
	return &PageHandler{
		config:    cfg,
		templates: templates,
	}
}

// Dashboard renders the dashboard page
func (h *PageHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	// In production (no workspace selection), redirect to shell
	if !h.config.AllowWorkspaceSelection {
		http.Redirect(w, r, fmt.Sprintf("/shell?workspace=%s", h.config.DefaultWorkspace), http.StatusSeeOther)
		return
	}

	h.templates.RenderDashboard(w, h.config.ResolvedDefaultCwd, h.config.ResolvedUploadCwd)
}

// Shell renders the shell page
func (h *PageHandler) Shell(w http.ResponseWriter, r *http.Request) {
	backURL := "/logout"
	backLabel := "Exit"

	if h.config.AllowWorkspaceSelection {
		backURL = "/dashboard"
		backLabel = "Back"
	}

	h.templates.RenderShell(w, backURL, backLabel)
}

// Upload renders the upload page
func (h *PageHandler) Upload(w http.ResponseWriter, r *http.Request) {
	workspace := r.URL.Query().Get("workspace")
	if workspace == "" {
		workspace = "root"
	}

	// Resolve upload path based on workspace type
	var uploadPath string
	if strings.HasPrefix(workspace, "site:") {
		siteName := strings.TrimPrefix(workspace, "site:")
		uploadPath = fmt.Sprintf("%s/%s/user", h.config.ResolvedSitesPath, siteName)
	} else if workspace == "root" {
		uploadPath = h.config.ResolvedUploadCwd
	} else {
		uploadPath = fmt.Sprintf("%s/%s", h.config.WorkspaceBase, workspace)
	}

	h.templates.RenderUpload(w, workspace, uploadPath)
}

// Edit renders the edit page
func (h *PageHandler) Edit(w http.ResponseWriter, r *http.Request) {
	// Build directory list
	type DirInfo struct {
		ID    string `json:"id"`
		Label string `json:"label"`
	}

	var directories []DirInfo
	for _, dir := range h.config.EditableDirectories {
		if _, err := os.Stat(dir.Path); err == nil {
			directories = append(directories, DirInfo{ID: dir.ID, Label: dir.Label})
		}
	}

	dirJSON, _ := json.Marshal(directories)
	h.templates.RenderEdit(w, string(dirJSON))
}

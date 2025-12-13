package handlers

import (
	"io/fs"
	"net/http"
	"strings"
)

// Templates manages HTML template loading and rendering
type Templates struct {
	login     string
	dashboard string
	shell     string
	upload    string
	edit      string
}

// LoadTemplatesFromFS loads all HTML templates from an embedded filesystem
func LoadTemplatesFromFS(fsys fs.FS) (*Templates, error) {
	t := &Templates{}

	files := map[string]*string{
		"login.html":     &t.login,
		"dashboard.html": &t.dashboard,
		"shell.html":     &t.shell,
		"upload.html":    &t.upload,
		"edit.html":      &t.edit,
	}

	for name, dest := range files {
		data, err := fs.ReadFile(fsys, name)
		if err != nil {
			return nil, err
		}
		*dest = string(data)
	}

	return t, nil
}

// RenderLogin renders the login page
func (t *Templates) RenderLogin(w http.ResponseWriter, errorMessage string) {
	html := strings.Replace(t.login, "{{ERROR_MESSAGE}}", errorMessage, 1)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

// RenderDashboard renders the dashboard page
func (t *Templates) RenderDashboard(w http.ResponseWriter, shellPath, uploadPath string) {
	html := t.dashboard
	html = strings.Replace(html, "{{SHELL_DEFAULT_PATH}}", shellPath, 1)
	html = strings.Replace(html, "{{UPLOAD_DEFAULT_PATH}}", uploadPath, 1)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

// RenderShell renders the shell page
func (t *Templates) RenderShell(w http.ResponseWriter, backURL, backLabel string) {
	html := t.shell
	html = strings.Replace(html, "{{BACK_URL}}", backURL, 1)
	html = strings.Replace(html, "{{BACK_LABEL}}", backLabel, 1)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

// RenderUpload renders the upload page
func (t *Templates) RenderUpload(w http.ResponseWriter, workspace, uploadPath string) {
	html := t.upload
	html = strings.ReplaceAll(html, "${workspace}", workspace)
	html = strings.Replace(html, "{{UPLOAD_PATH}}", uploadPath, 1)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

// RenderEdit renders the edit page
func (t *Templates) RenderEdit(w http.ResponseWriter, directoriesJSON string) {
	html := strings.Replace(t.edit, "{{EDITABLE_DIRECTORIES}}", directoriesJSON, 1)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

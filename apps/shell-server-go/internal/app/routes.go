package app

import (
	"errors"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	httpxmiddleware "shell-server-go/internal/httpx/middleware"
	"shell-server-go/internal/httpx/response"
	"shell-server-go/internal/preview"
	"shell-server-go/internal/sentryx"
)

// Router builds the full HTTP routing tree.
func (a *ServerApp) Router() (http.Handler, error) {
	if a == nil {
		return nil, errors.New("server app is nil")
	}
	if a.ClientFS == nil {
		return nil, errors.New("client filesystem is not configured")
	}

	mux := http.NewServeMux()
	authAPIMiddleware := httpxmiddleware.AuthAPI(a.Sessions)

	mux.HandleFunc("POST /login", a.AuthHandler.Login)
	mux.HandleFunc("POST /logout", a.AuthHandler.Logout)

	mux.Handle("GET /api/config", authAPIMiddleware(http.HandlerFunc(a.FileHandler.Config)))
	mux.HandleFunc("/health", a.FileHandler.Health)

	mux.HandleFunc("/ws", a.WSHandler.Handle)
	mux.Handle("POST /api/ws-lease", authAPIMiddleware(http.HandlerFunc(a.WSHandler.CreateLease)))
	mux.HandleFunc("POST /internal/lease", a.WSHandler.CreateInternalLease)

	mux.HandleFunc("/ws/watch", a.WatchHandler.Handle)
	mux.HandleFunc("POST /internal/watch-lease", a.WatchHandler.CreateInternalLease)

	mux.Handle("POST /api/check-directory", authAPIMiddleware(http.HandlerFunc(a.FileHandler.CheckDirectory)))
	mux.Handle("POST /api/create-directory", authAPIMiddleware(http.HandlerFunc(a.FileHandler.CreateDirectory)))
	mux.Handle("POST /api/upload", authAPIMiddleware(http.HandlerFunc(a.FileHandler.Upload)))
	mux.HandleFunc("POST /api/public/upload", a.FileHandler.PublicUpload)
	mux.Handle("POST /api/list-files", authAPIMiddleware(http.HandlerFunc(a.FileHandler.ListFiles)))
	mux.Handle("POST /api/read-file", authAPIMiddleware(http.HandlerFunc(a.FileHandler.ReadFile)))
	mux.Handle("GET /api/download-file", authAPIMiddleware(http.HandlerFunc(a.FileHandler.DownloadFile)))
	mux.Handle("POST /api/delete-folder", authAPIMiddleware(http.HandlerFunc(a.FileHandler.DeleteFolder)))
	mux.Handle("GET /api/sites", authAPIMiddleware(http.HandlerFunc(a.FileHandler.ListSites)))

	mux.Handle("POST /api/edit/list-files", authAPIMiddleware(http.HandlerFunc(a.EditorHandler.ListFiles)))
	mux.Handle("POST /api/edit/read-file", authAPIMiddleware(http.HandlerFunc(a.EditorHandler.ReadFile)))
	mux.Handle("POST /api/edit/write-file", authAPIMiddleware(http.HandlerFunc(a.EditorHandler.WriteFile)))
	mux.Handle("POST /api/edit/check-mtimes", authAPIMiddleware(http.HandlerFunc(a.EditorHandler.CheckMtimes)))
	mux.Handle("POST /api/edit/delete", authAPIMiddleware(http.HandlerFunc(a.EditorHandler.Delete)))
	mux.Handle("POST /api/edit/copy", authAPIMiddleware(http.HandlerFunc(a.EditorHandler.Copy)))

	mux.Handle("GET /api/templates", authAPIMiddleware(http.HandlerFunc(a.TemplateHandler.ListTemplates)))
	mux.Handle("POST /api/templates", authAPIMiddleware(http.HandlerFunc(a.TemplateHandler.CreateTemplate)))
	mux.Handle("GET /api/templates/{id}", authAPIMiddleware(http.HandlerFunc(a.TemplateHandler.GetTemplate)))
	mux.Handle("PUT /api/templates/{id}", authAPIMiddleware(http.HandlerFunc(a.TemplateHandler.SaveTemplate)))

	mux.Handle("/", createSPAHandler(a.ClientFS))

	// If preview proxy is enabled, wrap the mux with host-based dispatch:
	// requests with Host: preview--*.{base} go to the preview handler.
	if a.PreviewHandler != nil {
		return hostDispatch(a.PreviewHandler, mux), nil
	}
	return mux, nil
}

// hostDispatch routes requests based on the Host header:
//  1. preview--* hosts → preview handler (with JWT auth, nav script injection)
//  2. Known site in port-map → direct reverse proxy (no auth, public site)
//  3. Everything else → shell server mux
func hostDispatch(ph *preview.Handler, shellHandler http.Handler) http.Handler {
	siteTransport := &http.Transport{
		ForceAttemptHTTP2:  false,
		DisableCompression: true,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Header.Get("X-Forwarded-Host")
		if host == "" {
			host = r.Host
		}

		// 1. Preview hosts → preview handler (with auth, injection)
		if preview.IsPreviewHost(host) {
			ph.ServeHTTP(w, r)
			return
		}

		// 2. Known site in port-map → direct reverse proxy (public, no auth)
		if port, ok := ph.LookupSitePort(host); ok {
			hostname := host
			if h, _, err := net.SplitHostPort(host); err == nil {
				hostname = h
			}
			target := &url.URL{
				Scheme: "http",
				Host:   fmt.Sprintf("localhost:%d", port),
			}
			proxy := &httputil.ReverseProxy{
				Rewrite: func(pr *httputil.ProxyRequest) {
					pr.SetURL(target)
					pr.Out.Host = hostname
					pr.Out.Header.Set("X-Forwarded-Host", hostname)
					pr.Out.Header.Set("X-Forwarded-Proto", "https")
				},
				Transport: siteTransport,
				ErrorHandler: func(rw http.ResponseWriter, req *http.Request, err error) {
					sentryx.CaptureError(err, "site proxy error host=%s target=%s", hostname, target.String())
					http.Error(rw, "Bad gateway", http.StatusBadGateway)
				},
			}
			proxy.ServeHTTP(w, r)
			return
		}

		// 3. Everything else → shell server mux
		shellHandler.ServeHTTP(w, r)
	})
}

func createSPAHandler(clientFS fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(clientFS))

	return httpxmiddleware.Gzip(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "" {
			path = "/"
		}

		if path != "/" {
			filePath := strings.TrimPrefix(path, "/")
			if f, err := clientFS.Open(filePath); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		indexFile, err := fs.ReadFile(clientFS, "index.html")
		if err != nil {
			response.InternalServerError(w)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(indexFile)
	}))
}

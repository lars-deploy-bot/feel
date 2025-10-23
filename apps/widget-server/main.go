package main

import (
	"compress/gzip"
	"embed"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

//go:embed widget.min.js
var widgetJS string

//go:embed widget.min.js.gz
var widgetJSGz []byte

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	mux := http.NewServeMux()

	// Serve widget with optimal headers
	mux.HandleFunc("/widget.js", serveWidget)
	mux.HandleFunc("/widget.min.js", serveWidget)
	mux.HandleFunc("/claude-widget.js", serveWidget)

	// Health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// CORS middleware
	handler := corsMiddleware(mux)

	log.Printf("Widget server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func serveWidget(w http.ResponseWriter, r *http.Request) {
	// Optimal caching headers
	w.Header().Set("Content-Type", "application/javascript")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", `"widget-v1"`)

	// Check if client supports gzip
	if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Content-Length", string(rune(len(widgetJSGz))))
		w.Write(widgetJSGz)
	} else {
		w.Header().Set("Content-Length", string(rune(len(widgetJS))))
		w.Write([]byte(widgetJS))
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow all origins for widget (it's public anyway)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Utility to compress JS during build
func compressFile(filename string) error {
	input, err := os.ReadFile(filename)
	if err != nil {
		return err
	}

	output, err := os.Create(filename + ".gz")
	if err != nil {
		return err
	}
	defer output.Close()

	writer := gzip.NewWriter(output)
	defer writer.Close()

	_, err = writer.Write(input)
	return err
}
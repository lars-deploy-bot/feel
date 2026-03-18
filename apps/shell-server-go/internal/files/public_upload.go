package files

import (
	"archive/zip"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"shell-server-go/internal/httpx/response"
)

const (
	// PublicUploadMaxSize is the maximum upload size (10 GB).
	PublicUploadMaxSize int64 = 10 << 30

	// PublicUploadDir is where public uploads land.
	PublicUploadDir = "/root/uploads/public"

	// PublicUploadPassword is a simple shared secret to prevent abuse.
	PublicUploadPassword = "ilovethenetherlands"
)

// PublicUpload handles POST /api/public/upload.
// Requires a simple password. Streams directly to disk — never buffers the
// full file in memory. Accepts up to 3 GB. ZIP files are auto-extracted.
func (h *Handler) PublicUpload(w http.ResponseWriter, r *http.Request) {
	started := time.Now()

	// Extend read/write deadlines for this handler only.
	// The global server timeouts (30s read, 60s write) are too short for 3GB.
	rc := http.NewResponseController(w)
	uploadDeadline := time.Now().Add(2 * time.Hour)
	if err := rc.SetReadDeadline(uploadDeadline); err != nil {
		filesLog.Warn("public-upload: failed to extend read deadline: %v", err)
	}
	if err := rc.SetWriteDeadline(uploadDeadline); err != nil {
		filesLog.Warn("public-upload: failed to extend write deadline: %v", err)
	}

	contentType := r.Header.Get("Content-Type")
	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil || !strings.HasPrefix(mediaType, "multipart/") {
		response.Error(w, http.StatusBadRequest, "Content-Type must be multipart/form-data")
		return
	}

	boundary := params["boundary"]
	if boundary == "" {
		response.Error(w, http.StatusBadRequest, "Missing multipart boundary")
		return
	}

	// Cap the body so a malicious client can't send more than 3 GB.
	body := http.MaxBytesReader(w, r.Body, PublicUploadMaxSize)
	defer body.Close()

	reader := multipart.NewReader(body, boundary)

	// Read form fields first (password), collect file parts after.
	authenticated := false
	var firstFilePart *multipart.Part

	for {
		part, partErr := reader.NextPart()
		if partErr == io.EOF {
			break
		}
		if partErr != nil {
			response.Error(w, http.StatusBadRequest, "Failed to read upload")
			return
		}

		// File part — stop scanning fields, process files below.
		if part.FileName() != "" {
			firstFilePart = part
			break
		}

		// Form field — check for password.
		if part.FormName() == "password" {
			pw, _ := io.ReadAll(io.LimitReader(part, 256))
			part.Close()
			if strings.TrimSpace(string(pw)) == PublicUploadPassword {
				authenticated = true
			}
			continue
		}
		part.Close()
	}

	if !authenticated {
		if firstFilePart != nil {
			firstFilePart.Close()
		}
		response.Error(w, http.StatusUnauthorized, "Invalid password")
		return
	}

	// Generate a unique upload slot.
	uploadID := generateUploadID()
	uploadDir := filepath.Join(PublicUploadDir, uploadID)

	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		filesLog.Error("public-upload: failed to create dir %s: %v", uploadDir, err)
		response.Error(w, http.StatusInternalServerError, "Failed to create upload directory")
		return
	}

	var totalBytes int64
	var fileCount int

	// processFilePart saves one file part to disk and extracts ZIPs.
	processFilePart := func(part *multipart.Part) bool {
		filename := filepath.Base(part.FileName())
		if filename == "." || filename == ".." || filename == "" {
			part.Close()
			return true
		}

		destPath := filepath.Join(uploadDir, filename)

		written, writeErr := streamPartToDisk(destPath, part, &totalBytes)
		part.Close()
		if writeErr != nil {
			if totalBytes >= PublicUploadMaxSize {
				response.Error(w, http.StatusRequestEntityTooLarge, "Upload exceeds 10 GB limit")
			} else {
				filesLog.Error("public-upload: streaming to disk: %v", writeErr)
				response.Error(w, http.StatusInternalServerError, "Failed to save file")
			}
			return false
		}

		fileCount++
		filesLog.Info("public-upload: saved %s (%d bytes)", filename, written)

		// Auto-extract ZIP files.
		if strings.HasSuffix(strings.ToLower(filename), ".zip") {
			extracted, extractErr := extractPublicZip(destPath, uploadDir)
			if extractErr != nil {
				filesLog.Warn("public-upload: zip extraction failed: %v", extractErr)
			} else {
				fileCount += extracted
				os.Remove(destPath)
				filesLog.Info("public-upload: extracted %d entries from %s", extracted, filename)
			}
		}
		return true
	}

	// Process the first file part we already read.
	if firstFilePart != nil {
		if !processFilePart(firstFilePart) {
			return
		}
	}

	// Process remaining parts.
	for {
		part, partErr := reader.NextPart()
		if partErr == io.EOF {
			break
		}
		if partErr != nil {
			if totalBytes >= PublicUploadMaxSize {
				response.Error(w, http.StatusRequestEntityTooLarge, "Upload exceeds 10 GB limit")
			} else {
				filesLog.Error("public-upload: reading part: %v", partErr)
				response.Error(w, http.StatusBadRequest, "Failed to read upload")
			}
			return
		}

		if part.FileName() == "" {
			part.Close()
			continue
		}

		if !processFilePart(part) {
			return
		}
	}

	if fileCount == 0 {
		os.Remove(uploadDir)
		response.Error(w, http.StatusBadRequest, "No files in upload")
		return
	}

	elapsed := time.Since(started).Round(time.Millisecond)
	filesLog.Info("public-upload: %s — %d files, %d bytes in %s", uploadID, fileCount, totalBytes, elapsed)

	response.JSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"uploadId":   uploadID,
		"path":       uploadDir,
		"fileCount":  fileCount,
		"totalBytes": totalBytes,
		"elapsed":    elapsed.String(),
	})
}

// streamPartToDisk copies a multipart part directly to a file on disk,
// tracking total bytes written in the atomic counter.
func streamPartToDisk(destPath string, part io.Reader, totalBytes *int64) (int64, error) {
	f, err := os.Create(destPath)
	if err != nil {
		return 0, fmt.Errorf("create %s: %w", destPath, err)
	}
	defer f.Close()

	buf := make([]byte, 256*1024)
	var written int64
	for {
		n, readErr := part.Read(buf)
		if n > 0 {
			nw, writeErr := f.Write(buf[:n])
			if writeErr != nil {
				return written, fmt.Errorf("write: %w", writeErr)
			}
			written += int64(nw)
			atomic.AddInt64(totalBytes, int64(nw))
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return written, fmt.Errorf("read: %w", readErr)
		}
	}

	return written, nil
}

// extractPublicZip extracts a zip file into destDir.
func extractPublicZip(zipPath, destDir string) (int, error) {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return 0, fmt.Errorf("open zip: %w", err)
	}
	defer zr.Close()

	var count int
	for _, f := range zr.File {
		name := filepath.Clean(f.Name)
		if strings.HasPrefix(name, "..") || strings.HasPrefix(name, "/") {
			continue
		}

		target := filepath.Join(destDir, name)

		if f.FileInfo().IsDir() {
			os.MkdirAll(target, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return count, fmt.Errorf("mkdir: %w", err)
		}

		src, err := f.Open()
		if err != nil {
			return count, fmt.Errorf("open entry %s: %w", name, err)
		}

		dst, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			src.Close()
			return count, fmt.Errorf("create %s: %w", name, err)
		}

		_, copyErr := io.Copy(dst, src)
		src.Close()
		dst.Close()
		if copyErr != nil {
			return count, fmt.Errorf("copy %s: %w", name, copyErr)
		}

		count++
	}

	return count, nil
}

func generateUploadID() string {
	now := time.Now()
	b := make([]byte, 4)
	rand.Read(b)
	return fmt.Sprintf("%s-%s", now.Format("20060102-150405"), hex.EncodeToString(b))
}

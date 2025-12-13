package main

import (
	"embed"
	"io/fs"
)

//go:embed dist/client/*
//go:embed dist/client/chunks/*
var embeddedClientFS embed.FS

//go:embed templates/*
var embeddedTemplatesFS embed.FS

// GetEmbeddedClientFS returns the client files, stripped of dist/client prefix
func GetEmbeddedClientFS() (fs.FS, error) {
	return fs.Sub(embeddedClientFS, "dist/client")
}

// GetEmbeddedTemplatesFS returns the templates, stripped of templates prefix
func GetEmbeddedTemplatesFS() (fs.FS, error) {
	return fs.Sub(embeddedTemplatesFS, "templates")
}

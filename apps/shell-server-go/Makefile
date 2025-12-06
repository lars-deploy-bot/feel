.PHONY: build run dev clean test deps

# Build the server
build:
	go build -o bin/shell-server ./cmd/server

# Run the server (requires SHELL_PASSWORD env var)
run: build
	./bin/shell-server

# Development mode with auto-reload (requires air)
dev:
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "Installing air for hot-reload..."; \
		go install github.com/air-verse/air@latest; \
		air; \
	fi

# Install dependencies
deps:
	go mod download
	go mod tidy

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f .sessions.json .rate-limit-state.json

# Run tests
test:
	go test ./...

# Build for production (static binary)
build-prod:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/shell-server ./cmd/server

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	@if command -v golangci-lint > /dev/null; then \
		golangci-lint run; \
	else \
		echo "golangci-lint not installed, skipping..."; \
	fi

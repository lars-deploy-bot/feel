# Multi-stage build for minimal Go binary
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o widget-server .

# Minimal runtime image
FROM scratch

# Copy the binary
COPY --from=builder /app/widget-server /widget-server

# Copy embedded assets
COPY --from=builder /app/widget.min.js /widget.min.js
COPY --from=builder /app/widget.min.js.gz /widget.min.js.gz

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/widget-server", "-health"]

# Run
ENTRYPOINT ["/widget-server"]
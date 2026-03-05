# alive-e2e-minimal (E2B Template)

Minimal sandbox image for live E2E lifecycle tests.

This Dockerfile is mirrored from infra `templates/alive-minimal/Dockerfile` and intentionally keeps only:

- `FROM e2bdev/base:latest`
- `RUN mkdir -p /home/user/project`
- `WORKDIR /home/user/project`

For the full development image, see `templates/e2b/alive/e2b.Dockerfile`.

## Build & publish

From repo root:

```bash
# 1) Authenticate once (interactive)
bunx @e2b/cli auth login

# 2) Build/update the template alias used by E2E routing
./scripts/e2b/build-e2e-minimal-template.sh
```

Optional override:

```bash
E2B_E2E_TEMPLATE_NAME=self-hosted/alive-e2e-minimal ./scripts/e2b/build-e2e-minimal-template.sh
```

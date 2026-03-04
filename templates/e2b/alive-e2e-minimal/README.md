# alive-e2e-minimal (E2B Template)

Minimal sandbox image for live E2E lifecycle tests.

## Included
- `/home/user/project` writable workspace
- `bash`
- GNU `coreutils`

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

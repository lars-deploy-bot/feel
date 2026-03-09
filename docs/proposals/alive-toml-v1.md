# `alive.toml` V1

`alive.toml` is an application-level run contract.

It answers four questions:

1. How does a repo get set up?
2. How does it build?
3. What do we run for development, staging, and production?
4. Where is the promoted release root, and which environment groups does each command use?

This file is for repo-local run intent. It does not replace server-local infrastructure config such as `server-config.json`.

See the concrete draft in `ops/alive.example.toml`.

## Design Goals

- Thin, not ambitious: enough to define setup, build, and named run commands without becoming a new build system.
- Runner-agnostic: systemd, Docker, and Firecracker should all be able to consume the same `run.staging` and `run.production` definitions.
- Turbo-friendly env handling: build env stays explicit so cache invalidation remains correct.
- Opinionated structure: fixed phases, not a general CI DSL.

## V1 Shape

```toml
schema = 1

[project]
kind = "turbo"
root = "user"
workspace = "apps/web"

[setup]
command = "bun install --frozen-lockfile"

[build]
command = "bun x turbo run build --filter=apps/web"
outputs = ["apps/web/.next/standalone", "apps/web/.next/static", "apps/web/public"]
cache = [".turbo", "node_modules/.cache"]
environment = "build"

[release]
root = "apps/web/.next/standalone"

[run.development]
command = "bun x turbo run dev --filter=apps/web"
environment = "development"

[run.staging]
cwd = "apps/web"
command = "node server.js"
environment = "staging"

[run.production]
cwd = "apps/web/.next/standalone"
command = "node server.js"
environment = "production"

[environments.build]
groups = ["build"]

[environments.development]
groups = ["runtime"]

[environments.staging]
groups = ["runtime"]

[environments.production]
groups = ["runtime"]

[env.groups.build]
required = ["NEXT_PUBLIC_APP_URL", "SERVER_CONFIG_PATH"]

[env.groups.runtime]
required = ["SUPABASE_URL", "JWT_SECRET"]
```

## Why This Is Lighter

The earlier draft went too far into release packaging and runner configuration. That risks reinventing Nixpacks, Dockerfiles, or a deployment orchestrator.

V1 should stop at the repo contract:

- how to set up
- how to build
- which build output becomes the release root
- what to run in development
- what to run in staging
- what to run in production
- which environment groups each step requires

systemd, Docker, and Firecracker are adapters around this contract. They should call into it, not redefine it.

## Env Model

TOML can group env declarations, but the variables themselves should stay flat and explicit.

Good:

```toml
[env.groups.build]
required = ["NEXT_PUBLIC_APP_URL", "SERVER_CONFIG_PATH"]
```

Bad:

```toml
[env.build.next_public]
app_url = true
preview_base = true
```

Why:

- Turbo caches against concrete env names, not nested config structure.
- Next.js build behavior depends on explicit `NEXT_PUBLIC_*` names.
- Validation is only reliable when the config lists the exact variables involved.

For `project.kind = "turbo"`, Alive should validate that `env.groups.build.required` matches the relevant `turbo.json` task env list. V1 should validate, not generate.

## Environment Composition

`environments.<name>` maps a named environment to one or more env groups.

Example:

```toml
[environments.production]
groups = ["runtime", "production"]
```

This keeps the file readable while still saying something concrete about build-time env, shared runtime env, and stage-specific expectations.

## Runner Boundary

V1 does not describe systemd units, Docker publish flags, or Firecracker vCPU sizes.

Those are runner concerns and should live in runner-specific config or a later adapter layer.

The important rule is:

- systemd can call `run.production`
- Docker can call `run.staging` or `run.production`
- Firecracker can call `run.production`
- `cwd` values are resolved relative to the repo root
- Runners promoting `release.root` must preserve any paths required by the selected `run.*` command

One repo contract, multiple runners.

## V1 Constraints

- `schema` is required.
- `project.kind` is required.
- `setup.command` is required.
- `build.command` is a single command string in V1.
- `build.outputs` must be explicit paths.
- `release.root` is required and points at the promoted artifact root.
- `run.development`, `run.staging`, and `run.production` are first-class named commands.
- Each `build` or `run` step must reference one named environment.
- `environments.<name>.groups` must reference explicit env groups.
- Secrets are never stored in `alive.toml`.
- No wildcard env support like `NEXT_PUBLIC_*`.

## Non-Goals

- Replacing `server-config.json`
- Defining runner-specific infrastructure knobs in this file
- Arbitrary build graph authoring
- Secret storage
- Automatic fallback behavior when required fields are missing

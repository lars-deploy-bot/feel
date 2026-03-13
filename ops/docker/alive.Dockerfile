# syntax=docker/dockerfile:1.7

FROM oven/bun:1.2.22 AS deps
WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN bun install --frozen-lockfile --ignore-scripts

RUN cd templates/site-template/user && bun install --frozen-lockfile

RUN bun run build:libs

FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG ALIVE_BUILD_COMMIT=unknown
ARG ALIVE_BUILD_BRANCH=unknown
ARG ALIVE_BUILD_TIME=unknown

RUN apt-get update \
    && apt-get install --yes --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app /app

RUN mkdir -p /app/apps/web/public

RUN --mount=type=secret,id=build_env,target=/run/secrets/build_env \
    --mount=type=secret,id=server_config,target=/run/secrets/server_config \
    sh -lc 'set -a && . /run/secrets/build_env && set +a && export SERVER_CONFIG_PATH=/run/secrets/server_config && export ALIVE_BUILD_COMMIT ALIVE_BUILD_BRANCH ALIVE_BUILD_TIME && cd apps/web && NODE_OPTIONS="--max-old-space-size=4096" ../../node_modules/.bin/next build'

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
       procps jq curl git systemd rsync sudo dbus \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV PATH="/root/.bun/bin:/root/.local/bin:${PATH}"
# systemctl inside Docker detects "chroot" and no-ops all commands.
# With --privileged + D-Bus mount we want it to talk to the real host systemd.
ENV SYSTEMD_IGNORE_CHROOT=1

# The app needs direct access to host-mounted systemd workspaces under /srv/webalive/sites.
# Those directories are owned by per-site Linux users with 750 permissions, so the runtime
# container must preserve root privileges instead of dropping to the image's `node` user.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

# Worker pool runs as a separate Node.js process (worker-entry.mjs) with imports not
# traced by Next.js standalone. Copy the full node_modules and packages from the build
# stage into /app/worker-deps/, then set NODE_PATH so the worker can resolve them.
# This avoids conflicts with the standalone output's own node_modules.
COPY --from=build /app/node_modules /app/worker-deps/node_modules
COPY --from=build /app/packages /app/worker-deps/packages

ENV NODE_PATH=/app/worker-deps/node_modules

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

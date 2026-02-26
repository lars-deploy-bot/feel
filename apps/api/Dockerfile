FROM oven/bun:1.2 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS build
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY src/ ./src/
COPY tsconfig.json ./

# Production image
FROM base AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./
COPY --from=build /app/tsconfig.json ./

ARG API_PORT=5080
ENV PORT=${API_PORT}
EXPOSE ${API_PORT}

USER bun
CMD ["bun", "src/index.ts"]

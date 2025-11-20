# @alive-brug/redis

Redis infrastructure package for the monorepo.

## Installation

From monorepo root:

```bash
bun --filter @alive-brug/redis install
```

## Usage

### Start Redis

```bash
bun --filter @alive-brug/redis start
```

### Stop Redis

```bash
bun --filter @alive-brug/redis stop
```

### Check Status

```bash
bun --filter @alive-brug/redis status
bun --filter @alive-brug/redis health
```

### Test Redis

Run comprehensive behavioral tests to verify Redis configuration and operations:

```bash
bun --filter @alive-brug/redis test
```

This test suite verifies:
1. **Configuration** - redis.conf loaded (256MB memory, LRU eviction)
2. **TTL & Expiration** - Keys expire correctly with timeout
3. **Data Types** - Lists, Sets, Hashes, Sorted Sets work properly
4. **Large Values** - 100KB+ data storage and retrieval
5. **Atomic Operations** - INCR with concurrent requests (race conditions)
6. **Persistence** - RDB snapshots configured and working
7. **Edge Cases** - Unicode, special characters, spaces handled
8. **Pattern Matching** - KEYS/SCAN wildcard queries
9. **Transactions** - MULTI/EXEC atomic operations
10. **Concurrent Connections** - Multiple simultaneous clients
11. **Memory Tracking** - Memory usage statistics

Tests are designed to catch real problems, not just check if Redis responds.

### View Logs

```bash
bun --filter @alive-brug/redis logs
```

### Access Redis CLI

```bash
bun --filter @alive-brug/redis cli
```

## Connection String

- From host: `redis://127.0.0.1:6379`
- From Docker: `redis://redis:6379`

Add to your app's `.env`:

```bash
REDIS_URL=redis://127.0.0.1:6379
```

## For New Developers

1. Install: `bun --filter @alive-brug/redis install`
2. Start: `bun --filter @alive-brug/redis start`
3. Verify: `bun --filter @alive-brug/redis health`

That's it! Your app can now connect to Redis.

## Quick Commands

From the monorepo root, you can also use the convenience scripts:

```bash
bun run redis:install   # Install Redis
bun run redis:start     # Start Redis
bun run redis:stop      # Stop Redis
bun run redis:status    # Check status
bun run redis:health    # Health check
bun run redis:test      # Run tests
bun run redis:logs      # View logs
bun run redis:cli       # Access Redis CLI
```

## Troubleshooting

### Redis won't start

Check if port 6379 is already in use:
```bash
lsof -i :6379
```

### View detailed logs

```bash
bun --filter @alive-brug/redis logs
```

### Clean everything and restart

```bash
bun --filter @alive-brug/redis clean
bun --filter @alive-brug/redis install
bun --filter @alive-brug/redis start
```

## Configuration

The Redis configuration is located at `config/redis.conf`. Key settings:

- **Port**: 6379
- **Max Memory**: 256MB
- **Eviction Policy**: allkeys-lru
- **Persistence**: Enabled (RDB snapshots)

Modify the configuration file and restart Redis to apply changes.

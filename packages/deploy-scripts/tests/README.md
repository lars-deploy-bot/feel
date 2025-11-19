# Deploy Scripts Tests

Comprehensive test suite for the modular deployment system.

## Test Files

### DNS Tests (`dns.test.ts`)
- IP validation (Cloudflare detection)
- Domain validation logic
- Wildcard domain handling

### Ports Tests (`ports.test.ts`)
- Port availability checking
- Port listening detection
- Port range validation

### Users Tests (`users.test.ts`)
- Domain to slug conversion
- Username generation
- Slug consistency

### Caddy Tests (`caddy.test.ts`)
- Caddyfile block generation
- Required directives inclusion
- Port and domain handling

### Files Tests (`files.test.ts`)
- Directory creation (single and nested)
- File copying (recursive)
- Symlink operations
- Ownership changes (with proper setup)

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/dns.test.ts

# Run with watch mode
bun test --watch

# Run with verbose output
bun test --verbose
```

## Test Structure

Each test file:
- Uses isolated temporary directories
- Does not modify system state
- Cleans up after itself
- Groups related tests with `describe` blocks
- Has clear test names with `it` blocks

## Adding New Tests

1. Create a new `*.test.ts` file in this directory
2. Import test utilities from `bun:test`
3. Use temporary directories for file operations
4. Clean up after tests complete

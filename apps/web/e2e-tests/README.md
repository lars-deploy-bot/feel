# E2E Tests

End-to-end tests for the Claude Bridge web application using Playwright.

## Running Tests

### Local Development Tests

```bash
# Run all tests (starts local dev server on port 9547)
bun run test:e2e

# Run with UI mode (interactive test runner)
bun run test:e2e:ui

# Run in headed mode (see browser)
bun run test:e2e:headed

# Debug mode (step through tests)
bun run test:e2e:debug
```

### Staging Environment Tests

Tests can also run against the live staging environment:

```bash
# Run org/workspace tests against staging
bun run test:e2e:staging

# With UI mode
bun run test:e2e:staging:ui

# Custom credentials (optional)
STAGING_EMAIL=your@email.com STAGING_PASSWORD=yourpass bun run test:e2e:staging
```

**Default staging credentials:**
- Email: `eedenlars@gmail.com`
- Password: `supersecret`

## Test Files

- `auth.spec.ts` - Authentication flow tests
- `chat.spec.ts` - Chat interface tests (some skipped, need workspace auto-selection fix)
- `org-workspace-selection.spec.ts` - **NEW**: Organization and workspace selection flow tests
- `protection-verification.spec.ts` - API protection verification
- `smoke.spec.ts` - Basic smoke tests

## Writing Tests

### Setup

All tests use the custom setup from `./setup.ts` which:
- Prevents unmocked Claude API calls (fail-fast protection)
- Tracks route registrations
- Provides enhanced test utilities

### Example Test

```typescript
import { expect, test } from "./setup"
import { login } from "./helpers"

test("my test", async ({ page }) => {
  await login(page)
  await page.goto("/chat")
  // ... test code
})
```

### Mocking API Responses

For Claude API calls, register mocks BEFORE navigation:

```typescript
import { handlers } from "./lib/handlers"

test("test with mock", async ({ page }) => {
  // Register mock BEFORE page.goto
  await page.route("**/api/claude/stream", handlers.text("Mock response"))

  await page.goto("/chat")
  // ... test code
})
```

## CI/CD

Tests run automatically in CI via GitHub Actions. See `.github/workflows/` for configuration.

## Common Issues

### Port Conflicts

If tests fail to start, check if port 9547 is in use:

```bash
lsof -i :9547
kill -9 <PID>
```

### Org/Workspace Auto-Selection

Some tests depend on proper org/workspace auto-selection. The flow:

1. Login → `/chat`
2. Organizations fetch from `/api/auth/organizations`
3. Auto-select first org (if none selected)
4. Workspaces fetch from `/api/auth/workspaces?org_id={orgId}`
5. Auto-select first workspace (if none selected)

This process takes ~3-4 seconds. Tests use `waitForTimeout` to ensure completion.

### Debugging Staging Tests

To debug issues against staging:

```bash
# Run in headed mode to see what's happening
TEST_ENV=staging bun run test:e2e:headed org-workspace-selection.spec.ts

# Or use debug mode
TEST_ENV=staging bun run test:e2e:debug org-workspace-selection.spec.ts
```

## Test Coverage

Current focus areas:
- ✅ Authentication (login flow)
- ✅ Organization loading and selection
- ✅ Workspace loading and auto-selection
- ✅ Error states and retry functionality
- ⚠️ Chat messaging (needs workspace auto-selection fix)
- ✅ API protection verification

## Future Improvements

- [ ] Add tests for conversation history
- [ ] Add tests for file attachments
- [ ] Add tests for SuperTemplates
- [ ] Add tests for user prompts
- [ ] Fix workspace auto-selection in chat tests
- [ ] Add visual regression testing

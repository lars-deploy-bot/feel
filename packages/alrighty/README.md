# @alive-brug/alrighty

Type-safe API client with Zod validation. Define schemas once, get validated requests and responses everywhere.

## Quick Start

```typescript
// schemas.ts
import { createClient, type SchemaRegistry } from "@alive-brug/alrighty"
import { z } from "zod"

const apiSchemas = {
  user: {
    res: z.object({ id: z.string(), email: z.string() })
  },
  login: {
    req: z.object({ email: z.string().email(), password: z.string() }),
    res: z.object({ ok: z.boolean(), userId: z.string().optional() }),
  },
} as const satisfies SchemaRegistry

export const api = createClient(apiSchemas)
```

```typescript
// anywhere.ts
import { api } from "./schemas"

const user = await api.getty("user")           // GET /api/user
const result = await api.postty("login", {     // POST /api/login
  email: "test@example.com",
  password: "secret"
})
```

That's it. Requests and responses are validated automatically.

## With Type Exports (Recommended)

For larger apps, export convenience types:

```typescript
// schemas.ts
import {
  createClient,
  type SchemaRegistry,
  type Endpoint as GenericEndpoint,
  type Req as GenericReq,
  type Res as GenericRes,
} from "@alive-brug/alrighty"
import { z } from "zod"

export const apiSchemas = {
  user: { res: z.object({ id: z.string(), email: z.string() }) },
  login: {
    req: z.object({ email: z.string().email(), password: z.string() }),
    res: z.object({ ok: z.boolean() }),
  },
} as const satisfies SchemaRegistry

export const api = createClient(apiSchemas)

// Convenience types - bind schemas once, use everywhere
export type Endpoint = GenericEndpoint<typeof apiSchemas>
export type Req<E extends Endpoint> = GenericReq<typeof apiSchemas, E>
export type Res<E extends Endpoint> = GenericRes<typeof apiSchemas, E>
```

```typescript
// Now you can use short types anywhere
import type { Req, Res } from "./schemas"

type LoginBody = Req<"login">     // { email: string, password: string }
type LoginResult = Res<"login">   // { ok: boolean }
```

## API Methods

`createClient()` now enforces endpoint/body rules at compile time:

- `getty` only accepts endpoints without a `req` schema.
- `postty`/`putty`/`patchy` only accept endpoints with a `req` schema.
- For `req: z.object(...)`, body is required.
- For `req: z.undefined()`, body is optional (`undefined`) for no-body mutations.

| Method | HTTP | Body Rule |
|--------|------|-----------|
| `getty(endpoint)` | GET | Endpoint must have no `req` schema |
| `postty(endpoint, body?)` | POST | Endpoint must have `req`; body required unless `req` is `z.undefined()` |
| `putty(endpoint, body)` | PUT | Required |
| `patchy(endpoint, body)` | PATCH | Required |
| `deletty(endpoint, body?)` | DELETE | Works for read endpoints and `req` endpoints; body follows req schema when present |

All methods accept an optional `init` parameter for extra fetch options.

## Options

```typescript
const api = createClient(schemas, {
  basePath: "/api",           // Default: "/api"
  credentials: "include",     // Default: "include"
  headers: {                  // Default headers for all requests
    Authorization: `Bearer ${token}`
  }
})
```

## Error Handling

```typescript
import { ApiError } from "@alive-brug/alrighty"

try {
  await api.getty("user")
} catch (e) {
  if (e instanceof ApiError) {
    e.status          // HTTP status code
    e.code            // Error code string
    e.message         // Error message
    e.details         // Additional error details

    // Helpers
    e.isUnauthorized  // status === 401
    e.isForbidden     // status === 403
    e.isNotFound      // status === 404
    e.isRateLimited   // status === 429
    e.isServerError   // status >= 500
    e.isClientError   // status >= 400 && < 500
    e.isNetworkError  // Network failure
    e.isValidationError // Zod validation failed
  }
}
```

## Schema Rules

- `res` is **required** - every endpoint needs a response schema
- `req` is **optional** - omit for GET/DELETE endpoints
- `path` is **optional** - override URL derivation when schema key is not the route path
- Endpoints without `req` can be called with `getty` (and `deletty`)
- Endpoints with `req` can be called with `postty`/`putty`/`patchy`
- Endpoints with required request schemas cannot be called without a body (`postty`/`deletty` are type-checked)

### `path` override example

```typescript
const apiSchemas = {
  // Lookup key differs from real route path
  "automations/create": {
    path: "automations", // -> /api/automations
    req: z.object({ name: z.string() }),
    res: z.object({ ok: z.literal(true) }),
  },
} as const satisfies SchemaRegistry
```

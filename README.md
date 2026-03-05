# @josh803316/error-handler

A powerful, extensible error handler for JavaScript/TypeScript that converts complex stack traces and cryptic error messages into human-readable responses — while still preserving the full technical detail for debugging.

## Features

- **Human-readable error translation** — ECONNREFUSED, ENOENT, PostgreSQL codes, TypeErrors, and more are automatically converted to plain-English messages
- **Stack trace parsing** — Isolates your user code from `node_modules` and Node internals
- **Error fingerprinting** — Stable hash per error type/location for deduplication in logging
- **Framework adapters** — Ready-made handlers for Elysia, Express, and a generic adapter for Hono/Fastify/etc.
- **Pluggable translation rules** — Register your own error message mappers
- **Zod validation support** — Parse Zod errors into structured, readable issue lists
- **PostgreSQL error codes** — Translates PG codes (23505, 23503, etc.) to human messages
- **Production-safe** — Stack traces hidden by default in `NODE_ENV=production`
- **ESM + CJS** — Dual build, works with Node, Bun, and bundlers

## Install

```bash
# From GitHub Packages
npm install @josh803316/error-handler
# or
bun add @josh803316/error-handler
```

For GitHub Packages, add to `.npmrc`:
```
@josh803316:registry=https://npm.pkg.github.com
```

## Quick Start

### Basic usage

```ts
import { APIError, handleError, isCustomError } from '@josh803316/error-handler';

// Throw a typed HTTP error
throw APIError.NotFound('User not found', { userId: 123 });

// Wrap any caught error
try {
  await db.query('...');
} catch (err) {
  throw handleError(err, 'Database');
}
```

### Human-readable responses

Every error has a `.toHumanReadable()` method that returns a clean, structured object for the UI:

```ts
const err = APIError.InternalServerError('connect ECONNREFUSED 127.0.0.1:5432');

err.toHumanReadable();
// {
//   title: 'Internal Server Error',
//   message: 'Could not connect to the server. Please check if the service is running and the address is correct.',
//   technical: 'connect ECONNREFUSED 127.0.0.1:5432',  // original (expose: true only)
//   code: 500,
//   trace: {
//     summary: 'UserService.create (src/services/user.ts:42)',
//     frames: ['UserService.create (src/services/user.ts:42)', '...'],
//     fullStack: '...'
//   },
//   fingerprint: 'a3f8c01d',
//   timestamp: '2026-03-05T12:00:00.000Z'
// }
```

## Error Classes

### `CustomError` — Base class

```ts
new CustomError(message, {
  expose: true,      // Include stack in output (default: !production)
  logging: true,     // Should this error be logged
  cause: originalErr // Original error for cause chain
})
```

### `APIError` — HTTP errors

Full set of HTTP status code factory methods:

```ts
APIError.BadRequest('Invalid input')          // 400
APIError.Unauthorized('Please log in')        // 401
APIError.Forbidden('Access denied')           // 403
APIError.NotFound('User not found')           // 404
APIError.Conflict('Email already exists')     // 409
APIError.UnprocessableEntity('Bad data')      // 422
APIError.TooManyRequests()                    // 429
APIError.InternalServerError()                // 500
APIError.ServiceUnavailable()                 // 503
// ... and many more
```

### `ValidationError` — Input validation

Works with Zod or any structured issue list:

```ts
// From Zod
import { z } from 'zod';
const schema = z.object({ email: z.string().email() });
const result = schema.safeParse(input);
if (!result.success) {
  throw ValidationError.fromZod(result.error);
}

// From custom issues
throw ValidationError.fromIssues([
  { field: 'email', message: 'Invalid email format', value: 'not-an-email' },
  { field: 'name', message: 'Name is required' },
]);
```

### `DatabaseError` — Database errors

Automatically translates PostgreSQL error codes:

```ts
try {
  await pool.query('INSERT INTO users ...');
} catch (pgErr) {
  throw DatabaseError.fromCause(pgErr, { table: 'users' });
}

// .toHumanReadable() for code 23505 returns:
// { message: 'A record with this value already exists. Please use a unique value.' }
```

### `ElysiaError` — Elysia framework

Maps Elysia's internal error codes to HTTP status codes:

```ts
new ElysiaError('Not found', { code: 'NOT_FOUND' })  // → 404
new ElysiaError('Invalid', { code: 'VALIDATION' })    // → 422
```

## Framework Adapters

### Elysia

```ts
import Elysia from 'elysia';
import { APIError, ElysiaError, createElysiaErrorHandler } from '@josh803316/error-handler';

const app = new Elysia()
  .error({ APIError, ElysiaError })
  .onError(createElysiaErrorHandler({ log: true }));
```

### Express

```ts
import express from 'express';
import { createExpressErrorHandler } from '@josh803316/error-handler';

const app = express();
// ... routes ...
app.use(createExpressErrorHandler({ namespace: 'API' }));
```

### Generic (Hono, Fastify, plain Node)

```ts
import { createErrorHandler } from '@josh803316/error-handler';

const errorHandler = createErrorHandler({ namespace: 'API', log: true });

// In any async route:
try {
  await doSomething();
} catch (err) {
  const { status, body } = errorHandler.handle(err);
  return new Response(JSON.stringify(body), { status });
}

// Or wrap a function:
const result = await errorHandler.wrap(() => riskyOperation());
```

## Custom Message Translation

Register your own error message rules (checked before built-in rules):

```ts
import { registerTranslatorPlugin } from '@josh803316/error-handler';

registerTranslatorPlugin({
  name: 'my-app',
  rules: [
    {
      pattern: /STRIPE_CARD_DECLINED/,
      message: 'Your card was declined. Please check your payment details and try again.',
    },
    {
      pattern: /AUTH_TOKEN_EXPIRED/,
      message: 'Your session has expired. Please log in again.',
    },
    {
      pattern: /quota exceeded/i,
      message: (match, original) => `You have exceeded your usage quota. Original: ${original}`,
    },
  ],
});
```

## Error Registry

Register custom error classes for use with `handleError`:

```ts
import { errorRegistry, handleError } from '@josh803316/error-handler';
import { MyCustomError } from './errors';

errorRegistry.register('MyService', MyCustomError);

// Now this will create a MyCustomError instance:
handleError(err, 'MyService');
```

## Stack Trace Utilities

```ts
import { parseStackTrace, humanizeStackTrace } from '@josh803316/error-handler';

// Parse into structured frames
const parsed = parseStackTrace(error.stack);
parsed.userFrames;  // Only your code, no node_modules
parsed.summary;     // 'UserService.create (src/services/user.ts:42)'

// Get a readable string (first 5 user frames)
humanizeStackTrace(error.stack, 5);
```

## Response Shape

All `toHumanReadable()` calls return this shape:

```ts
interface HumanReadableError {
  title: string;          // Error title (e.g. "Internal Server Error")
  message: string;        // Plain-English description
  technical?: string;     // Original error message (expose: true only)
  code?: string | number; // HTTP status or error code
  trace?: {               // Stack info (expose: true only)
    summary: string;      // One-line origin
    frames: string[];     // User-code frames
    fullStack: string;    // Complete stack
  };
  context?: Record<string, unknown>;  // Extra data (issues, db codes, etc.)
  fingerprint: string;    // 8-char hex for deduplication
  timestamp: string;      // ISO 8601 timestamp
}
```

## Development

```bash
bun install
bun test
bun run build
```

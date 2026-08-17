/**
 * Express framework adapter.
 *
 * Usage:
 * ```ts
 * import express from 'express';
 * import { createExpressErrorHandler } from '@josh803316/error-handler';
 *
 * const app = express();
 * // ... routes ...
 * app.use(createExpressErrorHandler());
 * ```
 */

import type {APIError} from '../errors/APIError';
import {CustomError} from '../core/CustomError';
import {handleError} from '../handler/handleError';

// Use loose types so this adapter works without `@types/express` installed
type Req = Record<string, unknown> & {path?: string; method?: string};
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  headersSent?: boolean;
};
type Next = (err?: unknown) => void;

export interface ExpressHandlerOptions {
  /** Log errors to console (default: true) */
  log?: boolean;
  /** Default namespace to use when wrapping unknown errors */
  namespace?: string;
  /** Custom transform called before sending the response */
  transform?: (err: CustomError, req: Req, res: Res) => unknown;
}

/**
 * Returns an Express error-handling middleware (4-argument form).
 * Must be registered with `app.use()` AFTER all routes.
 */
export function createExpressErrorHandler(opts: ExpressHandlerOptions = {}) {
  const {log = true, namespace = 'API', transform} = opts;

  // Express error handlers must have exactly 4 parameters
  return function errorHandler(err: unknown, req: Req, res: Res, _next: Next): void {
    if (res.headersSent) {
      _next(err);
      return;
    }

    const handled: CustomError =
      err instanceof CustomError ? err : handleError(err, namespace, {path: req.path, method: req.method});

    if (log && handled.logging) {
      console.error(`[${handled.name}]`, handled.message, {
        fingerprint: handled.fingerprint,
        path: req.path,
        method: req.method,
      });
    }

    const statusCode = (handled as APIError).statusCode ?? 500;

    const body = transform ? transform(handled, req, res) : handled.toHumanReadable(statusCode);

    res.status(statusCode).json(body);
  };
}

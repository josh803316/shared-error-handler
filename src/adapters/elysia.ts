/**
 * Elysia framework adapter.
 *
 * Usage:
 * ```ts
 * import Elysia from 'elysia';
 * import { createElysiaErrorHandler, APIError, ElysiaError } from '@josh803316/error-handler';
 *
 * const app = new Elysia()
 *   .error({ APIError, ElysiaError })
 *   .onError(createElysiaErrorHandler());
 * ```
 */

import {APIError} from '../errors/APIError';
import {ElysiaError} from '../errors/ElysiaError';
import {ValidationError} from '../errors/ValidationError';
import {CustomError} from '../core/CustomError';
import {handleError} from '../handler/handleError';

export interface ElysiaErrorContext {
  code: string;
  error: Error | CustomError;
  path?: string;
  set: {status?: number};
  [key: string]: unknown;
}

export interface ElysiaHandlerOptions {
  /** Log errors to console (default: true) */
  log?: boolean;
  /** Custom error transformer called before returning the response */
  transform?: (err: CustomError, ctx: ElysiaErrorContext) => unknown;
}

/**
 * Returns an Elysia `onError` handler that converts all errors to structured,
 * human-readable JSON responses.
 */
export function createElysiaErrorHandler(opts: ElysiaHandlerOptions = {}) {
  const {log = true, transform} = opts;

  return (ctx: ElysiaErrorContext) => {
    const {code, error, set, path} = ctx;
    let handled: CustomError;

    // Handle Elysia's built-in VALIDATION error code
    if (code === 'VALIDATION') {
      // Elysia ValidationError has an `all` property with details
      const validationErr = error as Error & {all?: Array<{path?: string; message?: string; value?: unknown}>};
      if (validationErr.all) {
        handled = ValidationError.fromIssues(
          validationErr.all.map((e) => ({
            field: e.path?.replace(/^\//, '') ?? 'unknown',
            message: e.message ?? 'Invalid value',
            value: e.value,
          })),
        );
      } else {
        handled = new ValidationError(error.message);
      }
    } else if (error instanceof APIError || error instanceof ElysiaError) {
      handled = error;
    } else if (error instanceof CustomError) {
      handled = error;
    } else {
      handled = handleError(error, 'Elysia', {code, path: path ?? ''});
    }

    if (log && handled.logging) {
      console.error(`[${handled.name}]`, handled.message, {
        fingerprint: handled.fingerprint,
        namespace: handled.namespace,
        path,
        code,
      });
    }

    const statusCode = (handled as APIError).statusCode ?? 500;
    set.status = statusCode;

    if (transform) {
      return transform(handled, ctx);
    }

    return (handled as APIError).toHumanReadable
      ? (handled as APIError).toHumanReadable()
      : handled.toHumanReadable();
  };
}

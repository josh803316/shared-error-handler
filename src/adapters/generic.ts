/**
 * Generic/framework-agnostic error handler.
 *
 * Useful for Hono, Fastify, plain Node.js http, or any other framework.
 *
 * Usage:
 * ```ts
 * import { createErrorHandler } from '@josh803316/error-handler/adapters/generic';
 *
 * const handler = createErrorHandler({ namespace: 'API', log: true });
 *
 * // In your route:
 * try {
 *   await doSomething();
 * } catch (err) {
 *   const { status, body } = handler.handle(err);
 *   return new Response(JSON.stringify(body), { status });
 * }
 * ```
 */

import type {APIError} from '../errors/APIError';
import {CustomError} from '../core/CustomError';
import type {HumanReadableError} from '../core/CustomError';
import {handleError} from '../handler/handleError';

export interface ErrorHandlerOptions {
  /** Default namespace for wrapping unknown errors */
  namespace?: string;
  /** Log errors to console (default: true) */
  log?: boolean;
  /** Include stack trace in response (overrides the error's own `expose` setting) */
  expose?: boolean;
}

export interface HandledErrorResult {
  /** HTTP status code to use in the response */
  status: number;
  /** Human-readable error body to send as JSON */
  body: HumanReadableError;
  /** The normalized CustomError instance */
  error: CustomError;
}

/**
 * Create a reusable, framework-agnostic error handler instance.
 */
export function createErrorHandler(opts: ErrorHandlerOptions = {}) {
  const {namespace = 'Default', log = true} = opts;

  return {
    /**
     * Normalize any error into a structured response.
     */
    handle(err: unknown, context?: Record<string, unknown>): HandledErrorResult {
      const handled: CustomError =
        err instanceof CustomError ? err : handleError(err, namespace, context);

      // Apply expose override if set
      if (opts.expose !== undefined) {
        (handled as {expose: boolean}).expose = opts.expose;
      }

      if (log && handled.logging) {
        console.error(`[${handled.name}]`, handled.message, {
          fingerprint: handled.fingerprint,
          ...context,
        });
      }

      const statusCode = (handled as APIError).statusCode ?? 500;
      const body = handled.toHumanReadable(statusCode);

      return {status: statusCode, body, error: handled};
    },

    /**
     * Wrap an async function with automatic error handling.
     */
    wrap<T>(fn: () => Promise<T>): Promise<T | HandledErrorResult> {
      return fn().catch((err: unknown) => this.handle(err));
    },
  };
}

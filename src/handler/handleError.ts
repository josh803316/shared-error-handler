import {CustomError, CustomErrorOpts} from '../core/CustomError';
import {errorRegistry} from '../core/ErrorRegistry';
import {DefaultError} from '../errors/DefaultError';

export interface ErrorMetadata {
  [key: string]: unknown;
  statusCode?: number;
}

/**
 * Normalize any caught value into a `CustomError` subclass.
 *
 * @param error - The caught error (any type)
 * @param namespace - Namespace to look up in the registry (e.g. "API", "Database")
 * @param metadata - Extra metadata merged into the error's errorData
 * @returns A CustomError (or subclass) instance
 *
 * @example
 * ```ts
 * try {
 *   await db.query('...');
 * } catch (err) {
 *   throw handleError(err, 'Database', { query: 'SELECT ...' });
 * }
 * ```
 */
export function handleError(
  error: unknown,
  namespace?: string,
  metadata?: ErrorMetadata,
): CustomError {
  // Already a CustomError — just return it
  if (error instanceof CustomError) {
    return error;
  }

  const raw = error as Error & Record<string, unknown>;
  const {stack, name, message, cause, code, ...rest} = raw;

  const errorData: Record<string, unknown> = {
    stack,
    name,
    code,
    cause: cause instanceof Error ? {name: cause.name, message: cause.message, stack: cause.stack} : cause,
    originalData: rest,
    metadata,
  };

  const resolvedName = namespace ?? (typeof name === 'string' ? name : 'Default');
  const ErrorClass = errorRegistry.get(resolvedName) ?? DefaultError;

  return new ErrorClass(
    typeof message === 'string' && message ? message : 'An unexpected error occurred.',
    errorData as CustomErrorOpts,
  );
}

/**
 * Type guard — check if a value is a CustomError.
 */
export function isCustomError(err: unknown): err is CustomError {
  return err instanceof CustomError;
}

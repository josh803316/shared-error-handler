import type {CustomError, CustomErrorOpts} from './CustomError';

type ErrorConstructor = new (message: string, errorData?: CustomErrorOpts) => CustomError;

/**
 * A registry mapping namespace strings to error classes.
 * Used by `handleError` to select the correct error class for a given error.
 */
class ErrorRegistry {
  private _map = new Map<string, ErrorConstructor>();

  register(namespace: string, ErrorClass: ErrorConstructor): void {
    this._map.set(namespace, ErrorClass);
  }

  unregister(namespace: string): void {
    this._map.delete(namespace);
  }

  get(namespace: string): ErrorConstructor | undefined {
    return this._map.get(namespace);
  }

  has(namespace: string): boolean {
    return this._map.has(namespace);
  }

  keys(): string[] {
    return [...this._map.keys()];
  }
}

export const errorRegistry = new ErrorRegistry();

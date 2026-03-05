import {APIError} from './APIError';
import {CustomErrorOpts, HumanReadableError} from '../core/CustomError';

const ELYSIA_CODE_MAP: Record<string, number> = {
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  VALIDATION: 422,
  PARSE: 400,
  UNKNOWN: 500,
  INVALID_COOKIE_SIGNATURE: 400,
};

export interface ElysiaErrorOpts extends CustomErrorOpts {
  /** Elysia internal error code (e.g. "NOT_FOUND", "VALIDATION") */
  code?: string;
}

/**
 * An error tailored for Elysia framework error handling.
 * Automatically maps Elysia error codes to HTTP status codes.
 */
export class ElysiaError extends APIError {
  constructor(message: string, errorData?: ElysiaErrorOpts, statusCode?: number) {
    super(message, errorData);
    Object.setPrototypeOf(this, ElysiaError.prototype);

    this._namespace = 'Elysia';
    this.name = 'ElysiaError';

    this.statusCode = statusCode ?? this._resolveElysiaCode(errorData?.code) ?? 500;
  }

  private _resolveElysiaCode(code?: string): number | undefined {
    if (!code) return undefined;
    return ELYSIA_CODE_MAP[code];
  }

  override get error() {
    return {
      ...super.error,
      elysiaCode: this._errorData?.code,
    };
  }

  override toHumanReadable(): HumanReadableError {
    return super.toHumanReadable();
  }
}

import {CustomError, CustomErrorInfo, CustomErrorOpts, HumanReadableError} from '../core/CustomError';
import {httpStatusMessage} from '../core/MessageTranslator';
import {postgresErrorCodes, postgresHumanMessages} from '../db/postgres-codes';

const classNamespace = 'API';

export class APIError extends CustomError {
  code?: string | number;
  statusCode: number;

  constructor(message: string, errorData?: CustomErrorOpts, statusCode?: number) {
    super(message, errorData ?? {});

    this.statusCode =
      statusCode !== undefined
        ? statusCode
        : typeof errorData?.statusCode === 'number'
          ? errorData.statusCode
          : typeof errorData?.status === 'number'
            ? errorData.status
            : 500;

    Object.setPrototypeOf(this, APIError.prototype);

    this._namespace = classNamespace;
    this._resolveDbErrorCode(errorData);
  }

  private _resolveDbErrorCode(errorData?: CustomErrorOpts): void {
    const cause = errorData?.cause;
    if (cause && typeof cause === 'object' && 'code' in cause) {
      const dbCode = (cause as {code?: string}).code;
      if (dbCode && postgresErrorCodes[dbCode]) {
        this.code = postgresErrorCodes[dbCode];
      }
    }
  }

  override get error(): CustomErrorInfo {
    return {
      code: this.statusCode,
      statusCode: this.statusCode,
      name: this.name,
      namespace: this.namespace,
      providers: this.providers,
      message: this.message,
      expose: this.expose,
      logging: this.logging,
      fingerprint: this.fingerprint,
      timestamp: new Date().toISOString(),
      errorData: this.errorData,
      ...(this.expose && {
        stack: this.stack,
        cause: this.getOriginalCause,
      }),
    };
  }

  override toHumanReadable(): HumanReadableError {
    const base = super.toHumanReadable(this.statusCode);

    // Try to get a better human message from postgres codes if we have a db error
    const cause = this._errorData?.cause as {code?: string} | undefined;
    if (cause?.code && postgresHumanMessages[cause.code]) {
      base.message = postgresHumanMessages[cause.code]!;
    } else if (!base.message || base.message === this.message) {
      // Fall back to HTTP status description if no translation found
      base.message = httpStatusMessage(this.statusCode);
    }

    return base;
  }

  // ─── Static factory methods ───────────────────────────────────────────────

  static BadRequest(message = 'Bad Request', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 400);
  }

  static Unauthorized(message = 'Unauthorized', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 401);
  }

  static PaymentRequired(message = 'Payment Required', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 402);
  }

  static Forbidden(message = 'Forbidden', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 403);
  }

  static NotFound(message = 'Not Found', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 404);
  }

  static MethodNotAllowed(message = 'Method Not Allowed', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 405);
  }

  static Conflict(message = 'Conflict', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 409);
  }

  static Gone(message = 'Requested resource is no longer available', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 410);
  }

  static UnprocessableEntity(
    message = 'Request data is invalid or cannot be processed',
    errorData?: CustomErrorOpts,
  ): APIError {
    return new APIError(message, errorData, 422);
  }

  static TooManyRequests(message = 'Too Many Requests', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 429);
  }

  static InternalServerError(message = 'Internal Server Error', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 500);
  }

  static NotImplemented(message = 'Not Implemented', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 501);
  }

  static BadGateway(message = 'Bad Gateway', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 502);
  }

  static ServiceUnavailable(message = 'Service Unavailable', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 503);
  }

  static GatewayTimeout(message = 'Gateway Timeout', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 504);
  }

  static LengthRequired(message = 'Content length is required', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 411);
  }

  static PreconditionFailed(
    message = 'Precondition for the request failed',
    errorData?: CustomErrorOpts,
  ): APIError {
    return new APIError(message, errorData, 412);
  }

  static UnsupportedMediaType(message = 'Unsupported media type', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 415);
  }

  static IAmATeapot(message = "I'm a teapot", errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 418);
  }

  static MisdirectedRequest(
    message = 'The request was directed to an incorrect server',
    errorData?: CustomErrorOpts,
  ): APIError {
    return new APIError(message, errorData, 421);
  }

  static UpgradeRequired(
    message = 'The server requires the client to upgrade to a newer version',
    errorData?: CustomErrorOpts,
  ): APIError {
    return new APIError(message, errorData, 426);
  }

  static TooEarly(message = 'Too Early', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 425);
  }

  static RequestHeaderFieldsTooLarge(
    message = 'The request headers are too large',
    errorData?: CustomErrorOpts,
  ): APIError {
    return new APIError(message, errorData, 431);
  }

  static UnavailableForLegalReasons(
    message = 'Unavailable for legal reasons',
    errorData?: CustomErrorOpts,
  ): APIError {
    return new APIError(message, errorData, 451);
  }

  static InsufficientStorage(
    message = 'The server does not have sufficient storage available',
    errorData?: CustomErrorOpts,
  ): APIError {
    return new APIError(message, errorData, 507);
  }

  static LoopDetected(message = 'An infinite loop has been detected', errorData?: CustomErrorOpts): APIError {
    return new APIError(message, errorData, 508);
  }
}

import {httpStatusMessage, translateMessage} from './MessageTranslator';
import {ParsedStackTrace, extractProviders, parseStackTrace} from './StackTraceParser';
import {fingerprintError} from '../utils/fingerprint';

export type CustomErrorOpts = {
  [key: string]: unknown;
};

/**
 * The structured response shape for human-readable error output.
 */
export interface HumanReadableError {
  /** Short error title (e.g. "Internal Server Error") */
  title: string;
  /** Human-readable description of what went wrong */
  message: string;
  /** Original technical error message (only included when expose: true) */
  technical?: string;
  /** HTTP status code or custom error code */
  code?: string | number;
  /** Parsed stack trace information (only included when expose: true) */
  trace?: {
    /** One-line summary of where the error originated */
    summary: string;
    /** User-code frames only, formatted as strings */
    frames: string[];
    /** Full raw stack trace */
    fullStack: string;
  };
  /** Extra context from errorData */
  context?: Record<string, unknown>;
  /** Stable fingerprint for deduplication */
  fingerprint: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * The raw error info shape (used internally and for framework integrations).
 */
export interface CustomErrorInfo {
  [key: string]: unknown;
  message: string;
  providers: string | string[];
  stack?: string;
}

const isProduction = process.env.NODE_ENV === 'production';

export class CustomError extends Error {
  protected _cause: unknown;
  protected _causeStack: string | undefined;
  protected _errorData: Record<string, unknown> | undefined;
  protected _parsedStack: ParsedStackTrace | undefined;
  _namespace: string | undefined;

  override stack!: string;
  providers: string | string[];
  expose: boolean;
  logging: boolean;

  public constructor(
    public override message: string,
    errorData: Record<string, unknown> = {},
  ) {
    super(message);
    this._errorData = Object.keys(errorData).length ? errorData : undefined;

    // Capture the stack trace, excluding this constructor
    Error.captureStackTrace(this, this.constructor);
    this.stack = this.stack || '';

    // Must be called before accessing any instance methods in subclasses.
    // Subclasses should call Object.setPrototypeOf(this, SubClass.prototype) immediately after super().
    Object.setPrototypeOf(this, new.target.prototype);

    const {name, expose, logging, cause} = errorData;
    this.name = typeof name === 'string' ? name : this.constructor.name;
    this.expose = typeof expose === 'boolean' ? expose : !isProduction;
    this.logging = typeof logging === 'boolean' ? logging : true;

    this._cause = cause;
    this._causeStack = (cause as Error)?.stack;

    // Derive providers from cause stack or own stack
    const stackForProviders = this._causeStack ?? this.stack;
    this.providers = stackForProviders ? extractProviders(stackForProviders) : ['unknown'];
    if ((this.providers as string[]).length === 0) {
      this.providers = [this.name];
    }
  }

  get namespace(): string | undefined {
    return this._namespace;
  }

  get errorData(): Record<string, unknown> | undefined {
    return this._errorData;
  }

  /**
   * Parse the stack trace into structured frames (cached).
   */
  get parsedStack(): ParsedStackTrace | undefined {
    if (!this.stack) return undefined;
    if (!this._parsedStack) {
      this._parsedStack = parseStackTrace(this.stack);
    }
    return this._parsedStack;
  }

  /**
   * A stable fingerprint for this error instance, useful for deduplication in logging/tracking.
   */
  get fingerprint(): string {
    const summary = this.parsedStack?.summary ?? '';
    return fingerprintError(this.name, this.message, summary);
  }

  /**
   * The original cause's stack trace string, if available.
   */
  get getOriginalCause(): string | undefined {
    return this._causeStack;
  }

  /**
   * Returns structured error info suitable for logging or framework responses.
   */
  get error(): CustomErrorInfo {
    const info: CustomErrorInfo = {
      message: this.message,
      name: this.name,
      namespace: this.namespace,
      providers: this.providers,
      expose: this.expose,
      logging: this.logging,
      fingerprint: this.fingerprint,
      timestamp: new Date().toISOString(),
      errorData: this.errorData,
    };

    if (this.expose) {
      info.stack = this.stack;
      info.cause = this.getOriginalCause;
    }

    return info;
  }

  /**
   * Returns a human-readable error object suitable for sending to the UI.
   *
   * - `message` is a plain-English translation of what went wrong
   * - `technical` contains the raw error message (only when expose: true)
   * - `trace` contains simplified stack trace info (only when expose: true)
   *
   * @param statusCode - Optional HTTP status code for the HTTP message lookup
   */
  toHumanReadable(statusCode?: number): HumanReadableError {
    const humanMessage = translateMessage(this.message);
    const title = statusCode ? this._httpStatusTitle(statusCode) : this.name;

    const result: HumanReadableError = {
      title,
      message: humanMessage,
      code: statusCode,
      fingerprint: this.fingerprint,
      timestamp: new Date().toISOString(),
    };

    if (this.expose) {
      result.technical = this.message !== humanMessage ? this.message : undefined;

      if (this.parsedStack) {
        result.trace = {
          summary: this.parsedStack.summary,
          frames: this.parsedStack.userFrames.slice(0, 8).map((f) => f.raw.trim()),
          fullStack: this.stack,
        };
      }
    }

    // Include non-internal error context
    if (this._errorData) {
      const {name, expose, logging, cause, stack, ...rest} = this._errorData;
      void name; void expose; void logging; void cause; void stack;
      if (Object.keys(rest).length > 0) {
        result.context = rest as Record<string, unknown>;
      }
    }

    return result;
  }

  /**
   * Returns a clean JSON-serializable object for API responses.
   * Respects the `expose` flag for stack trace visibility.
   */
  toResponse(): Record<string, unknown> {
    return this.toHumanReadable() as unknown as Record<string, unknown>;
  }

  toJSON(): Record<string, unknown> {
    return this.error as Record<string, unknown>;
  }

  private _httpStatusTitle(status: number): string {
    const titles: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      409: 'Conflict',
      410: 'Gone',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return titles[status] ?? this.name;
  }
}

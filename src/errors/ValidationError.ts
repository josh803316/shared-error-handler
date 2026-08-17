import {APIError} from './APIError';
import type {CustomErrorOpts, HumanReadableError} from '../core/CustomError';

export interface ValidationIssue {
  field: string;
  message: string;
  value?: unknown;
  code?: string;
}

export interface ValidationErrorOpts extends CustomErrorOpts {
  issues?: ValidationIssue[];
  /** Raw Zod error or other validation library error */
  validationError?: unknown;
}

/**
 * Represents a validation failure (HTTP 422).
 *
 * Supports structured issues from any validation library (Zod, Yup, custom).
 * Pass issues directly, or pass a Zod error as `validationError` and it will
 * be parsed automatically.
 */
export class ValidationError extends APIError {
  issues: ValidationIssue[];

  constructor(message = 'Validation failed', opts: ValidationErrorOpts = {}) {
    super(message, opts, 422);
    Object.setPrototypeOf(this, ValidationError.prototype);

    this._namespace = 'Validation';
    this.name = 'ValidationError';

    this.issues = opts.issues ?? ValidationError._parseZodError(opts.validationError) ?? [];
  }

  private static _parseZodError(err: unknown): ValidationIssue[] | null {
    if (!err || typeof err !== 'object') return null;

    // Zod errors have a `issues` array with `path`, `message`, `code`
    const zodErr = err as {issues?: Array<{path?: (string | number)[]; message?: string; code?: string}>};
    if (!Array.isArray(zodErr.issues)) return null;

    return zodErr.issues.map((issue) => ({
      field: issue.path?.join('.') ?? 'unknown',
      message: issue.message ?? 'Invalid value',
      code: issue.code,
    }));
  }

  override get error() {
    return {
      ...super.error,
      issues: this.issues,
    };
  }

  override toHumanReadable(): HumanReadableError {
    const base = super.toHumanReadable();

    base.message =
      this.issues.length > 0
        ? `Validation failed with ${this.issues.length} error${this.issues.length > 1 ? 's' : ''}.`
        : 'The provided data is invalid. Please review your input and try again.';

    if (this.issues.length > 0) {
      base.context = {
        ...(base.context ?? {}),
        issues: this.issues.map((issue) => ({
          field: issue.field,
          message: issue.message,
          ...(issue.value === undefined ? {} : {value: issue.value}),
        })),
      };
    }

    return base;
  }

  /**
   * Create a ValidationError from a Zod error object.
   */
  static fromZod(zodError: unknown, message?: string): ValidationError {
    return new ValidationError(message ?? 'Validation failed', {validationError: zodError});
  }

  /**
   * Create a ValidationError from an array of field-level issues.
   */
  static fromIssues(issues: ValidationIssue[], message?: string): ValidationError {
    return new ValidationError(message ?? 'Validation failed', {issues});
  }
}

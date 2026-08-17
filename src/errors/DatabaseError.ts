import {CustomError, type CustomErrorOpts, type HumanReadableError} from '../core/CustomError';
import {postgresErrorCodes, postgresHumanMessages} from '../db/postgres-codes';

export interface DatabaseErrorOpts extends CustomErrorOpts {
  /** PostgreSQL or other database error code */
  dbCode?: string;
  /** The SQL query that caused the error (omitted from responses in production) */
  query?: string;
  /** Table or entity name involved */
  table?: string;
  /** Column or field name involved */
  column?: string;
}

/**
 * Represents a database-level error with human-readable translation
 * of database error codes (PostgreSQL supported out of the box).
 */
export class DatabaseError extends CustomError {
  dbCode?: string;
  dbCodeName?: string;
  table?: string;
  column?: string;

  constructor(message: string, opts: DatabaseErrorOpts = {}) {
    super(message, opts);
    Object.setPrototypeOf(this, DatabaseError.prototype);

    this._namespace = 'Database';
    this.name = 'DatabaseError';

    this.dbCode = opts.dbCode ?? this._extractCodeFromCause(opts.cause);
    this.dbCodeName = this.dbCode ? postgresErrorCodes[this.dbCode] : undefined;
    this.table = opts.table;
    this.column = opts.column;
  }

  private _extractCodeFromCause(cause: unknown): string | undefined {
    if (cause && typeof cause === 'object' && 'code' in cause) {
      const code = (cause as {code?: unknown}).code;
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }

  override get error() {
    return {
      ...super.error,
      dbCode: this.dbCode,
      dbCodeName: this.dbCodeName,
      ...(this.table && {table: this.table}),
      ...(this.column && {column: this.column}),
    };
  }

  override toHumanReadable(): HumanReadableError {
    const base = super.toHumanReadable();

    if (this.dbCode && postgresHumanMessages[this.dbCode]) {
      base.message = postgresHumanMessages[this.dbCode]!;
    } else {
      base.message = 'A database error occurred. Please try again or contact support.';
    }

    if (this.dbCode) {
      base.context = {
        ...(base.context ?? {}),
        dbCode: this.dbCode,
        dbCodeName: this.dbCodeName,
      };
    }

    return base;
  }

  /**
   * Wrap a raw database error (e.g. from `pg`) into a DatabaseError.
   */
  static fromCause(cause: unknown, context?: DatabaseErrorOpts): DatabaseError {
    const msg =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'A database error occurred.';

    return new DatabaseError(msg, {
      ...context,
      cause: cause as Error,
    });
  }
}

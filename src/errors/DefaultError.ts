import {CustomError, CustomErrorInfo, CustomErrorOpts} from '../core/CustomError';

/**
 * A general-purpose error for cases that don't fit a more specific type.
 */
export class DefaultError extends CustomError {
  constructor(message: string, errorData: CustomErrorOpts = {}) {
    super(message, errorData);
    this._namespace = 'Default';
    this.name = 'DefaultError';
    Object.setPrototypeOf(this, DefaultError.prototype);
  }

  override get error(): CustomErrorInfo {
    return {
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
}

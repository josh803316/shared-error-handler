// Core base class
export {CustomError} from './src/core/CustomError';
export type {CustomErrorInfo, CustomErrorOpts, HumanReadableError} from './src/core/CustomError';

// Error classes
export {APIError} from './src/errors/APIError';
export {ElysiaError} from './src/errors/ElysiaError';
export {ValidationError} from './src/errors/ValidationError';
export type {ValidationIssue, ValidationErrorOpts} from './src/errors/ValidationError';
export {DatabaseError} from './src/errors/DatabaseError';
export type {DatabaseErrorOpts} from './src/errors/DatabaseError';
export {DefaultError} from './src/errors/DefaultError';

// Core utilities
export {errorRegistry} from './src/core/ErrorRegistry';
export {registerTranslatorPlugin, unregisterTranslatorPlugin, translateMessage, httpStatusMessage} from './src/core/MessageTranslator';
export type {MessageRule, TranslatorPlugin} from './src/core/MessageTranslator';
export {parseStackTrace, humanizeStackTrace, extractProviders} from './src/core/StackTraceParser';
export type {StackFrame, ParsedStackTrace} from './src/core/StackTraceParser';

// Error handler
export {handleError, isCustomError} from './src/handler/handleError';
export type {ErrorMetadata} from './src/handler/handleError';

// Framework adapters
export {createElysiaErrorHandler} from './src/adapters/elysia';
export type {ElysiaHandlerOptions, ElysiaErrorContext} from './src/adapters/elysia';
export {createExpressErrorHandler} from './src/adapters/express';
export type {ExpressHandlerOptions} from './src/adapters/express';
export {createErrorHandler} from './src/adapters/generic';
export type {ErrorHandlerOptions, HandledErrorResult} from './src/adapters/generic';

// Database codes
export {postgresErrorCodes, postgresHumanMessages} from './src/db/postgres-codes';

// Fingerprint utility
export {fingerprintError} from './src/utils/fingerprint';

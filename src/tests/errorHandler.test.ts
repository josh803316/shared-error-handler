import {describe, it, expect, beforeEach} from 'bun:test';
import {
  CustomError,
  APIError,
  ValidationError,
  DatabaseError,
  DefaultError,
  ElysiaError,
  handleError,
  isCustomError,
  errorRegistry,
  registerTranslatorPlugin,
  unregisterTranslatorPlugin,
  translateMessage,
  parseStackTrace,
  humanizeStackTrace,
  fingerprintError,
} from '../../index';

// ─── CustomError ──────────────────────────────────────────────────────────────

describe('CustomError', () => {
  it('creates with message and defaults', () => {
    const err = new CustomError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.name).toBe('CustomError');
    expect(err.stack).toBeDefined();
    expect(err.logging).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('respects expose option', () => {
    const hidden = new CustomError('oops', {expose: false});
    expect(hidden.expose).toBe(false);
    expect(hidden.error.stack).toBeUndefined();

    const visible = new CustomError('oops', {expose: true});
    expect(visible.expose).toBe(true);
    expect(visible.error.stack).toBeDefined();
  });

  it('generates a consistent fingerprint', () => {
    const err = new CustomError('oops');
    const fp1 = err.fingerprint;
    const fp2 = err.fingerprint;
    expect(fp1).toBe(fp2);
    expect(typeof fp1).toBe('string');
    expect(fp1.length).toBe(8);
  });

  it('toHumanReadable returns structured output', () => {
    const err = new CustomError('ENOENT: no such file or directory, open "/etc/secret"', {expose: true});
    const hr = err.toHumanReadable();
    expect(hr.title).toBe('CustomError');
    expect(hr.message).toMatch(/File or directory not found/);
    expect(hr.fingerprint).toBeDefined();
    expect(hr.timestamp).toBeDefined();
    expect(hr.trace).toBeDefined();
  });

  it('toHumanReadable does not expose stack when expose: false', () => {
    const err = new CustomError('oops', {expose: false});
    const hr = err.toHumanReadable();
    expect(hr.trace).toBeUndefined();
    expect(hr.technical).toBeUndefined();
  });

  it('parses stack trace', () => {
    const err = new CustomError('test');
    const parsed = err.parsedStack;
    expect(parsed).toBeDefined();
    expect(parsed?.frames.length).toBeGreaterThan(0);
    expect(parsed?.summary).toBeDefined();
  });

  it('captures cause stack', () => {
    const cause = new Error('original cause');
    const err = new CustomError('wrapped', {cause});
    expect(err.getOriginalCause).toBeDefined();
  });
});

// ─── APIError ─────────────────────────────────────────────────────────────────

describe('APIError', () => {
  it('creates with correct status code', () => {
    const err = new APIError('not found', {}, 404);
    expect(err.statusCode).toBe(404);
    expect(err.namespace).toBe('API');
  });

  it('static factories set correct status codes', () => {
    expect(APIError.BadRequest().statusCode).toBe(400);
    expect(APIError.Unauthorized().statusCode).toBe(401);
    expect(APIError.Forbidden().statusCode).toBe(403);
    expect(APIError.NotFound().statusCode).toBe(404);
    expect(APIError.Conflict().statusCode).toBe(409);
    expect(APIError.UnprocessableEntity().statusCode).toBe(422);
    expect(APIError.TooManyRequests().statusCode).toBe(429);
    expect(APIError.InternalServerError().statusCode).toBe(500);
    expect(APIError.BadGateway().statusCode).toBe(502);
    expect(APIError.ServiceUnavailable().statusCode).toBe(503);
    expect(APIError.GatewayTimeout().statusCode).toBe(504);
  });

  it('includes statusCode in error response', () => {
    const err = APIError.NotFound('page missing');
    const info = err.error;
    expect(info.statusCode).toBe(404);
    expect(info.message).toBe('page missing');
  });

  it('toHumanReadable returns HTTP message for status', () => {
    const err = APIError.InternalServerError('db exploded');
    const hr = err.toHumanReadable();
    expect(hr.code).toBe(500);
    expect(hr.title).toBe('Internal Server Error');
    expect(hr.message).toMatch(/unexpected server error|server error/i);
  });

  it('resolves postgres error code from cause', () => {
    const dbError = {code: '23505', message: 'duplicate key', name: 'DatabaseError'};
    const err = new APIError('duplicate entry', {cause: dbError}, 409);
    expect(err.code).toBe('unique_violation');
  });
});

// ─── ValidationError ──────────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('creates with issues array', () => {
    const err = ValidationError.fromIssues([
      {field: 'email', message: 'Invalid email format', value: 'not-an-email'},
      {field: 'name', message: 'Name is required'},
    ]);
    expect(err.statusCode).toBe(422);
    expect(err.issues.length).toBe(2);
    expect(err.name).toBe('ValidationError');
  });

  it('parses Zod-shaped errors', () => {
    const zodError = {
      issues: [
        {path: ['user', 'email'], message: 'Invalid email', code: 'invalid_string'},
        {path: ['age'], message: 'Must be a number', code: 'invalid_type'},
      ],
    };
    const err = ValidationError.fromZod(zodError);
    expect(err.issues.length).toBe(2);
    expect(err.issues[0].field).toBe('user.email');
    expect(err.issues[1].field).toBe('age');
  });

  it('toHumanReadable includes issues in context', () => {
    const err = ValidationError.fromIssues([
      {field: 'email', message: 'Invalid email'},
    ]);
    const hr = err.toHumanReadable();
    expect(hr.message).toMatch(/validation failed/i);
    expect(hr.context?.issues).toBeDefined();
  });
});

// ─── DatabaseError ────────────────────────────────────────────────────────────

describe('DatabaseError', () => {
  it('creates from cause with pg error code', () => {
    const pgError = {code: '23505', message: 'duplicate key value violates unique constraint', name: 'error'};
    const err = DatabaseError.fromCause(pgError);
    expect(err.dbCode).toBe('23505');
    expect(err.dbCodeName).toBe('unique_violation');
  });

  it('toHumanReadable translates pg code 23505', () => {
    const pgError = {code: '23505', message: 'duplicate key value', name: 'error'};
    const err = DatabaseError.fromCause(pgError);
    const hr = err.toHumanReadable();
    expect(hr.message).toMatch(/already exists/i);
  });

  it('toHumanReadable for unknown db error', () => {
    const err = new DatabaseError('something broke in the db');
    const hr = err.toHumanReadable();
    expect(hr.message).toMatch(/database error/i);
  });
});

// ─── ElysiaError ──────────────────────────────────────────────────────────────

describe('ElysiaError', () => {
  it('maps Elysia NOT_FOUND code to 404', () => {
    const err = new ElysiaError('page not found', {code: 'NOT_FOUND'});
    expect(err.statusCode).toBe(404);
  });

  it('maps Elysia VALIDATION code to 422', () => {
    const err = new ElysiaError('invalid input', {code: 'VALIDATION'});
    expect(err.statusCode).toBe(422);
  });

  it('defaults to 500 for unknown code', () => {
    const err = new ElysiaError('something broke');
    expect(err.statusCode).toBe(500);
  });
});

// ─── handleError ──────────────────────────────────────────────────────────────

describe('handleError', () => {
  beforeEach(() => {
    // Register classes for tests
    errorRegistry.register('API', APIError as never);
    errorRegistry.register('Default', DefaultError as never);
  });

  it('passes through CustomError instances', () => {
    const original = new APIError('already wrapped', {}, 400);
    const result = handleError(original);
    expect(result).toBe(original);
  });

  it('wraps a plain Error', () => {
    const plain = new Error('something broke');
    const result = handleError(plain, 'Default');
    expect(result instanceof CustomError).toBe(true);
    expect(result.message).toBe('something broke');
  });

  it('wraps a non-Error value', () => {
    const result = handleError('just a string', 'Default');
    expect(result instanceof CustomError).toBe(true);
  });

  it('falls back to DefaultError for unknown namespace', () => {
    const plain = new Error('oops');
    const result = handleError(plain, 'UnknownNamespace');
    expect(result instanceof DefaultError).toBe(true);
  });

  it('isCustomError type guard works', () => {
    expect(isCustomError(new CustomError('x'))).toBe(true);
    expect(isCustomError(new Error('x'))).toBe(false);
    expect(isCustomError('string')).toBe(false);
    expect(isCustomError(null)).toBe(false);
  });
});

// ─── MessageTranslator ────────────────────────────────────────────────────────

describe('translateMessage', () => {
  it('translates ECONNREFUSED', () => {
    const msg = translateMessage('connect ECONNREFUSED 127.0.0.1:5432');
    expect(msg).toMatch(/Could not connect/i);
  });

  it('translates ENOENT with path', () => {
    const msg = translateMessage("ENOENT: no such file or directory, open '/etc/secret.json'");
    expect(msg).toMatch(/File or directory not found/i);
  });

  it('translates TypeError', () => {
    const msg = translateMessage('Cannot read properties of undefined (reading "id")');
    expect(msg).toMatch(/undefined/i);
  });

  it('returns original message if no rule matches', () => {
    const original = 'Some very specific app error that nobody mapped';
    expect(translateMessage(original)).toBe(original);
  });

  it('respects registered plugins with priority', () => {
    registerTranslatorPlugin({
      name: 'test-plugin',
      rules: [{pattern: 'MY_CUSTOM_CODE', message: 'This is my custom human message.'}],
    });

    const result = translateMessage('Error: MY_CUSTOM_CODE in service');
    expect(result).toBe('This is my custom human message.');

    unregisterTranslatorPlugin('test-plugin');
  });
});

// ─── StackTraceParser ─────────────────────────────────────────────────────────

describe('parseStackTrace', () => {
  it('parses a V8 stack trace', () => {
    const stack = `Error: something broke
    at doSomething (src/service.ts:42:10)
    at Object.<anonymous> (src/index.ts:10:5)
    at node_modules/elysia/dist/index.js:100:20
    at node:internal/process/task_queues:140:5`;

    const parsed = parseStackTrace(stack);
    expect(parsed.message).toBe('Error: something broke');
    expect(parsed.frames.length).toBe(4);

    const userFrames = parsed.frames.filter((f) => !f.isNodeModules && !f.isInternal);
    expect(userFrames.length).toBe(2);
    expect(userFrames[0].file).toContain('service.ts');
    expect(userFrames[0].line).toBe(42);
    expect(parsed.summary).toContain('service.ts');
  });

  it('humanizeStackTrace returns only user frames', () => {
    const stack = `Error: oops
    at myFunc (src/app.ts:10:5)
    at node_modules/express/lib/router.js:50:10`;

    const result = humanizeStackTrace(stack);
    expect(result).toContain('app.ts');
    expect(result).not.toContain('node_modules');
  });
});

// ─── Fingerprinting ───────────────────────────────────────────────────────────

describe('fingerprintError', () => {
  it('returns consistent 8-char hex string', () => {
    const fp = fingerprintError('APIError', 'Not Found', 'src/routes.ts:42');
    expect(typeof fp).toBe('string');
    expect(fp.length).toBe(8);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
  });

  it('differs for different inputs', () => {
    const fp1 = fingerprintError('APIError', 'Not Found', 'routes.ts:10');
    const fp2 = fingerprintError('APIError', 'Server Error', 'routes.ts:10');
    expect(fp1).not.toBe(fp2);
  });

  it('is stable across calls', () => {
    const fp1 = fingerprintError('DBError', 'unique_violation', 'service.ts:88');
    const fp2 = fingerprintError('DBError', 'unique_violation', 'service.ts:88');
    expect(fp1).toBe(fp2);
  });
});

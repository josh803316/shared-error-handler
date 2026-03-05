/**
 * Translates cryptic error messages and codes into human-readable descriptions.
 * Supports built-in rules for Node.js system errors, PostgreSQL codes, HTTP statuses,
 * and a pluggable registry for custom rules.
 */

export type MessageRule = {
  /** Pattern to match against error message or code */
  pattern: string | RegExp;
  /** Human-readable replacement. Use $1, $2 etc. for regex capture groups. */
  message: string | ((match: RegExpMatchArray, original: string) => string);
};

export type TranslatorPlugin = {
  name: string;
  rules: MessageRule[];
};

// Built-in Node.js system error translations
const NODE_SYSTEM_RULES: MessageRule[] = [
  {
    pattern: /ECONNREFUSED/,
    message: 'Could not connect to the server. Please check if the service is running and the address is correct.',
  },
  {
    pattern: /ECONNRESET/,
    message: 'The connection was reset unexpectedly. The remote server may have closed the connection.',
  },
  {
    pattern: /ENOTFOUND/,
    message: (m, orig) => {
      const host = orig.match(/ENOTFOUND\s+(\S+)/)?.[1];
      return host
        ? `Could not resolve host "${host}". Please check the hostname or your network connection.`
        : 'Could not resolve the hostname. Please check your network connection.';
    },
  },
  {
    pattern: /ETIMEDOUT/,
    message: 'The connection timed out. The server took too long to respond.',
  },
  {
    pattern: /ENOENT/,
    message: (m, orig) => {
      const path = orig.match(/ENOENT[^']*'([^']+)'/)?.[1] ?? orig.match(/no such file or directory,?\s*(.+)/i)?.[1];
      return path ? `File or directory not found: "${path}"` : 'File or directory not found.';
    },
  },
  {
    pattern: /EACCES/,
    message: 'Permission denied. You do not have the required permissions to access this resource.',
  },
  {
    pattern: /EADDRINUSE/,
    message: (m, orig) => {
      const port = orig.match(/:(\d+)/)?.[1];
      return port ? `Port ${port} is already in use. Please choose a different port.` : 'The address is already in use.';
    },
  },
  {
    pattern: /EADDRNOTAVAIL/,
    message: 'The requested network address is not available on this machine.',
  },
  {
    pattern: /EPIPE/,
    message: 'The connection was closed before the response was sent. The client may have disconnected.',
  },
  {
    pattern: /EMFILE/,
    message: 'Too many files are open. The process has reached its file descriptor limit.',
  },
  {
    pattern: /ENOMEM/,
    message: 'The system ran out of memory. Please free up resources and try again.',
  },
  {
    pattern: /ERANGE/,
    message: 'A value is out of the allowed range.',
  },
  {
    pattern: /EINVAL/,
    message: 'An invalid argument was provided.',
  },
  {
    pattern: /Cannot read propert(?:y|ies) of (undefined|null)/,
    message: (m) =>
      `Attempted to access a property on ${m[1]}, which means an expected object was missing. Check that all required data is initialized before use.`,
  },
  {
    pattern: /is not a function/,
    message: (m, orig) => {
      const subject = orig.match(/^(.+) is not a function/)?.[1];
      return subject
        ? `"${subject}" is not callable. It may be undefined, or you may be calling it incorrectly.`
        : 'Attempted to call something that is not a function. Check that the method or variable is properly defined.';
    },
  },
  {
    pattern: /is not defined/,
    message: (m, orig) => {
      const subject = orig.match(/^(\S+) is not defined/)?.[1];
      return subject
        ? `"${subject}" has not been defined. Make sure it is imported or declared before use.`
        : 'A variable or function was used before it was defined.';
    },
  },
  {
    pattern: /Maximum call stack size exceeded/,
    message:
      'The code entered an infinite loop or recursion. A function called itself too many times without stopping.',
  },
  {
    pattern: /JSON\.parse/,
    message: 'Failed to parse JSON. The input contains invalid JSON syntax.',
  },
  {
    pattern: /Unexpected token/,
    message: (m, orig) => `Unexpected syntax encountered: "${orig.split('\n')[0]}". The input may be malformed.`,
  },
];

// HTTP status code descriptions
const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was malformed or contained invalid data.',
  401: 'Authentication is required. Please log in to continue.',
  403: 'You do not have permission to access this resource.',
  404: 'The requested resource could not be found.',
  405: 'This HTTP method is not allowed for this endpoint.',
  408: 'The request timed out. Please try again.',
  409: 'There is a conflict with the current state of the resource.',
  410: 'This resource has been permanently removed.',
  422: 'The request data is invalid and cannot be processed.',
  429: 'Too many requests. Please slow down and try again later.',
  500: 'An unexpected server error occurred. Please try again or contact support.',
  501: 'This feature is not yet implemented.',
  502: 'The upstream server returned an invalid response.',
  503: 'The service is temporarily unavailable. Please try again later.',
  504: 'The upstream server took too long to respond.',
};

const userPlugins: TranslatorPlugin[] = [];

/**
 * Register a custom translation plugin with its own rules.
 * Plugin rules are checked before built-in rules.
 */
export function registerTranslatorPlugin(plugin: TranslatorPlugin): void {
  userPlugins.push(plugin);
}

/**
 * Unregister a plugin by name.
 */
export function unregisterTranslatorPlugin(name: string): void {
  const idx = userPlugins.findIndex((p) => p.name === name);
  if (idx !== -1) userPlugins.splice(idx, 1);
}

function applyRule(rule: MessageRule, message: string): string | null {
  if (typeof rule.pattern === 'string') {
    if (!message.includes(rule.pattern)) return null;
    return typeof rule.message === 'string' ? rule.message : rule.message([] as unknown as RegExpMatchArray, message);
  }

  const match = message.match(rule.pattern);
  if (!match) return null;

  if (typeof rule.message === 'string') {
    // Replace capture group references like $1, $2
    return rule.message.replace(/\$(\d+)/g, (_, n) => match[parseInt(n, 10)] ?? '');
  }

  return rule.message(match, message);
}

/**
 * Translate a raw error message into a human-readable description.
 * Checks user plugins first, then built-in rules.
 * Returns the original message if no rule matches.
 */
export function translateMessage(message: string): string {
  // Check user plugins first (higher priority)
  for (const plugin of userPlugins) {
    for (const rule of plugin.rules) {
      const result = applyRule(rule, message);
      if (result) return result;
    }
  }

  // Check built-in Node.js system error rules
  for (const rule of NODE_SYSTEM_RULES) {
    const result = applyRule(rule, message);
    if (result) return result;
  }

  return message;
}

/**
 * Get a human-readable description for an HTTP status code.
 */
export function httpStatusMessage(status: number): string {
  return HTTP_STATUS_MESSAGES[status] ?? `HTTP error ${status} occurred.`;
}

/**
 * Translate a PostgreSQL error code to a human-readable message.
 */
export function translatePostgresCode(code: string, pgHumanMessages: Record<string, string>): string | null {
  return pgHumanMessages[code] ?? null;
}

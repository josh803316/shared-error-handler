/**
 * Parses and humanizes stack traces, separating user code from library internals.
 */

export interface StackFrame {
  /** Raw line from the stack trace */
  raw: string;
  /** Function or method name */
  fn?: string;
  /** Source file path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  col?: number;
  /** Whether this frame is from node_modules */
  isNodeModules: boolean;
  /** Whether this frame is a native V8/Node internal */
  isNative: boolean;
  /** Whether this frame is from Node.js internals (node: protocol) */
  isInternal: boolean;
}

export interface ParsedStackTrace {
  /** Error message (first line of the stack) */
  message: string;
  /** All parsed frames */
  frames: StackFrame[];
  /** Only user-code frames (no node_modules, no internals) */
  userFrames: StackFrame[];
  /** Human-readable one-line summary of where the error originated */
  summary: string;
  /** The original full stack string */
  original: string;
}

// Matches: "    at FunctionName (file.ts:42:10)"
// or:      "    at file.ts:42:10"
// or:      "    at async FunctionName (file.ts:42:10)"
const V8_FRAME_RE =
  /^\s+at\s+(?:(async)\s+)?(?:(.+?)\s+\((.+?)(?::(\d+))?(?::(\d+))?\)|(.+?)(?::(\d+))?(?::(\d+))?)\s*$/;

function parseFrame(line: string): StackFrame | null {
  const match = V8_FRAME_RE.exec(line);
  if (!match) return null;

  const [, , fn, fileA, lineA, colA, fileB, lineB, colB] = match;

  const file = fileA ?? fileB;
  const lineNum = lineA ?? lineB;
  const colNum = colA ?? colB;

  const isNative = !!(file && (file === 'native' || file.startsWith('<') || file === 'unknown'));
  const isInternal = !!(file && (file.startsWith('node:') || file.startsWith('internal/')));
  const isNodeModules = !!(file && file.includes('node_modules'));

  return {
    raw: line,
    fn: fn?.trim() || undefined,
    file: file?.trim() || undefined,
    line: lineNum ? parseInt(lineNum, 10) : undefined,
    col: colNum ? parseInt(colNum, 10) : undefined,
    isNodeModules,
    isNative,
    isInternal,
  };
}

/**
 * Format a single frame for human display.
 */
function formatFrame(frame: StackFrame): string {
  if (!frame.file) return frame.raw.trim();

  // Shorten absolute paths to relative from cwd
  let file = frame.file;
  try {
    const cwd = process.cwd();
    if (file.startsWith(cwd)) {
      file = file.slice(cwd.length).replace(/^\//, '');
    }
  } catch {
    // ignore if process.cwd() fails
  }

  const location = frame.line ? `${file}:${frame.line}` : file;
  return frame.fn ? `${frame.fn} (${location})` : location;
}

/**
 * Parse a raw stack trace string into structured frames.
 */
export function parseStackTrace(stack: string): ParsedStackTrace {
  const lines = stack.split('\n');
  const messageLine = lines[0] ?? '';
  const frameLines = lines.slice(1);

  const frames: StackFrame[] = [];
  for (const line of frameLines) {
    if (!line.trim()) continue;
    const frame = parseFrame(line);
    if (frame) frames.push(frame);
  }

  const userFrames = frames.filter((f) => !f.isNodeModules && !f.isNative && !f.isInternal);

  const originFrame = userFrames[0] ?? frames[0];
  const summary = originFrame ? formatFrame(originFrame) : messageLine;

  return {
    message: messageLine,
    frames,
    userFrames,
    summary,
    original: stack,
  };
}

/**
 * Format a parsed stack trace into a concise, human-readable string.
 * Shows only user code frames with shortened paths.
 */
export function humanizeStackTrace(stack: string, maxFrames = 5): string {
  const parsed = parseStackTrace(stack);

  if (parsed.userFrames.length === 0) {
    return parsed.frames.slice(0, maxFrames).map(formatFrame).join('\n  ');
  }

  return parsed.userFrames.slice(0, maxFrames).map(formatFrame).join('\n  ');
}

/**
 * Extract the providers (library names) from a stack trace.
 */
export function extractProviders(stack: string): string[] {
  const nodeModulesRegex = /node_modules\/(@?[\w-]+)(?:\/([\w-]+))?/g;
  const providers = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = nodeModulesRegex.exec(stack)) !== null) {
    const [, first, second] = match;
    if (first) {
      providers.add(first.startsWith('@') && second ? `${first}/${second}` : first);
    }
  }

  return [...providers];
}

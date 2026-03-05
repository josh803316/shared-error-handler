/**
 * Generate a stable fingerprint for an error for deduplication and tracking.
 * Uses the error name, message, and top user-code stack frame.
 */
export function fingerprintError(name: string, message: string, stackSummary: string): string {
  const input = `${name}::${message}::${stackSummary}`;
  // Simple djb2-style hash — no crypto dependency needed
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * lib/request-log.ts
 *
 * Lightweight in-memory ring buffer for recent HTTP request/response entries.
 * Entries are prepended so index 0 is always the most recent.
 */

export interface RequestLogEntry {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  responseTimeMs: number;
}

const MAX_ENTRIES = 200;

const _entries: RequestLogEntry[] = [];

export function pushEntry(entry: RequestLogEntry): void {
  _entries.unshift(entry);
  if (_entries.length > MAX_ENTRIES) _entries.length = MAX_ENTRIES;
}

export function getEntries(limit = 100): RequestLogEntry[] {
  return _entries.slice(0, Math.min(limit, MAX_ENTRIES));
}

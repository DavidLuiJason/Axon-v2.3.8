/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON crash log: a small, local record of errors the app caught.
 * Pure TypeScript, no React. Storage is injected so it can be tested.
 * It never throws: a crash log that crashes would hide the real problem.
 * The log is its own storage key; it never touches chats or any other saved data.
 */

export const CRASH_LOG_KEY = 'axon.crashlog.v1';
/** Only the newest entries are kept. */
export const MAX_ENTRIES = 50;
/** Longest text kept for any one field of an entry. */
export const MAX_FIELD_LENGTH = 4000;
/** The same error from the same place inside this many ms is one entry, not many. */
export const DUPLICATE_WINDOW_MS = 2000;

export interface CrashEntry {
  id: string;
  /** Milliseconds since 1970. */
  at: number;
  /** Where it was caught, for example "screen:background-proof" or "unhandled-rejection". */
  where: string;
  message: string;
  stack: string;
  componentStack: string;
}

export interface CrashStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CrashLog {
  /** Adds an entry. Returns it, or null when it was a duplicate of the one just before. */
  record(input: { where: string; error: unknown; componentStack?: string | null }): CrashEntry | null;
  /** Oldest first. */
  list(): CrashEntry[];
  clear(): void;
  /** Plain text report, newest entry first, ready to save or paste. */
  exportText(): string;
}

export interface CrashLogOptions {
  /** Where entries are saved. Null or missing: entries live in memory until the app closes. */
  storage?: CrashStorage | null;
  now?: () => number;
  makeId?: () => string;
}

function clip(text: string): string {
  return text.length > MAX_FIELD_LENGTH ? `${text.slice(0, MAX_FIELD_LENGTH)}...[cut]` : text;
}

function textOf(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unprintable error]';
  }
}

/** The error's message as one short line for people to read. */
export function errorSummary(error: unknown): string {
  let message: string;
  if (error instanceof Error) message = error.message || error.name;
  else message = textOf(error);
  const firstLine = message.split(/\r\n|\r|\n/)[0].trim();
  const line = firstLine === '' ? 'Unknown error' : firstLine;
  return line.length > 200 ? `${line.slice(0, 200)}...` : line;
}

function isEntry(value: unknown): value is CrashEntry {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.at === 'number' &&
    typeof v.where === 'string' &&
    typeof v.message === 'string' &&
    typeof v.stack === 'string' &&
    typeof v.componentStack === 'string'
  );
}

export function createCrashLog(options: CrashLogOptions = {}): CrashLog {
  const storage = options.storage ?? null;
  const now = options.now ?? Date.now;
  let counter = 0;
  const makeId = options.makeId ?? (() => `crash-${now()}-${++counter}`);
  /** Used when there is no storage, or when saving failed. */
  let memory: CrashEntry[] = [];
  let useMemory = storage === null;

  function readSaved(): CrashEntry[] {
    if (storage === null) return [];
    try {
      const raw = storage.getItem(CRASH_LOG_KEY);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isEntry);
    } catch {
      return [];
    }
  }

  function list(): CrashEntry[] {
    return (useMemory ? memory : readSaved()).map((e) => ({ ...e }));
  }

  function save(entries: CrashEntry[]): void {
    memory = entries;
    if (storage === null) return;
    try {
      storage.setItem(CRASH_LOG_KEY, JSON.stringify(entries));
      useMemory = false;
    } catch {
      // Saving failed (full or blocked). Keep the entries in memory so they can still be seen.
      useMemory = true;
    }
  }

  return {
    record(input) {
      try {
        const error = input.error;
        const message = clip(
          error instanceof Error ? `${error.name}: ${error.message}` : textOf(error)
        );
        const stack = clip(error instanceof Error && error.stack ? error.stack : '');
        const at = now();
        const existing = list();
        const last = existing[existing.length - 1];
        if (
          last !== undefined &&
          last.where === input.where &&
          last.message === message &&
          at - last.at >= 0 &&
          at - last.at < DUPLICATE_WINDOW_MS
        ) {
          return null;
        }
        const entry: CrashEntry = {
          id: makeId(),
          at,
          where: clip(input.where),
          message,
          stack,
          componentStack: clip(input.componentStack ?? ''),
        };
        const next = [...existing, entry].slice(-MAX_ENTRIES);
        save(next);
        return { ...entry };
      } catch {
        return null;
      }
    },

    list,

    clear() {
      memory = [];
      if (storage === null) return;
      try {
        storage.removeItem(CRASH_LOG_KEY);
        useMemory = false;
      } catch {
        useMemory = true;
      }
    },

    exportText() {
      const entries = list().reverse();
      const lines: string[] = [
        'AXON crash log',
        `Entries: ${entries.length}${entries.length > 1 ? ' (newest first)' : ''}`,
        `Exported: ${new Date(now()).toISOString()}`,
      ];
      if (entries.length === 0) {
        lines.push('', 'No crashes have been recorded by this app since the log was last cleared.');
      }
      entries.forEach((e, i) => {
        lines.push(
          '',
          `--- Entry ${i + 1} of ${entries.length} ---`,
          `Time: ${new Date(e.at).toISOString()}`,
          `Where: ${e.where}`,
          `Message: ${e.message}`,
          'Stack:',
          e.stack === '' ? '(none)' : e.stack,
          'Component stack:',
          e.componentStack === '' ? '(none)' : e.componentStack
        );
      });
      return `${lines.join('\n')}\n`;
    },
  };
}

/**
 * Takes the saved app data (the JSON text AXON keeps its chats and current screen in)
 * and returns the same data with only the current screen set to "chat".
 * Returns null when there is nothing to change or the data cannot be read; the caller
 * then leaves the saved data exactly as it is. Chats and every other field are untouched.
 */
export function resetSavedScreenToChat(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.currentScreen !== 'string' || record.currentScreen === 'chat') return null;
    return JSON.stringify({ ...record, currentScreen: 'chat' });
  } catch {
    return null;
  }
}

export interface EventTargetLike {
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}

/**
 * Records errors that React cannot catch (event handlers, timers, unhandled promises).
 * Returns a function that removes the listeners again.
 */
export function installGlobalCrashHandlers(log: CrashLog, target: EventTargetLike): () => void {
  const onError = (event: any) => {
    try {
      const message = typeof event?.message === 'string' ? event.message : '';
      // Browsers fire this harmless notice often; it is not a crash.
      if (message.startsWith('ResizeObserver loop')) return;
      log.record({ where: 'window-error', error: event?.error ?? (message || 'Unknown window error') });
    } catch {
      // Logging must never throw.
    }
  };
  const onRejection = (event: any) => {
    try {
      log.record({ where: 'unhandled-rejection', error: event?.reason ?? 'Unknown rejection' });
    } catch {
      // Logging must never throw.
    }
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}

let shared: CrashLog | null = null;

/** The one crash log the app uses. Saved in localStorage when the browser allows it. */
export function getCrashLog(): CrashLog {
  if (!shared) {
    let storage: CrashStorage | null = null;
    try {
      if (typeof localStorage !== 'undefined') storage = localStorage;
    } catch {
      storage = null;
    }
    shared = createCrashLog({ storage });
  }
  return shared;
}

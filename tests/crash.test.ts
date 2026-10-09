/**
 * Crash log tests: recording, limits, duplicates, saving and its failures, the text export,
 * the saved-screen reset, and the global error handlers. Pure logic; no screen is needed.
 */
import {
  createCrashLog,
  errorSummary,
  resetSavedScreenToChat,
  installGlobalCrashHandlers,
  getCrashLog,
  CRASH_LOG_KEY,
  MAX_ENTRIES,
  MAX_FIELD_LENGTH,
  DUPLICATE_WINDOW_MS,
  type CrashStorage,
  type EventTargetLike,
} from '../src/crash/crashLog';
import { STORAGE_KEY, validatePersistedPayload } from '../src/state/storage';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

function memoryStorage(initial: Record<string, string> = {}): CrashStorage & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function clock(start = 1_000_000) {
  const c = { t: start };
  return { c, now: () => c.t };
}

function main() {
  console.log('-- recording');
  {
    const { now } = clock();
    const log = createCrashLog({ now });
    assert(log.list().length === 0, 'a new log is empty');
    const err = new Error('boom');
    const entry = log.record({ where: 'screen:axon-tools', error: err, componentStack: '\n    at Tools' });
    assert(entry !== null, 'recording an error returns the entry');
    assert(entry?.where === 'screen:axon-tools', 'the entry keeps where it was caught');
    assert(entry?.message === 'Error: boom', 'the message is name and message');
    assert(typeof entry?.stack === 'string' && (entry?.stack ?? '').includes('boom'), 'the stack is kept');
    assert(entry?.componentStack === '\n    at Tools', 'the component stack is kept');
    assert(entry?.at === 1_000_000, 'the time comes from the clock');
    assert(log.list().length === 1, 'the entry is listed');
  }

  console.log('-- any kind of thrown value');
  {
    const { c, now } = clock();
    const log = createCrashLog({ now });
    const unprintable = { toString() { throw new Error('no text'); } };
    const values: unknown[] = ['plain text', { code: 7 }, null, undefined, 42, unprintable];
    let threw = false;
    try {
      for (const v of values) {
        log.record({ where: 'x', error: v });
        c.t += DUPLICATE_WINDOW_MS + 1;
      }
    } catch {
      threw = true;
    }
    assert(!threw, 'recording never throws, whatever was thrown');
    assert(log.list().length === 6, 'every kind of value is recorded');
    assert(log.list()[0].message === 'plain text', 'a string is kept as text');
    assert(log.list()[5].message === '[unprintable error]', 'an unprintable value is recorded as such');
    assert(log.list()[0].stack === '', 'a non-Error has an empty stack');
  }

  console.log('-- field length');
  {
    const log = createCrashLog({ now: clock().now });
    const e = log.record({ where: 'x', error: new Error('a'.repeat(MAX_FIELD_LENGTH * 3)), componentStack: 'c'.repeat(MAX_FIELD_LENGTH * 2) });
    assert((e?.message.length ?? 0) <= MAX_FIELD_LENGTH + 20 && (e?.message.length ?? 0) < MAX_FIELD_LENGTH * 3, 'a very long message is cut');
    assert((e?.componentStack.length ?? 0) <= MAX_FIELD_LENGTH + 20, 'a very long component stack is cut');
    assert((e?.message ?? '').endsWith('...[cut]'), 'a cut field says it was cut');
  }

  console.log('-- duplicates');
  {
    const { c, now } = clock();
    const log = createCrashLog({ now });
    const err = new Error('same');
    log.record({ where: 'a', error: err });
    c.t += 10;
    const dup = log.record({ where: 'a', error: err });
    assert(dup === null && log.list().length === 1, 'the same error from the same place at once is one entry');
    c.t += 10;
    log.record({ where: 'b', error: err });
    assert(log.list().length === 2, 'the same error from another place is a new entry');
    c.t += 10;
    log.record({ where: 'b', error: new Error('different') });
    assert(log.list().length === 3, 'a different error from the same place is a new entry');
    c.t += DUPLICATE_WINDOW_MS + 1;
    log.record({ where: 'b', error: new Error('different') });
    assert(log.list().length === 4, 'the same error long after the first is a new entry');
    c.t -= 5_000_000;
    log.record({ where: 'b', error: new Error('different') });
    assert(log.list().length === 5, 'a clock that went backwards does not hide an entry');
  }

  console.log('-- entry limit');
  {
    const { c, now } = clock();
    const log = createCrashLog({ now });
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      log.record({ where: 'loop', error: new Error(`e${i}`) });
      c.t += DUPLICATE_WINDOW_MS + 1;
    }
    const all = log.list();
    assert(all.length === MAX_ENTRIES, 'only the newest 50 entries are kept');
    assert(all[all.length - 1].message === `Error: e${MAX_ENTRIES + 9}`, 'the newest entry is kept');
    assert(all[0].message === 'Error: e10', 'the oldest entries were dropped');
    assert(new Set(all.map((e) => e.id)).size === all.length, 'entry ids are unique');
  }

  console.log('-- saving');
  {
    const { c, now } = clock();
    const storage = memoryStorage({ 'axon.global.v1': '{"keep":"me"}', other: 'x' });
    const first = createCrashLog({ storage, now });
    first.record({ where: 'a', error: new Error('saved one') });
    assert(storage.data.has(CRASH_LOG_KEY), 'the log is saved under its own key');
    assert(CRASH_LOG_KEY === 'axon.crashlog.v1' && CRASH_LOG_KEY !== STORAGE_KEY, 'the key is not the chat storage key');
    c.t += 5000;
    const second = createCrashLog({ storage, now });
    assert(second.list().length === 1 && second.list()[0].message === 'Error: saved one', 'a new log on the same storage sees the old entry (survives a restart)');
    second.record({ where: 'a', error: new Error('saved two') });
    assert(createCrashLog({ storage, now }).list().length === 2, 'both entries are saved');
    assert(storage.data.get('axon.global.v1') === '{"keep":"me"}' && storage.data.get('other') === 'x', 'recording never touches other saved data');
    second.clear();
    assert(!storage.data.has(CRASH_LOG_KEY) && second.list().length === 0, 'clear removes the log');
    assert(storage.data.get('axon.global.v1') === '{"keep":"me"}' && storage.data.get('other') === 'x', 'clearing never touches other saved data');
  }

  console.log('-- damaged or failing storage');
  {
    const { c, now } = clock();
    const bad = memoryStorage({ [CRASH_LOG_KEY]: '{not json' });
    const log = createCrashLog({ storage: bad, now });
    assert(log.list().length === 0, 'unreadable saved data reads as an empty log');
    assert(bad.data.get(CRASH_LOG_KEY) === '{not json', 'reading never rewrites the saved value');
    log.record({ where: 'a', error: new Error('after damage') });
    assert(log.list().length === 1, 'recording still works after damaged data');
    const notArray = memoryStorage({ [CRASH_LOG_KEY]: '{"a":1}' });
    assert(createCrashLog({ storage: notArray, now }).list().length === 0, 'saved data that is not a list reads as empty');
    assert(notArray.data.get(CRASH_LOG_KEY) === '{"a":1}', 'reading a non-list value never rewrites it either');
    const mixed = memoryStorage({
      [CRASH_LOG_KEY]: JSON.stringify([
        { id: 'ok', at: 1, where: 'w', message: 'm', stack: '', componentStack: '' },
        { id: 'bad', at: 'later' },
        7,
      ]),
    });
    assert(createCrashLog({ storage: mixed, now }).list().length === 1, 'invalid saved entries are skipped, valid ones kept');

    const full: CrashStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const fullLog = createCrashLog({ storage: full, now });
    let threw = false;
    let entry = null;
    try {
      entry = fullLog.record({ where: 'a', error: new Error('cannot save') });
      c.t += DUPLICATE_WINDOW_MS + 1;
      fullLog.record({ where: 'a', error: new Error('second') });
      fullLog.clear();
    } catch {
      threw = true;
    }
    assert(!threw, 'a storage that refuses writes never makes the log throw');
    assert(entry !== null, 'the entry is still returned when saving fails');
    const reader: CrashStorage = {
      getItem: () => {
        throw new Error('no access');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    let readThrew = false;
    try {
      createCrashLog({ storage: reader, now }).record({ where: 'a', error: new Error('x') });
    } catch {
      readThrew = true;
    }
    assert(!readThrew, 'a storage that refuses reads never makes the log throw');
    const failing = createCrashLog({ storage: full, now });
    failing.record({ where: 'a', error: new Error('kept in memory') });
    assert(failing.list().length === 1 && failing.list()[0].message === 'Error: kept in memory', 'when saving fails the entry stays visible until the app closes');
  }

  console.log('-- text export');
  {
    const { c, now } = clock(0);
    const log = createCrashLog({ now });
    const empty = log.exportText();
    assert(empty.startsWith('AXON crash log\n') && empty.includes('Entries: 0') && empty.includes('No crashes have been recorded'), 'an empty export says so plainly');
    const err = new Error('first problem');
    log.record({ where: 'screen:one', error: err, componentStack: '\n    at One' });
    c.t = 60_000;
    log.record({ where: 'screen:two', error: new Error('second problem') });
    c.t = 120_000;
    const text = log.exportText();
    assert(text.includes('Entries: 2 (newest first)'), 'the export counts the entries');
    assert(text.indexOf('second problem') < text.indexOf('first problem'), 'the newest entry comes first');
    assert(text.includes('Where: screen:one') && text.includes('Where: screen:two'), 'the export names where each was caught');
    assert(text.includes('Time: 1970-01-01T00:01:00.000Z') && text.includes('Time: 1970-01-01T00:00:00.000Z'), 'the export has exact times');
    assert(text.includes('Exported: 1970-01-01T00:02:00.000Z'), 'the export says when it was made');
    assert(text.includes('Component stack:\n\n    at One'), 'the component stack is included');
    assert(text.endsWith('\n'), 'the export ends with a newline');
  }

  console.log('-- readable summary');
  assert(errorSummary(new Error('Disk full')) === 'Disk full', 'an error shows its message');
  assert(errorSummary(new Error('line one\nline two')) === 'line one', 'only the first line is shown');
  assert(errorSummary(new Error('')) === 'Error', 'an error with no message shows its name');
  assert(errorSummary('plain') === 'plain' && errorSummary(null) === 'null', 'other values are shown as text');
  assert(errorSummary('x'.repeat(500)).length === 203 && errorSummary('x'.repeat(500)).endsWith('...'), 'a long message is cut for display');
  assert(errorSummary('') === 'Unknown error' && errorSummary('\n\n') === 'Unknown error', 'a blank message shows "Unknown error"');
  assert(errorSummary({ toString() { throw new Error('x'); } }) === '[unprintable error]', 'an unprintable value never throws');

  console.log('-- saved screen reset');
  {
    assert(resetSavedScreenToChat(null) === null, 'nothing saved: nothing to change');
    assert(resetSavedScreenToChat('{oops') === null, 'unreadable data is left alone');
    assert(resetSavedScreenToChat('[1,2]') === null, 'data that is not an object is left alone');
    assert(resetSavedScreenToChat('{"a":1}') === null, 'data without a screen is left alone');
    assert(resetSavedScreenToChat('{"currentScreen":7}') === null, 'a screen that is not text is left alone');
    assert(resetSavedScreenToChat('{"currentScreen":"chat"}') === null, 'already on chat: nothing to change');
    const payload = {
      schemaVersion: 1,
      currentScreen: 'background-proof',
      activeChatId: 'chat-1',
      recents: [
        {
          id: 'chat-1',
          title: 'Hello',
          timestamp: 'Just now',
          messages: [{ id: 'm1', role: 'user', content: 'keep this', timestamp: 5 }],
        },
      ],
      messages: [{ id: 'm1', role: 'user', content: 'keep this', timestamp: 5 }],
      selectedModel: 'Sonnet 5 Thinking',
      userName: 'Someone',
    };
    assert(validatePersistedPayload(payload) !== null, 'the test payload is valid under the real storage schema');
    const out = resetSavedScreenToChat(JSON.stringify(payload));
    assert(out !== null, 'a saved screen other than chat is reset');
    const back = JSON.parse(out as string) as Record<string, unknown>;
    assert(back.currentScreen === 'chat', 'the saved screen is now chat');
    const { currentScreen: _a, ...restBefore } = payload;
    const { currentScreen: _b, ...restAfter } = back;
    assert(JSON.stringify(restBefore) === JSON.stringify(restAfter), 'every other saved field, including all chats, is unchanged');
    assert(validatePersistedPayload(back) !== null, 'the reset data is still valid under the real storage schema');
    assert(STORAGE_KEY === 'axon.global.v1', 'the reset targets the real chat storage key');
  }

  console.log('-- global handlers');
  {
    const { c, now } = clock();
    const log = createCrashLog({ now });
    const listeners = new Map<string, Array<(e: any) => void>>();
    const target: EventTargetLike = {
      addEventListener: (type, fn) => {
        listeners.set(type, [...(listeners.get(type) ?? []), fn]);
      },
      removeEventListener: (type, fn) => {
        listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
      },
    };
    const fire = (type: string, event: unknown) => (listeners.get(type) ?? []).forEach((f) => f(event));
    const remove = installGlobalCrashHandlers(log, target);
    assert((listeners.get('error') ?? []).length === 1 && (listeners.get('unhandledrejection') ?? []).length === 1, 'both listeners are installed');
    fire('error', { message: 'Uncaught TypeError', error: new TypeError('bad thing') });
    assert(log.list().length === 1 && log.list()[0].where === 'window-error' && log.list()[0].message === 'TypeError: bad thing', 'a window error is recorded');
    c.t += DUPLICATE_WINDOW_MS + 1;
    fire('error', { message: 'Script error.' });
    assert(log.list()[1].message === 'Script error.', 'a window error with only a message is recorded');
    c.t += DUPLICATE_WINDOW_MS + 1;
    fire('error', { message: 'ResizeObserver loop completed with undelivered notifications.' });
    assert(log.list().length === 2, 'the harmless ResizeObserver notice is not recorded');
    fire('unhandledrejection', { reason: new Error('lost promise') });
    assert(log.list()[2].where === 'unhandled-rejection' && log.list()[2].message === 'Error: lost promise', 'an unhandled rejection is recorded');
    c.t += DUPLICATE_WINDOW_MS + 1;
    fire('unhandledrejection', {});
    assert(log.list()[3].message === 'Unknown rejection', 'a rejection with no reason is recorded as unknown');
    let threw = false;
    try {
      fire('error', undefined);
      fire('unhandledrejection', undefined);
    } catch {
      threw = true;
    }
    assert(!threw, 'a malformed event never makes a handler throw');
    const brokenLog = { record: () => { throw new Error('log down'); }, list: () => [], clear: () => {}, exportText: () => '' };
    const removeBroken = installGlobalCrashHandlers(brokenLog, target);
    let brokenThrew = false;
    try {
      fire('error', { message: 'x', error: new Error('x') });
      fire('unhandledrejection', { reason: new Error('y') });
    } catch {
      brokenThrew = true;
    }
    assert(!brokenThrew, 'a log that fails never makes either handler throw');
    removeBroken();
    const before = log.list().length;
    remove();
    assert((listeners.get('error') ?? []).length === 0 && (listeners.get('unhandledrejection') ?? []).length === 0, 'removing the handlers removes both listeners');
    c.t += DUPLICATE_WINDOW_MS + 1;
    fire('error', { message: 'after removal', error: new Error('after removal') });
    assert(log.list().length === before, 'nothing is recorded after the handlers are removed');
  }

  console.log('-- the shared log');
  {
    const a = getCrashLog();
    const b = getCrashLog();
    assert(a === b, 'the app uses one shared log');
    a.record({ where: 'shared-test', error: new Error('shared entry') });
    assert(b.list().some((e) => e.where === 'shared-test'), 'an entry recorded on the shared log is listed');
    a.clear();
    assert(b.list().length === 0, 'the shared log can be cleared');
  }

  console.log(`=== crash tests passed: ${checks} checks ===`);
}

let timer: ReturnType<typeof setTimeout> | undefined;
const watchdog = new Promise<never>((_, reject) => {
  timer = setTimeout(() => reject(new Error('FAIL: crash tests hung (a promise never settled)')), 10000);
});

Promise.race([Promise.resolve().then(main), watchdog]).then(
  () => {
    clearTimeout(timer);
  },
  (err) => {
    clearTimeout(timer);
    console.error(err);
    throw err;
  }
);

/**
 * Execution kernel tests: contract, device profile, task engine.
 * Test actions live only in this file. They are never registered in the app.
 */
import {
  createTaskEngine,
  canTransition,
  CancelledError,
  validateInput,
  followUpQuestions,
  readDeviceProfile,
  simulatedProfile,
  checkResources,
} from '../src/kernel/index';
import type { ActionDef, CancelModel, TaskState } from '../src/kernel/index';

let checks = 0;
function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function action(id: string, overrides: Partial<ActionDef> = {}): ActionDef {
  return {
    id,
    capabilityId: 'test.cap',
    label: id,
    executionClass: 'async',
    inputFields: [{ name: 'text', type: 'string', required: true, prompt: 'What text?' }],
    outputFields: [{ name: 'count', type: 'number' }],
    resources: {},
    cancel: 'checkpoint',
    evidence: 'test only',
    run: async (input) => ({ count: String(input.text).length }),
    ...overrides,
  };
}

function engineWithClock(extra = {}) {
  let t = 1000;
  return createTaskEngine({ now: () => (t += 10), ...extra });
}

async function main() {
  console.log('=== kernel tests ===');

  console.log('-- transitions');
  assert(canTransition('QUEUED', 'RUNNING'), 'QUEUED -> RUNNING allowed');
  assert(canTransition('RUNNING', 'CANCEL_REQUESTED'), 'RUNNING -> CANCEL_REQUESTED allowed');
  assert(canTransition('INTERRUPTED', 'QUEUED'), 'INTERRUPTED -> QUEUED allowed (resume)');
  assert(!canTransition('COMPLETED', 'RUNNING'), 'COMPLETED -> RUNNING refused');
  assert(!canTransition('CANCELLED', 'QUEUED'), 'CANCELLED -> QUEUED refused');
  assert(!canTransition('QUEUED', 'COMPLETED'), 'QUEUED -> COMPLETED refused');
  const all: TaskState[] = ['CREATED','QUEUED','RUNNING','PAUSED','COMPLETED','FAILED','CANCEL_REQUESTED','CANCELLED','INTERRUPTED'];
  assert(all.every((s) => !canTransition(s, s)), 'no state moves to itself');

  console.log('-- input checking');
  const a = action('text.count', {
    inputFields: [
      { name: 'text', type: 'string', required: true, prompt: 'What text should I count?' },
      { name: 'limit', type: 'number', required: false, prompt: 'Limit?' },
    ],
  });
  assert(validateInput(a, { text: 'hi' }).ok, 'valid input accepted');
  const missing = validateInput(a, {});
  assert(!missing.ok && missing.missing[0] === 'text', 'missing required field reported');
  const wrong = validateInput(a, { text: 5 });
  assert(!wrong.ok && wrong.invalid[0] === 'text' && wrong.missing.length === 0, 'wrong type reported as invalid');
  assert(!validateInput(a, { text: 'x', limit: Number.NaN }).ok, 'NaN is not a valid number');
  assert(validateInput(a, { text: 'x', extra: 1 }).ok, 'extra fields ignored');
  assert(!validateInput(a, null).ok, 'null input reports missing fields');
  assert(followUpQuestions(a, ['text'])[0] === 'What text should I count?', 'follow-up question comes from the field');
  assert(validateInput(a, { text: '' }).ok, 'empty string counts as present');

  console.log('-- device profile');
  const full = await readDeviceProfile(
    {
      memoryGb: () => 2,
      cpuCores: () => 4,
      storage: async () => ({ usage: 300, quota: 1000 }),
      battery: async () => ({ level: 0.42, charging: false }),
    },
    () => 777
  );
  assert(full.takenAt === 777, 'profile carries its reading time');
  assert(full.memoryGb.known && full.memoryGb.value === 2, 'memory read');
  assert(full.storageFreeBytes.known && full.storageFreeBytes.value === 700, 'free storage = quota - usage');
  assert(full.batteryPercent.known && full.batteryPercent.value === 42, 'battery as whole percent');
  assert(full.charging.known && full.charging.value === false, 'charging read');

  const blank = await readDeviceProfile({
    memoryGb: () => undefined,
    cpuCores: () => undefined,
    storage: async () => undefined,
    battery: async () => undefined,
  });
  assert(!blank.memoryGb.known && !blank.cpuCores.known, 'missing memory and cpu are unknown, not guessed');
  assert(!blank.storageFreeBytes.known && !blank.batteryPercent.known && !blank.charging.known, 'missing storage and battery are unknown');

  const broken = await readDeviceProfile({
    memoryGb: () => { throw new Error('no api'); },
    cpuCores: () => Number.NaN,
    storage: async () => { throw new Error('denied'); },
    battery: async () => ({ level: 7, charging: true }),
  });
  assert(!broken.memoryGb.known, 'a reader that throws gives unknown');
  assert(!broken.cpuCores.known, 'NaN gives unknown');
  assert(!broken.storageFreeBytes.known, 'a storage reader that rejects gives unknown');
  assert(!broken.batteryPercent.known, 'battery level outside 0..1 gives unknown');
  const overUsed = await readDeviceProfile({
    memoryGb: () => 1, cpuCores: () => 1,
    storage: async () => ({ usage: 900, quota: 100 }),
    battery: async () => undefined,
  });
  assert(!overUsed.storageFreeBytes.known, 'usage above quota gives unknown free space');

  console.log('-- resource checks on simulated devices');
  const needs = { minMemoryGb: 2, minFreeStorageBytes: 500, minBatteryPercent: 20 };
  const small = simulatedProfile({ memoryGb: 1, storageFreeBytes: 10_000, batteryPercent: 80, charging: false });
  const mid = simulatedProfile({ memoryGb: 2, storageFreeBytes: 10_000, batteryPercent: 80, charging: false });
  const big = simulatedProfile({ memoryGb: 8, storageFreeBytes: 10_000, batteryPercent: 80, charging: false });
  assert(!checkResources(small, needs).ok, '1 GB device is blocked by a 2 GB need');
  assert(checkResources(small, needs).blockers[0].includes('memory'), 'blocker names the memory problem');
  assert(checkResources(small, needs).options.length > 0, 'a blocked check offers options');
  assert(checkResources(mid, needs).ok, '2 GB device passes a 2 GB need');
  assert(checkResources(big, needs).ok, '8 GB device passes');
  assert(!checkResources(simulatedProfile({ memoryGb: 8, storageFreeBytes: 100, batteryPercent: 80 }), needs).ok, 'low free storage blocks');
  const lowBattery = simulatedProfile({ memoryGb: 8, storageFreeBytes: 10_000, batteryPercent: 5, charging: false });
  assert(!checkResources(lowBattery, needs).ok, 'low battery blocks when not charging');
  assert(checkResources({ ...lowBattery, charging: { known: true, value: true } }, needs).ok, 'low battery passes while charging');
  const unknown = checkResources(simulatedProfile({}), needs);
  assert(unknown.ok && unknown.unverified.length === 3, 'unknown readings never block, and are listed as unverified');
  assert(checkResources(simulatedProfile({}), {}).ok, 'no declared needs always passes');

  console.log('-- engine: happy path');
  {
    const engine = engineWithClock();
    engine.registerAction(a);
    const seen: string[] = [];
    engine.subscribe((t) => seen.push(t.state));
    const res = await engine.submit('text.count', { text: 'hello' });
    assert(res.ok, 'submit accepted');
    if (!res.ok) return;
    const done = await engine.whenDone(res.task.id);
    assert(done.state === 'COMPLETED', 'task completed');
    assert((done.output as { count: number }).count === 5, 'output returned');
    assert(done.progress === 1, 'progress is 1 on completion');
    assert(done.startedAt !== undefined && done.endedAt !== undefined && done.endedAt >= done.startedAt, 'timestamps set');
    assert(done.evidence.map((e) => e.event).join(',') === 'created,queued,started,completed', 'evidence events in order');
    assert(seen[0] === 'QUEUED' && seen.includes('RUNNING') && seen[seen.length - 1] === 'COMPLETED', 'subscribers saw QUEUED, RUNNING, COMPLETED');
    assert(engine.getTask(done.id)?.state === 'COMPLETED', 'getTask returns the task');
    const copy = engine.getTask(done.id)!;
    copy.state = 'FAILED';
    assert(engine.getTask(done.id)?.state === 'COMPLETED', 'returned tasks are copies');
  }

  console.log('-- engine: refusals');
  {
    const engine = engineWithClock({
      readProfile: async () => simulatedProfile({ memoryGb: 1 }),
    });
    engine.registerAction(a);
    engine.registerAction(action('heavy.job', { resources: { minMemoryGb: 4 } }));
    assert((await engine.submit('nope.nothing', {})).ok === false, 'unknown action refused');
    const m = await engine.submit('text.count', {});
    assert(!m.ok && m.reason === 'missing-input' && m.missing?.[0] === 'text', 'missing input refused with the field name');
    const i = await engine.submit('text.count', { text: 3 });
    assert(!i.ok && i.reason === 'invalid-input', 'invalid input refused');
    const r = await engine.submit('heavy.job', { text: 'x' });
    assert(!r.ok && r.reason === 'insufficient-resources' && (r.blockers?.length ?? 0) === 1, 'heavy action refused on a 1 GB device with a reason');
    assert(engine.listTasks().length === 0, 'refused submits create no task');
    let threw = false;
    try { engine.registerAction(a); } catch { threw = true; }
    assert(threw, 'duplicate action id rejected');
    threw = false;
    try { engine.registerAction(action('BadId')); } catch { threw = true; }
    assert(threw, 'badly formed action id rejected');
  }

  console.log('-- engine: queue');
  {
    const engine = engineWithClock();
    const gate1 = deferred();
    const order: string[] = [];
    engine.registerAction(action('slow.one', {
      run: async () => { order.push('one:start'); await gate1.promise; order.push('one:end'); return 1; },
    }));
    engine.registerAction(action('fast.two', {
      run: async () => { order.push('two'); return 2; },
    }));
    const r1 = await engine.submit('slow.one', { text: 'a' });
    const r2 = await engine.submit('fast.two', { text: 'b' });
    if (!r1.ok || !r2.ok) throw new Error('submit failed');
    assert(engine.getTask(r1.task.id)?.state === 'RUNNING', 'first task running');
    assert(engine.getTask(r2.task.id)?.state === 'QUEUED', 'second task waits (one at a time)');
    gate1.resolve();
    await engine.whenDone(r2.task.id);
    assert(order.join(',') === 'one:start,one:end,two', 'tasks ran in order, never together');
  }
  {
    const engine = engineWithClock({ maxConcurrent: 2 });
    const gate = deferred();
    engine.registerAction(action('slow.one', { run: async () => { await gate.promise; return 1; } }));
    const r1 = await engine.submit('slow.one', { text: 'a' });
    const r2 = await engine.submit('slow.one', { text: 'b' });
    if (!r1.ok || !r2.ok) throw new Error('submit failed');
    assert(engine.getTask(r1.task.id)?.state === 'RUNNING' && engine.getTask(r2.task.id)?.state === 'RUNNING', 'maxConcurrent 2 runs two at once');
    gate.resolve();
    await engine.whenDone(r1.task.id);
    await engine.whenDone(r2.task.id);
  }

  {
    const engine = engineWithClock();
    const gate = deferred();
    const order: string[] = [];
    engine.registerAction(action('first.job', { run: async () => { await gate.promise; order.push('first'); return 0; } }));
    engine.registerAction(action('named.job', { run: async (input) => { order.push(String(input.text)); return 0; } }));
    const r0 = await engine.submit('first.job', { text: 'x' });
    const rb = await engine.submit('named.job', { text: 'b' });
    const rc = await engine.submit('named.job', { text: 'c' });
    const rd = await engine.submit('named.job', { text: 'd' });
    if (!r0.ok || !rb.ok || !rc.ok || !rd.ok) throw new Error('submit failed');
    gate.resolve();
    await engine.whenDone(rd.task.id);
    assert(order.join(',') === 'first,b,c,d', 'queued tasks run first in, first out');
  }
  {
    const engine = engineWithClock();
    const gate = deferred();
    engine.registerAction(action('imm.job', { cancel: 'immediate', run: async () => { await gate.promise; return 1; } }));
    engine.registerAction(action('next.job', { run: async () => 'next ran' }));
    const r1 = await engine.submit('imm.job', { text: 'a' });
    const r2 = await engine.submit('next.job', { text: 'b' });
    if (!r1.ok || !r2.ok) throw new Error('submit failed');
    engine.cancel(r1.task.id);
    const done2 = await engine.whenDone(r2.task.id);
    assert(done2.state === 'COMPLETED', 'an immediate cancel frees the slot for the next queued task');
    gate.resolve();
  }

  console.log('-- engine: failure and progress');
  {
    const engine = engineWithClock();
    engine.registerAction(action('bad.job', { run: async () => { throw new Error('boom'); } }));
    engine.registerAction(action('sync.throw', { run: () => { throw new Error('sync boom'); } }));
    engine.registerAction(action('prog.job', {
      run: async (_i, ctx) => { ctx.reportProgress(-5); ctx.reportProgress(0.5); ctx.reportProgress(Number.NaN); ctx.reportProgress(9); return 'x'; },
    }));
    const f = await engine.submit('bad.job', { text: 'a' });
    if (!f.ok) throw new Error('submit failed');
    const done = await engine.whenDone(f.task.id);
    assert(done.state === 'FAILED' && done.error === 'boom', 'a throwing action ends FAILED with its message');
    const s = await engine.submit('sync.throw', { text: 'a' });
    if (!s.ok) throw new Error('submit failed');
    assert((await engine.whenDone(s.task.id)).error === 'sync boom', 'a synchronous throw also ends FAILED');
    const p = await engine.submit('prog.job', { text: 'a' });
    if (!p.ok) throw new Error('submit failed');
    await engine.whenDone(p.task.id);
    assert(engine.getTask(p.task.id)?.progress === 1, 'progress ends at 1 after completion');
    const seenProgress: Array<number | null> = [];
    const e2 = engineWithClock();
    e2.registerAction(action('prog.job', {
      run: async (_i, ctx) => { ctx.reportProgress(-5); ctx.reportProgress(0.5); ctx.reportProgress(Number.NaN); ctx.reportProgress(9); return 'x'; },
    }));
    e2.subscribe((t) => seenProgress.push(t.progress));
    const q = await e2.submit('prog.job', { text: 'a' });
    if (!q.ok) throw new Error('submit failed');
    await e2.whenDone(q.task.id);
    assert(seenProgress.includes(0) && seenProgress.includes(0.5) && seenProgress.every((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1)), 'progress clamped to 0..1 and NaN ignored');
  }

  console.log('-- engine: cancel');
  async function cancelCase(model: CancelModel) {
    const engine = engineWithClock();
    const gate = deferred();
    engine.registerAction(action('long.job', {
      cancel: model,
      run: async (_i, ctx) => { await gate.promise; ctx.throwIfCancelled(); return 'finished'; },
    }));
    const r = await engine.submit('long.job', { text: 'a' });
    if (!r.ok) throw new Error('submit failed');
    return { engine, gate, id: r.task.id };
  }
  {
    const { engine, gate, id } = await cancelCase('checkpoint');
    const res = engine.cancel(id);
    assert(res.ok && engine.getTask(id)?.state === 'CANCEL_REQUESTED', 'checkpoint cancel moves to CANCEL_REQUESTED');
    gate.resolve();
    const done = await engine.whenDone(id);
    assert(done.state === 'CANCELLED', 'task ends CANCELLED at its next checkpoint');
  }
  {
    const { engine, gate, id } = await cancelCase('immediate');
    const res = engine.cancel(id);
    assert(res.ok && engine.getTask(id)?.state === 'CANCELLED', 'immediate cancel ends CANCELLED at once');
    gate.resolve();
    await tick();
    assert(engine.getTask(id)?.state === 'CANCELLED', 'late result of an immediately cancelled task is ignored');
  }
  {
    const { engine, gate, id } = await cancelCase('none');
    const res = engine.cancel(id);
    assert(!res.ok && res.reason === 'not-cancellable', 'cancel refused for an uncancellable action');
    assert(engine.getTask(id)?.state === 'RUNNING', 'uncancellable task keeps running');
    assert(engine.getTask(id)!.evidence.some((e) => e.event === 'cancel-denied'), 'the refusal is recorded as evidence');
    gate.resolve();
    assert((await engine.whenDone(id)).state === 'COMPLETED', 'uncancellable task completes');
  }
  {
    const engine = engineWithClock();
    const gate = deferred();
    engine.registerAction(action('late.cancel', { run: async () => { await gate.promise; return 'done'; } }));
    const r = await engine.submit('late.cancel', { text: 'a' });
    if (!r.ok) throw new Error('submit failed');
    engine.cancel(r.task.id);
    gate.resolve();
    const done = await engine.whenDone(r.task.id);
    assert(done.state === 'COMPLETED', 'cancel that arrives after the work finished does not erase the result');
    assert(done.evidence.some((e) => e.detail?.includes('too late')), 'that case is recorded in the evidence');
    assert(!engine.cancel(r.task.id).ok, 'finished task cannot be cancelled');
  }
  {
    const engine = engineWithClock();
    const gate = deferred();
    engine.registerAction(action('slow.one', { run: async () => { await gate.promise; return 1; } }));
    const r1 = await engine.submit('slow.one', { text: 'a' });
    const r2 = await engine.submit('slow.one', { text: 'b' });
    if (!r1.ok || !r2.ok) throw new Error('submit failed');
    assert(engine.cancel(r2.task.id).ok && engine.getTask(r2.task.id)?.state === 'CANCELLED', 'a queued task cancels at once');
    gate.resolve();
    await engine.whenDone(r1.task.id);
    assert(engine.getTask(r2.task.id)?.state === 'CANCELLED', 'a cancelled queued task never runs');
    assert(!engine.cancel('task-999').ok, 'unknown task id refused');
  }

  console.log('-- engine: interrupt and resume');
  {
    const engine = engineWithClock();
    const gate = deferred();
    const restoredSeen: unknown[] = [];
    engine.registerAction(action('resum.job', {
      run: async (_i, ctx) => {
        restoredSeen.push(ctx.restored);
        if (ctx.restored === undefined) {
          ctx.saveCheckpoint({ step: 3 });
          await gate.promise;
          return 'old run result';
        }
        return `resumed from step ${(ctx.restored as { step: number }).step}`;
      },
    }));
    const r = await engine.submit('resum.job', { text: 'a' });
    if (!r.ok) throw new Error('submit failed');
    assert(engine.interrupt(r.task.id, 'app closed', true), 'running task can be interrupted');
    const stopped = await engine.whenDone(r.task.id);
    assert(stopped.state === 'INTERRUPTED' && stopped.interrupt?.resumable === true, 'state INTERRUPTED with a resumable reason');
    assert((stopped.checkpoint?.data as { step: number }).step === 3, 'checkpoint kept');
    assert(engine.resume(r.task.id).ok, 'resume accepted');
    const done = await engine.whenDone(r.task.id);
    assert(done.state === 'COMPLETED' && done.output === 'resumed from step 3', 'resumed run received the checkpoint');
    assert(restoredSeen.length === 2 && restoredSeen[0] === undefined, 'first run had no checkpoint, second did');
    gate.resolve();
    await tick();
    assert(engine.getTask(r.task.id)?.output === 'resumed from step 3', 'late result of the old run is ignored');
    assert(engine.getTask(r.task.id)!.evidence.map((e) => e.event).join(',') === 'created,queued,started,interrupted,resumed,started,completed', 'evidence shows the interruption and the resume');
  }
  {
    const engine = engineWithClock();
    const oldGate = deferred();
    const newGate = deferred();
    let runs = 0;
    engine.registerAction(action('two.runs', {
      run: async () => {
        runs += 1;
        if (runs === 1) { await oldGate.promise; return 'old run result'; }
        await newGate.promise;
        return 'new run result';
      },
    }));
    const r = await engine.submit('two.runs', { text: 'a' });
    if (!r.ok) throw new Error('submit failed');
    engine.interrupt(r.task.id, 'stopped', true);
    engine.resume(r.task.id);
    oldGate.resolve();
    await tick();
    assert(engine.getTask(r.task.id)?.state === 'RUNNING', 'a late result from the old run does not finish the resumed run');
    newGate.resolve();
    const done = await engine.whenDone(r.task.id);
    assert(done.state === 'COMPLETED' && done.output === 'new run result', 'the resumed run decides the result');
  }
  {
    const engine = engineWithClock();
    const gate = deferred();
    engine.registerAction(action('nores.job', { run: async () => { await gate.promise; return 1; } }));
    const r = await engine.submit('nores.job', { text: 'a' });
    if (!r.ok) throw new Error('submit failed');
    engine.interrupt(r.task.id, 'killed by system', false);
    const res = engine.resume(r.task.id);
    assert(!res.ok && res.reason === 'not-resumable', 'a not-resumable task cannot be resumed');
    assert(!engine.resume('task-999').ok, 'resume of unknown task refused');
    assert(engine.cancel(r.task.id).ok && engine.getTask(r.task.id)?.state === 'CANCELLED', 'an interrupted task can be cancelled');
    assert(!engine.interrupt(r.task.id, 'x', true), 'a finished task cannot be interrupted');
    gate.resolve();
  }
  {
    const engine = engineWithClock();
    const gate = deferred();
    engine.registerAction(action('slow.one', { run: async () => { await gate.promise; return 1; } }));
    engine.registerAction(action('fast.two', { run: async () => 2 }));
    const r1 = await engine.submit('slow.one', { text: 'a' });
    const r2 = await engine.submit('fast.two', { text: 'b' });
    if (!r1.ok || !r2.ok) throw new Error('submit failed');
    engine.interrupt(r1.task.id, 'stopped', true);
    const done2 = await engine.whenDone(r2.task.id);
    assert(done2.state === 'COMPLETED', 'interrupting a task frees its slot for the next one');
    gate.resolve();
  }

  console.log(`=== kernel tests passed: ${checks} checks ===`);
}

let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
const watchdog = new Promise<never>((_, reject) => {
  watchdogTimer = setTimeout(
    () => reject(new Error('FAIL: kernel tests hung (a promise never settled)')),
    8000
  );
});

Promise.race([main(), watchdog]).then(
  () => {
    clearTimeout(watchdogTimer);
  },
  (err) => {
    clearTimeout(watchdogTimer);
    console.error(err);
    throw err;
  }
);

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON execution kernel: task engine (foreground executor only).
 * Runs actions as tasks with a queue, progress, cancel, interrupt and resume.
 * Nothing here talks to the screen, the Brain or the saved data.
 */

import { validateInput } from './actionSchema';
import { checkResources, type DeviceProfile } from './deviceProfile';
import type {
  ActionDef,
  InterruptInfo,
  Task,
  TaskContext,
  TaskState,
} from './types';

export class CancelledError extends Error {
  constructor() {
    super('Task cancelled');
    this.name = 'CancelledError';
  }
}

const TRANSITIONS: Record<TaskState, TaskState[]> = {
  CREATED: ['QUEUED', 'CANCELLED', 'FAILED'],
  QUEUED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCEL_REQUESTED', 'CANCELLED', 'INTERRUPTED', 'PAUSED'],
  // PAUSED is part of the contract; the resource governor will use it later.
  PAUSED: ['RUNNING', 'CANCELLED', 'INTERRUPTED'],
  CANCEL_REQUESTED: ['CANCELLED', 'COMPLETED', 'FAILED', 'INTERRUPTED'],
  INTERRUPTED: ['QUEUED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The task will not change again unless it is resumed. */
function isSettled(state: TaskState): boolean {
  return (
    state === 'COMPLETED' ||
    state === 'FAILED' ||
    state === 'CANCELLED' ||
    state === 'INTERRUPTED'
  );
}

function isFinal(state: TaskState): boolean {
  return state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED';
}

export type SubmitResult =
  | { ok: true; task: Task }
  | {
      ok: false;
      reason:
        | 'unknown-action'
        | 'missing-input'
        | 'invalid-input'
        | 'insufficient-resources';
      missing?: string[];
      invalid?: string[];
      blockers?: string[];
      options?: string[];
    };

export type CancelResult =
  | { ok: true }
  | { ok: false; reason: 'unknown-task' | 'already-finished' | 'not-cancellable' };

export type ResumeResult =
  | { ok: true }
  | { ok: false; reason: 'unknown-task' | 'not-interrupted' | 'not-resumable' };

export interface TaskEngineOptions {
  now?: () => number;
  makeId?: () => string;
  /** How many tasks may run at the same time. Default 1. */
  maxConcurrent?: number;
  /** When given, every submit first checks the action's needs against this reading. */
  readProfile?: () => Promise<DeviceProfile>;
}

interface Entry {
  task: Task;
  action: ActionDef;
  controller: AbortController | null;
  /** Counts runs, so a late result from an old run is ignored. */
  run: number;
  holdsSlot: boolean;
  restored: unknown;
}

const ACTION_ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export function createTaskEngine(options: TaskEngineOptions = {}) {
  const now = options.now ?? Date.now;
  let counter = 0;
  const makeId = options.makeId ?? (() => `task-${++counter}`);
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 1);

  const actions = new Map<string, ActionDef>();
  const entries = new Map<string, Entry>();
  const queue: string[] = [];
  const listeners = new Set<(task: Task) => void>();
  const waiters = new Map<string, Array<(task: Task) => void>>();
  let running = 0;

  function snapshot(task: Task): Task {
    return {
      ...task,
      evidence: task.evidence.map((e) => ({ ...e })),
      checkpoint: task.checkpoint ? { ...task.checkpoint } : undefined,
      interrupt: task.interrupt ? { ...task.interrupt } : undefined,
    };
  }

  function note(entry: Entry, event: string, detail?: string) {
    entry.task.evidence.push({ at: now(), event, ...(detail ? { detail } : {}) });
  }

  function publish(entry: Entry) {
    const copy = snapshot(entry.task);
    for (const listener of listeners) {
      try {
        listener(copy);
      } catch {
        // A broken listener must never break a task.
      }
    }
    if (isSettled(entry.task.state)) {
      const list = waiters.get(entry.task.id);
      if (list) {
        waiters.delete(entry.task.id);
        for (const resolve of list) resolve(snapshot(entry.task));
      }
    }
  }

  function move(entry: Entry, to: TaskState) {
    if (!canTransition(entry.task.state, to)) {
      throw new Error(`Invalid task transition ${entry.task.state} -> ${to}`);
    }
    entry.task.state = to;
    if (isSettled(to)) entry.task.endedAt = now();
  }

  function releaseSlot(entry: Entry) {
    if (entry.holdsSlot) {
      entry.holdsSlot = false;
      running -= 1;
    }
  }

  function pump() {
    while (running < maxConcurrent) {
      const id = queue.shift();
      if (id === undefined) return;
      const entry = entries.get(id);
      if (entry && entry.task.state === 'QUEUED') start(entry);
    }
  }

  function start(entry: Entry) {
    entry.holdsSlot = true;
    running += 1;
    entry.run += 1;
    const myRun = entry.run;
    const controller = new AbortController();
    entry.controller = controller;

    move(entry, 'RUNNING');
    entry.task.startedAt ??= now();
    entry.task.endedAt = undefined;
    note(entry, 'started');

    const current = () => entry.run === myRun && entry.task.state !== 'INTERRUPTED';
    const ctx: TaskContext = {
      taskId: entry.task.id,
      signal: controller.signal,
      now,
      restored: entry.restored,
      reportProgress: (fraction) => {
        if (!current() || !Number.isFinite(fraction)) return;
        entry.task.progress = Math.min(1, Math.max(0, fraction));
        publish(entry);
      },
      saveCheckpoint: (data) => {
        if (!current()) return;
        entry.task.checkpoint = { at: now(), data };
        publish(entry);
      },
      throwIfCancelled: () => {
        if (controller.signal.aborted) throw new CancelledError();
      },
    };

    publish(entry);

    let promise: Promise<unknown>;
    try {
      promise = Promise.resolve(entry.action.run(entry.task.input, ctx));
    } catch (error) {
      promise = Promise.reject(error);
    }
    promise.then(
      (output) => settle(entry, myRun, { ok: true, output }),
      (error) => settle(entry, myRun, { ok: false, error })
    );
  }

  function settle(
    entry: Entry,
    myRun: number,
    outcome: { ok: true; output: unknown } | { ok: false; error: unknown }
  ) {
    // A result from an old run, or after the task already ended, is ignored.
    if (entry.run !== myRun) return;
    const state = entry.task.state;
    if (state !== 'RUNNING' && state !== 'CANCEL_REQUESTED') {
      releaseSlot(entry);
      pump();
      return;
    }
    const cancelRequested = state === 'CANCEL_REQUESTED';
    if (outcome.ok) {
      entry.task.output = outcome.output;
      entry.task.progress = 1;
      move(entry, 'COMPLETED');
      note(
        entry,
        'completed',
        cancelRequested ? 'cancel arrived too late; the work had finished' : undefined
      );
    } else if (cancelRequested && outcome.error instanceof CancelledError) {
      move(entry, 'CANCELLED');
      note(entry, 'cancelled');
    } else {
      const message = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
      entry.task.error = message;
      move(entry, 'FAILED');
      note(entry, 'failed', message);
    }
    releaseSlot(entry);
    publish(entry);
    pump();
  }

  return {
    registerAction(action: ActionDef) {
      if (!ACTION_ID.test(action.id)) {
        throw new Error(`Invalid action id "${action.id}". Use lowercase dotted ids like text.count.`);
      }
      if (actions.has(action.id)) throw new Error(`Action "${action.id}" is already registered.`);
      actions.set(action.id, action);
    },

    getAction(id: string): ActionDef | undefined {
      return actions.get(id);
    },

    listActions(): ActionDef[] {
      return [...actions.values()];
    },

    async submit(actionId: string, input: unknown): Promise<SubmitResult> {
      const action = actions.get(actionId);
      if (!action) return { ok: false, reason: 'unknown-action' };

      const check = validateInput(action, input);
      if (!check.ok) {
        return {
          ok: false,
          reason: check.missing.length > 0 ? 'missing-input' : 'invalid-input',
          missing: check.missing,
          invalid: check.invalid,
        };
      }

      if (options.readProfile) {
        const profile = await options.readProfile();
        const resources = checkResources(profile, action.resources);
        if (!resources.ok) {
          return {
            ok: false,
            reason: 'insufficient-resources',
            blockers: resources.blockers,
            options: resources.options,
          };
        }
      }

      const task: Task = {
        id: makeId(),
        capabilityId: action.capabilityId,
        actionId: action.id,
        input: { ...(input as Record<string, unknown>) },
        state: 'CREATED',
        progress: null,
        createdAt: now(),
        evidence: [],
      };
      const entry: Entry = {
        task,
        action,
        controller: null,
        run: 0,
        holdsSlot: false,
        restored: undefined,
      };
      entries.set(task.id, entry);
      note(entry, 'created');
      move(entry, 'QUEUED');
      note(entry, 'queued');
      queue.push(task.id);
      publish(entry);
      pump();
      return { ok: true, task: snapshot(entry.task) };
    },

    getTask(id: string): Task | undefined {
      const entry = entries.get(id);
      return entry ? snapshot(entry.task) : undefined;
    },

    listTasks(): Task[] {
      return [...entries.values()].map((e) => snapshot(e.task));
    },

    /** Resolves when the task is COMPLETED, FAILED, CANCELLED or INTERRUPTED. */
    whenDone(id: string): Promise<Task> {
      const entry = entries.get(id);
      if (!entry) return Promise.reject(new Error(`Unknown task ${id}`));
      if (isSettled(entry.task.state)) return Promise.resolve(snapshot(entry.task));
      return new Promise((resolve) => {
        const list = waiters.get(id) ?? [];
        list.push(resolve);
        waiters.set(id, list);
      });
    },

    subscribe(listener: (task: Task) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    cancel(id: string): CancelResult {
      const entry = entries.get(id);
      if (!entry) return { ok: false, reason: 'unknown-task' };
      const state = entry.task.state;
      if (isFinal(state)) return { ok: false, reason: 'already-finished' };

      if (state === 'QUEUED' || state === 'CREATED' || state === 'INTERRUPTED') {
        const at = queue.indexOf(id);
        if (at >= 0) queue.splice(at, 1);
        move(entry, 'CANCELLED');
        note(entry, 'cancelled');
        publish(entry);
        return { ok: true };
      }

      if (state === 'CANCEL_REQUESTED') return { ok: true };

      if (entry.action.cancel === 'none') {
        note(entry, 'cancel-denied', 'this action cannot be cancelled');
        publish(entry);
        return { ok: false, reason: 'not-cancellable' };
      }

      entry.controller?.abort();
      if (entry.action.cancel === 'immediate') {
        move(entry, 'CANCELLED');
        note(entry, 'cancelled');
        releaseSlot(entry);
        publish(entry);
        pump();
      } else {
        move(entry, 'CANCEL_REQUESTED');
        note(entry, 'cancel-requested');
        publish(entry);
      }
      return { ok: true };
    },

    /** Marks a running task interrupted, for example when the app is closed or the OS stops it. */
    interrupt(id: string, reason: string, resumable: boolean): boolean {
      const entry = entries.get(id);
      if (!entry) return false;
      const state = entry.task.state;
      if (state !== 'RUNNING' && state !== 'PAUSED' && state !== 'CANCEL_REQUESTED') return false;
      entry.controller?.abort();
      const info: InterruptInfo = { reason, resumable };
      entry.task.interrupt = info;
      move(entry, 'INTERRUPTED');
      note(entry, 'interrupted', `${reason} (${resumable ? 'resumable' : 'not resumable'})`);
      releaseSlot(entry);
      publish(entry);
      pump();
      return true;
    },

    resume(id: string): ResumeResult {
      const entry = entries.get(id);
      if (!entry) return { ok: false, reason: 'unknown-task' };
      if (entry.task.state !== 'INTERRUPTED') return { ok: false, reason: 'not-interrupted' };
      if (!entry.task.interrupt?.resumable) return { ok: false, reason: 'not-resumable' };
      entry.restored = entry.task.checkpoint?.data;
      entry.task.interrupt = undefined;
      move(entry, 'QUEUED');
      note(entry, 'resumed');
      queue.push(id);
      publish(entry);
      pump();
      return { ok: true };
    },
  };
}

export type TaskEngine = ReturnType<typeof createTaskEngine>;

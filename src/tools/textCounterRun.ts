/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Runs the Text Counter screen's count as a real task on the execution kernel,
 * the same action the chat uses (text.count). The result names the task that produced it.
 */

import type { TaskEngine } from '../kernel/taskEngine';
import type { TextCounts } from '../kernel/textCount';

export type TextCounterOutcome =
  | { ok: true; counts: TextCounts; taskId: string; ms: number; evidence: string }
  | { ok: false; message: string; taskId?: string };

function isCounts(value: unknown): value is TextCounts {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.characters === 'number' &&
    typeof v.charactersNoSpaces === 'number' &&
    typeof v.letters === 'number' &&
    typeof v.words === 'number' &&
    typeof v.lines === 'number'
  );
}

/** Counts `text` on the kernel. An empty text runs nothing. */
export async function runTextCounter(engine: TaskEngine, text: string): Promise<TextCounterOutcome> {
  if (text === '') {
    return { ok: false, message: 'Type or paste some text first. Nothing was run.' };
  }
  const submitted = await engine.submit('text.count', { text, unit: 'all' });
  if (!submitted.ok) {
    const message =
      submitted.reason === 'insufficient-resources'
        ? `This device cannot do that right now: ${(submitted.blockers ?? []).join('; ')}.`
        : `I could not start that (${submitted.reason}).`;
    return { ok: false, message };
  }
  const done = await engine.whenDone(submitted.task.id);
  if (done.state !== 'COMPLETED') {
    return {
      ok: false,
      taskId: done.id,
      message: `That did not finish. Task ${done.id} ended ${done.state}${done.error ? `: ${done.error}` : ''}.`,
    };
  }
  if (!isCounts(done.output)) {
    return {
      ok: false,
      taskId: done.id,
      message: `Task ${done.id} finished but returned no counts, so nothing is shown.`,
    };
  }
  const ms =
    done.startedAt !== undefined && done.endedAt !== undefined
      ? Math.max(0, done.endedAt - done.startedAt)
      : 0;
  return {
    ok: true,
    counts: done.output,
    taskId: done.id,
    ms,
    evidence: `Ran as task ${done.id}: ${done.state} in ${ms} ms, from your exact input.`,
  };
}

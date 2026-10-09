/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local rules: the first source of the Brain. Deterministic commands that run
 * as real tasks on the execution kernel, follow-up questions for missing
 * inputs, and an honest "what can you do" answer built from what is registered.
 * No language intelligence: a message that is not a known phrasing is not
 * handled here.
 */

import type { TaskEngine } from '../kernel/taskEngine';
import type { PlannedSource } from './types';
import type { BrainProvider, BrainReply, BrainRequest, CommandDef } from './types';

/** How long a follow-up question stays open. */
export const PENDING_TTL_MS = 120_000;

const CANCEL_WORDS = new Set(['cancel', 'stop', 'never mind', 'nevermind', 'forget it', 'no']);
const HELP = /^(?:help|what can you do|what do you do|what tools do you have|what commands (?:do you have|can i use))\s*[?.!]*$/i;

interface Pending {
  command: CommandDef;
  input: Record<string, unknown>;
  field: string;
  askedAt: number;
}

export interface LocalRulesOptions {
  commands: CommandDef[];
  engine: TaskEngine;
  planned: PlannedSource[];
  now?: () => number;
}

export function createLocalRules(options: LocalRulesOptions): BrainProvider & {
  abilities(): string[];
  reset(): void;
} {
  const { commands, engine, planned } = options;
  const now = options.now ?? Date.now;
  let pending: Pending | null = null;

  const SOURCE = 'local-rules';

  function reply(content: string, taskId?: string): BrainReply {
    return { content, source: SOURCE, ...(taskId ? { taskId } : {}) };
  }

  function isOpen(): boolean {
    return pending !== null && now() - pending.askedAt <= PENDING_TTL_MS;
  }

  function abilities(): string[] {
    return commands.map((c) => c.title);
  }

  function helpReply(): BrainReply {
    const lines = commands.map(
      (c, i) => `${i + 1}. ${c.title}. Try: "${c.examples[0]}".`
    );
    const notConnected = planned.map((p) => p.label).join(', ');
    return reply(
      `Here is what I can run right now:\n\n${lines.join('\n')}\n\n` +
        `Not connected yet: ${notConnected}. ` +
        `I will not guess at anything I cannot do.`
    );
  }

  async function run(command: CommandDef, input: Record<string, unknown>): Promise<BrainReply> {
    const submitted = await engine.submit(command.actionId, input);
    if (!submitted.ok) {
      const why =
        submitted.reason === 'insufficient-resources'
          ? `This device cannot do that right now: ${(submitted.blockers ?? []).join('; ')}.`
          : `I could not start that (${submitted.reason}).`;
      return reply(why);
    }
    const done = await engine.whenDone(submitted.task.id);
    if (done.state !== 'COMPLETED') {
      return reply(
        `That did not finish. Task ${done.id} ended ${done.state}${done.error ? `: ${done.error}` : ''}.`,
        done.id
      );
    }
    const ms =
      done.startedAt !== undefined && done.endedAt !== undefined
        ? Math.max(0, done.endedAt - done.startedAt)
        : 0;
    return reply(
      `${command.describe(done.output, input)}\n\nRan as task ${done.id}: ${done.state} in ${ms} ms, ` +
        `from your exact input.`,
      done.id
    );
  }

  return {
    id: SOURCE,
    label: 'AXON local rules',

    status() {
      return {
        id: SOURCE,
        label: 'AXON local rules',
        ready: true,
        note: `${commands.length} command${commands.length === 1 ? '' : 's'} registered`,
      };
    },

    holdsConversation: isOpen,

    abilities,

    reset() {
      pending = null;
    },

    async handle(request: BrainRequest): Promise<BrainReply | null> {
      const text = request.text.trim();
      if (text === '') return null;
      const open = isOpen() ? pending : null;
      if (!open) pending = null;

      if (open && CANCEL_WORDS.has(text.toLowerCase())) {
        pending = null;
        return reply('Okay, cancelled. Nothing was run.');
      }

      if (HELP.test(text)) return helpReply();

      for (const command of commands) {
        const match = command.match(text);
        if (!match) continue;
        if (match.ask) {
          pending = { command, input: match.input, field: match.ask.field, askedAt: now() };
          return reply(match.ask.question);
        }
        pending = null;
        return run(command, match.input);
      }

      if (open) {
        const input = open.command.fill(open.input, open.field, text);
        pending = null;
        return run(open.command, input);
      }

      return null;
    },
  };
}

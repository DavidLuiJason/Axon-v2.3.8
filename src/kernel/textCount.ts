/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Text Counter: the first real action on the execution kernel.
 * Counts exactly what it is given. It never estimates.
 */

import type { ActionDef } from './types';

export interface TextCounts {
  characters: number;
  charactersNoSpaces: number;
  letters: number;
  words: number;
  lines: number;
}

/** Counts the given text. Characters are counted as Unicode code points. */
export function countText(text: string): TextCounts {
  const chars = Array.from(text);
  const trimmed = text.trim();
  const withoutFinalBreak = text.replace(/(?:\r\n|\r|\n)$/, '');
  let lines = 0;
  if (text !== '') {
    lines = withoutFinalBreak === '' ? 1 : withoutFinalBreak.split(/\r\n|\r|\n/).length;
  }
  return {
    characters: chars.length,
    charactersNoSpaces: chars.filter((c) => !/\s/u.test(c)).length,
    letters: chars.filter((c) => /\p{L}/u.test(c)).length,
    words: trimmed === '' ? 0 : trimmed.split(/\s+/u).length,
    lines,
  };
}

export const TEXT_COUNT_ACTION: ActionDef = {
  id: 'text.count',
  capabilityId: 'text-tools',
  label: 'Count text',
  executionClass: 'instant',
  inputFields: [
    {
      name: 'text',
      type: 'string',
      required: true,
      prompt: 'What text should I count? Paste or type it and send it.',
    },
    {
      name: 'unit',
      type: 'string',
      required: false,
      prompt: 'Should I count words, characters, letters or lines?',
    },
  ],
  outputFields: [
    { name: 'characters', type: 'number' },
    { name: 'charactersNoSpaces', type: 'number' },
    { name: 'letters', type: 'number' },
    { name: 'words', type: 'number' },
    { name: 'lines', type: 'number' },
  ],
  resources: {},
  cancel: 'none',
  evidence: 'The task ended COMPLETED and its counts were computed from the exact text it was given.',
  run: async (input) => countText(String(input.text)),
};

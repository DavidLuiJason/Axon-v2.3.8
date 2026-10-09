/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Text Counter as a Brain command: which phrasings it understands and how
 * its result is described. It matches only known phrasings; anything else is
 * not a command.
 */

import type { TextCounts } from '../kernel/textCount';
import type { CommandDef, CommandMatch } from './types';

type Unit = 'words' | 'characters' | 'letters' | 'lines' | 'all';

export const TEXT_QUESTION =
  'What text should I count? Paste or type it and send it. (Say "cancel" to stop.)';

const UNIT = '(words?|characters?|chars?|letters?|lines?)';
const LEAD = '(?:please\\s+|can you\\s+|could you\\s+)?';

const PATTERNS: RegExp[] = [
  // count words in <text> / count the characters of <text>
  new RegExp(`^${LEAD}count\\s+(?:the\\s+)?${UNIT}\\s+(?:in|of)\\b\\s*([\\s\\S]*)$`, 'i'),
  // how many words are in <text> / how many lines in <text>
  new RegExp(`^${LEAD}how\\s+many\\s+${UNIT}\\s+(?:(?:are|is|do|does)\\s+)?(?:there\\s+)?(?:in|of)\\b\\s*([\\s\\S]*)$`, 'i'),
  // count words / count words: <text>
  new RegExp(`^${LEAD}count\\s+(?:the\\s+)?${UNIT}\\s*(?:[:\\-]\\s*([\\s\\S]*))?$`, 'i'),
  // word count / word count: <text> / character count of <text>
  new RegExp(`^${LEAD}(word|character|char|letter|line)\\s+count\\b\\s*(?:of|in|for)?\\s*[:\\-]?\\s*([\\s\\S]*)$`, 'i'),
];

const DEICTIC = new Set([
  'this', 'this text', 'this sentence', 'this message', 'this paragraph',
  'that', 'that text', 'the text', 'the following', 'the following text',
  'following', 'following text', 'it', 'the above', 'above',
]);

function toUnit(word: string | undefined): Unit {
  if (!word) return 'all';
  const w = word.toLowerCase();
  if (w.startsWith('word')) return 'words';
  if (w.startsWith('char')) return 'characters';
  if (w.startsWith('letter')) return 'letters';
  if (w.startsWith('line')) return 'lines';
  return 'all';
}

function stripQuotes(text: string): string {
  const pairs: Array<[string, string]> = [['"', '"'], ["'", "'"], ['\u201c', '\u201d'], ['\u2018', '\u2019']];
  for (const [open, close] of pairs) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close)) {
      return text.slice(1, -1);
    }
  }
  return text;
}

/** Removes a leading ":" or a "this text:" style label, then the surrounding quotes. */
function cleanText(raw: string): string {
  const rest = raw.replace(/^\s*:\s*/, '');
  const withoutLabel = rest.replace(
    /^(?:this text|this|the following text|the following|the text|following text|following)\s*[:\-]\s*/i,
    ''
  );
  return stripQuotes(withoutLabel.trim());
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const TEXT_COUNT_COMMAND: CommandDef = {
  id: 'text-count',
  actionId: 'text.count',
  title: 'Count text',
  examples: [
    'count words in hello brave new world',
    'how many characters are in good morning',
    'count lines',
  ],

  match(message: string): CommandMatch | null {
    for (const pattern of PATTERNS) {
      const m = pattern.exec(message.trim());
      if (!m) continue;
      const unit = toUnit(m[1]);
      const cleaned = cleanText(m[2] ?? '');
      const missing = cleaned === '' || DEICTIC.has(cleaned.toLowerCase().replace(/[?.!]+$/, ''));
      if (missing) {
        return { input: { unit }, ask: { field: 'text', question: TEXT_QUESTION } };
      }
      return { input: { text: cleaned, unit } };
    }
    return null;
  },

  fill(partial, field, answer) {
    return { ...partial, [field]: stripQuotes(answer.trim()) };
  },

  describe(output, input) {
    const c = output as TextCounts;
    const unit = input.unit as Unit;
    const details =
      `Words: ${c.words}\n` +
      `Characters: ${c.characters} (${c.charactersNoSpaces} without spaces)\n` +
      `Letters: ${c.letters}\n` +
      `Lines: ${c.lines}`;
    let headline: string;
    switch (unit) {
      case 'words':
        headline = `That text has ${plural(c.words, 'word', 'words')}.`;
        break;
      case 'characters':
        headline = `That text has ${plural(c.characters, 'character', 'characters')} (${c.charactersNoSpaces} without spaces).`;
        break;
      case 'letters':
        headline = `That text has ${plural(c.letters, 'letter', 'letters')}.`;
        break;
      case 'lines':
        headline = `That text has ${plural(c.lines, 'line', 'lines')}.`;
        break;
      default:
        headline = 'Here are the counts for that text:';
    }
    return `${headline}\n\n${details}`;
  },
};

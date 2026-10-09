/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON execution kernel: input checking for actions.
 */

import type { ActionDef, FieldSpec } from './types';

export type InputCheck =
  | { ok: true }
  | { ok: false; missing: string[]; invalid: string[] };

function matchesType(value: unknown, type: FieldSpec['type']): boolean {
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

/**
 * Checks an input against an action's declared fields.
 * A field is missing when it is required and undefined or null.
 * A field is invalid when it is present with the wrong type.
 * Unknown extra fields are ignored.
 */
export function validateInput(
  action: Pick<ActionDef, 'inputFields'>,
  input: unknown
): InputCheck {
  const record: Record<string, unknown> =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const field of action.inputFields) {
    const value = record[field.name];
    if (value === undefined || value === null) {
      if (field.required) missing.push(field.name);
      continue;
    }
    if (!matchesType(value, field.type)) invalid.push(field.name);
  }
  if (missing.length === 0 && invalid.length === 0) return { ok: true };
  return { ok: false, missing, invalid };
}

/** The follow-up questions to ask for the missing inputs, in field order. */
export function followUpQuestions(
  action: Pick<ActionDef, 'inputFields'>,
  missing: string[]
): string[] {
  return action.inputFields
    .filter((f) => missing.includes(f.name))
    .map((f) => f.prompt);
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The one Brain the app uses, with its sources wired in. New sources and new
 * commands are added here and nowhere else.
 */

import { getAxonEngine } from '../kernel/axonEngine';
import { createBrain, PLANNED_SOURCES, type Brain } from './brain';
import { createFoundation } from './foundation';
import { createLocalRules } from './localRules';
import { TEXT_COUNT_COMMAND } from './textCountCommand';

let shared: Brain | null = null;

export function getAxonBrain(): Brain {
  if (!shared) {
    const localRules = createLocalRules({
      commands: [TEXT_COUNT_COMMAND],
      engine: getAxonEngine(),
      planned: PLANNED_SOURCES,
    });
    shared = createBrain([localRules], createFoundation());
  }
  return shared;
}

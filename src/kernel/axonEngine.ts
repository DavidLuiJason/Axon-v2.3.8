/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The one task engine the app uses, with its real actions registered.
 * Test actions never go here.
 */

import { readDeviceProfile } from './deviceProfile';
import { createTaskEngine, type TaskEngine, type TaskEngineOptions } from './taskEngine';
import { TEXT_COUNT_ACTION } from './textCount';

export function createAxonEngine(options: TaskEngineOptions = {}): TaskEngine {
  const engine = createTaskEngine({ readProfile: () => readDeviceProfile(), ...options });
  engine.registerAction(TEXT_COUNT_ACTION);
  return engine;
}

let shared: TaskEngine | null = null;

export function getAxonEngine(): TaskEngine {
  if (!shared) shared = createAxonEngine();
  return shared;
}

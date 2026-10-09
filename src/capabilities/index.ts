/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public entry for the capability system (Stage 2).
 */

export type { Capability } from './types';
export {
  registerCapability,
  getCapability,
  listCapabilities,
  getRegistrySnapshot,
} from './registry';

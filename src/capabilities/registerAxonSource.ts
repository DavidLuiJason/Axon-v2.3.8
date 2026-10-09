/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4C — register AXON Source as a real capability.
 * Declarative architecture only: no UI mount coupling, no behavior change
 * to AxonSourceScreen.tsx or sourceService.ts.
 * Known open issue (out of scope): production fallback fakes file size/mtime.
 */

import { registerCapability, getCapability } from './registry';

const AXON_SOURCE_CAPABILITY = {
  id: 'cap.axon-source',
  displayName: 'AXON Source',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
} as const;

/**
 * Register the AXON Source capability at app startup.
 * Call once — not from AxonSourceScreen mount/unmount.
 */
export function registerAxonSourceCapability(): void {
  registerCapability({ ...AXON_SOURCE_CAPABILITY });
  console.log(
    '[AXON capability registry] AXON Source registered:',
    getCapability('cap.axon-source')
  );
}

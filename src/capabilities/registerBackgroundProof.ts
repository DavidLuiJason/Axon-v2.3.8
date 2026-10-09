/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 6 — register Background Proof as a real capability.
 * Declarative architecture only: no UI mount coupling.
 * Mirrors Stage 4C AXON Source registration pattern exactly.
 */

import { registerCapability, getCapability } from './registry';

const BACKGROUND_PROOF_CAPABILITY = {
  id: 'cap.background-proof',
  displayName: 'Background Proof',
  contractVersion: '1.0.0',
  implementationVersion: '1.0.0',
} as const;

/**
 * Register the Background Proof capability at app startup.
 * Call once — not from BackgroundProofScreen mount/unmount.
 */
export function registerBackgroundProofCapability(): void {
  registerCapability({ ...BACKGROUND_PROOF_CAPABILITY });
  console.log(
    '[AXON capability registry] Background Proof registered:',
    getCapability('cap.background-proof')
  );
}

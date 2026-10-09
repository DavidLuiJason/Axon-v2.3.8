/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 6 — register Background Proof as a real interface.
 * Declarative architecture only: no UI mount coupling.
 * Mirrors Stage 4C AXON Source registration pattern exactly.
 *
 * isNavigable: true — reached via currentScreen router
 * (currentScreen === 'background-proof'), so it is a direct navigation destination.
 */

import { registerInterface, getInterface } from './registry';

const BACKGROUND_PROOF_INTERFACE = {
  interfaceId: 'iface.background-proof',
  displayName: 'Background Proof',
  parentId: null as null,
  kind: 'screen' as const,
  isNavigable: true,
};

/**
 * Register the Background Proof interface at app startup.
 * Call once — not from BackgroundProofScreen mount/unmount.
 */
export function registerBackgroundProofInterface(): void {
  registerInterface({ ...BACKGROUND_PROOF_INTERFACE });
  console.log(
    '[AXON interface registry] Background Proof registered:',
    getInterface('iface.background-proof')
  );
}

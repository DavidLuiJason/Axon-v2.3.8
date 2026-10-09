/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4C — register AXON Source as a real interface.
 * Declarative architecture only: no UI mount coupling, no behavior change
 * to AxonSourceScreen.tsx or sourceService.ts.
 *
 * isNavigable: true — same as AXON Tools: reached via currentScreen router
 * (currentScreen === 'axon-source'), so it is a direct navigation destination.
 */

import { registerInterface, getInterface } from './registry';

const AXON_SOURCE_INTERFACE = {
  interfaceId: 'iface.axon-source',
  displayName: 'AXON Source',
  parentId: null as null,
  kind: 'screen' as const,
  isNavigable: true,
};

/**
 * Register the AXON Source interface at app startup.
 * Call once — not from AxonSourceScreen mount/unmount.
 */
export function registerAxonSourceInterface(): void {
  registerInterface({ ...AXON_SOURCE_INTERFACE });
  console.log(
    '[AXON interface registry] AXON Source registered:',
    getInterface('iface.axon-source')
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4B — register AXON Tools as a real interface.
 * Declarative architecture only: no UI mount coupling, no behavior change
 * to AxonToolsScreen.tsx.
 *
 * isNavigable: true — unlike Settings (modal + isSettingsModalOpen), AXON
 * Tools is reached via the currentScreen router (currentScreen ===
 * 'axon-tools'). Under this contract it is a direct navigation destination.
 */

import { registerInterface, getInterface } from './registry';

const AXON_TOOLS_INTERFACE = {
  interfaceId: 'iface.axon-tools',
  displayName: 'AXON Tools',
  parentId: null as null,
  kind: 'screen' as const,
  isNavigable: true,
};

/**
 * Text Counter opens inside the Tools screen (it is not a currentScreen value),
 * so it is a panel under Tools and not a direct navigation destination.
 */
const TEXT_COUNTER_INTERFACE = {
  interfaceId: 'iface.text-counter',
  displayName: 'Text Counter',
  parentId: 'iface.axon-tools',
  kind: 'panel' as const,
  isNavigable: false,
};

/**
 * Register the AXON Tools interface, and the Text Counter panel under it, at app startup.
 * Call once — not from AxonToolsScreen mount/unmount.
 */
export function registerAxonToolsInterface(): void {
  registerInterface({ ...AXON_TOOLS_INTERFACE });
  registerInterface({ ...TEXT_COUNTER_INTERFACE });
  console.log(
    '[AXON interface registry] AXON Tools registered:',
    getInterface('iface.axon-tools')
  );
  console.log(
    '[AXON interface registry] Text Counter registered:',
    getInterface('iface.text-counter')
  );
}

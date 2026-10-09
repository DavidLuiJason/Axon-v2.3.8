/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4A — register Settings as a real interface.
 * Declarative architecture only: no UI mount coupling, no behavior change
 * to SettingsModal.tsx.
 *
 * isNavigable: false — Settings is a modal opened by explicit UI action
 * (isSettingsModalOpen). It is not a currentScreen router destination, so
 * under this contract it exists but is not a direct navigation target.
 */

import { registerInterface, getInterface } from './registry';

const SETTINGS_INTERFACE = {
  interfaceId: 'iface.settings',
  displayName: 'Settings',
  parentId: null as null,
  kind: 'modal' as const,
  isNavigable: false,
};

/**
 * Register the Settings interface at app startup.
 * Call once — not from SettingsModal mount/unmount.
 */
export function registerSettingsInterface(): void {
  registerInterface({ ...SETTINGS_INTERFACE });
  console.log(
    '[AXON interface registry] Settings registered:',
    getInterface('iface.settings')
  );
}

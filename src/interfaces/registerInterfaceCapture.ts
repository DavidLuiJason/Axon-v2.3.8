/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4D — register Interface Capture as a real interface (UI shell).
 * The capture engine is deleted; only the screen shell remains.
 *
 * isNavigable: true — reached via currentScreen === 'interface-capture',
 * same router pattern as AXON Tools / AXON Source. Navigable does not
 * mean the underlying capture engine works.
 */

import { registerInterface, getInterface } from './registry';

const INTERFACE_CAPTURE_INTERFACE = {
  interfaceId: 'iface.interface-capture',
  displayName: 'Interface Capture',
  parentId: null as null,
  kind: 'screen' as const,
  isNavigable: true,
};

/**
 * Register Interface Capture interface at app startup.
 * Call once — not from InterfaceCaptureScreen mount/unmount.
 */
export function registerInterfaceCaptureInterface(): void {
  registerInterface({ ...INTERFACE_CAPTURE_INTERFACE });
  console.log(
    '[AXON interface registry] Interface Capture (shell) registered:',
    getInterface('iface.interface-capture')
  );
}

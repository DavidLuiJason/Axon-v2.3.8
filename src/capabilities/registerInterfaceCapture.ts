/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 4D — register Interface Capture as a real capability that is
 * explicitly a UI shell only.
 *
 * The capture engine/storage was deleted in an earlier reset. Only the
 * visual JSX shell remains. implementationVersion uses a 0.0.0-shell
 * pre-release form so this entry cannot be mistaken for a complete,
 * working capability. Do not treat registration as proof that capture
 * functionality exists.
 */

import { registerCapability, getCapability } from './registry';

const INTERFACE_CAPTURE_CAPABILITY = {
  id: 'cap.interface-capture',
  displayName: 'Interface Capture',
  contractVersion: '1.0.0',
  /**
   * Shell-only convention: 0.0.0-<label> means no functional engine.
   * Not a production 1.x implementation.
   */
  implementationVersion: '0.0.0-shell',
} as const;

/**
 * Register Interface Capture (shell) at app startup.
 * Call once — not from InterfaceCaptureScreen mount/unmount.
 */
export function registerInterfaceCaptureCapability(): void {
  registerCapability({ ...INTERFACE_CAPTURE_CAPABILITY });
  console.log(
    '[AXON capability registry] Interface Capture (shell) registered:',
    getCapability('cap.interface-capture')
  );
}

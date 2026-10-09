/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public entry for the interface system (Stage 3).
 */

export type {
  InterfaceKind,
  InterfaceId,
  InterfaceInstanceId,
  InterfaceDescriptor,
} from './types';
export type { InterfaceTreeNode } from './registry';
export {
  registerInterface,
  getInterface,
  listInterfaces,
  getChildInterfaces,
  getInterfaceTree,
  getInterfaceRegistrySnapshot,
} from './registry';

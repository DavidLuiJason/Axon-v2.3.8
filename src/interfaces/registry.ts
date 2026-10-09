/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interface registry — Stage 3
 *
 * Metadata-only, strict tree, no React lifecycle coupling.
 * Registration is always an explicit `registerInterface` call.
 */

import type { InterfaceDescriptor, InterfaceId, InterfaceKind } from './types';

const VALID_KINDS: readonly InterfaceKind[] = [
  'screen',
  'panel',
  'drawer',
  'modal',
  'overlay',
] as const;

const byId = new Map<InterfaceId, InterfaceDescriptor>();

function assertValidDescriptor(desc: InterfaceDescriptor): void {
  if (!desc.interfaceId || typeof desc.interfaceId !== 'string') {
    throw new Error(
      '[AXON interface registry] interfaceId is required and must be a non-empty string'
    );
  }
  if (!desc.displayName || typeof desc.displayName !== 'string') {
    throw new Error(
      `[AXON interface registry] displayName is required (interfaceId=${desc.interfaceId})`
    );
  }
  if (desc.interfaceId === desc.displayName) {
    throw new Error(
      `[AXON interface registry] interfaceId must never equal displayName (got "${desc.interfaceId}")`
    );
  }
  if (desc.parentId !== null && typeof desc.parentId !== 'string') {
    throw new Error(
      `[AXON interface registry] parentId must be string or null (interfaceId=${desc.interfaceId})`
    );
  }
  if (!VALID_KINDS.includes(desc.kind)) {
    throw new Error(
      `[AXON interface registry] invalid kind "${desc.kind}" (interfaceId=${desc.interfaceId})`
    );
  }
  if (typeof desc.isNavigable !== 'boolean') {
    throw new Error(
      `[AXON interface registry] isNavigable must be boolean (interfaceId=${desc.interfaceId})`
    );
  }
}

/**
 * Walk from candidateParent upward; return true if we hit childId (cycle).
 */
function wouldCreateCycle(
  childId: InterfaceId,
  parentId: InterfaceId
): boolean {
  let current: InterfaceId | null = parentId;
  const seen = new Set<InterfaceId>();
  while (current !== null) {
    if (current === childId) return true;
    if (seen.has(current)) return true; // defensive: corrupt existing graph
    seen.add(current);
    const node = byId.get(current);
    if (!node) break;
    current = node.parentId;
  }
  return false;
}

/**
 * Explicitly register an interface type.
 * Rejects: invalid metadata, duplicate interfaceId, unknown non-null parent,
 * cycles, and any attempt at multi-parent (single parentId field only).
 */
export function registerInterface(desc: InterfaceDescriptor): void {
  assertValidDescriptor(desc);

  if (byId.has(desc.interfaceId)) {
    throw new Error(
      `[AXON interface registry] interface already registered: ${desc.interfaceId}`
    );
  }

  if (desc.parentId !== null) {
    if (!byId.has(desc.parentId)) {
      throw new Error(
        `[AXON interface registry] parentId "${desc.parentId}" is not registered (child=${desc.interfaceId})`
      );
    }
    if (wouldCreateCycle(desc.interfaceId, desc.parentId)) {
      throw new Error(
        `[AXON interface registry] registration would create a cycle (interfaceId=${desc.interfaceId}, parentId=${desc.parentId})`
      );
    }
  }

  byId.set(desc.interfaceId, { ...desc });
}

export function getInterface(
  interfaceId: InterfaceId
): InterfaceDescriptor | undefined {
  const found = byId.get(interfaceId);
  return found ? { ...found } : undefined;
}

export function listInterfaces(): InterfaceDescriptor[] {
  return Array.from(byId.values()).map((d) => ({ ...d }));
}

/** Direct children of a given interfaceId (empty if none or unknown parent). */
export function getChildInterfaces(
  parentId: InterfaceId | null
): InterfaceDescriptor[] {
  return listInterfaces().filter((d) => d.parentId === parentId);
}

/**
 * Reconstruct a simple tree node for verification/debugging.
 * Does not allocate instanceIds — type tree only.
 */
export interface InterfaceTreeNode {
  interface: InterfaceDescriptor;
  children: InterfaceTreeNode[];
}

export function getInterfaceTree(
  rootId: InterfaceId | null = null
): InterfaceTreeNode[] {
  const roots = getChildInterfaces(rootId);
  return roots.map((iface) => ({
    interface: iface,
    children: getInterfaceTree(iface.interfaceId),
  }));
}

export function getInterfaceRegistrySnapshot(): ReadonlyArray<
  Readonly<InterfaceDescriptor>
> {
  return listInterfaces();
}

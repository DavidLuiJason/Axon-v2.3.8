/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Capability registry — Stage 2
 *
 * Stores capability *metadata* only. No business logic, no React lifecycle
 * coupling. Registration is always an explicit `registerCapability` call —
 * never automatic discovery and never implied by component mount/unmount.
 */

import type { Capability } from './types';

const byId = new Map<string, Capability>();

function assertValidMetadata(meta: Capability): void {
  if (!meta.id || typeof meta.id !== 'string') {
    throw new Error('[AXON capability registry] id is required and must be a non-empty string');
  }
  if (!meta.displayName || typeof meta.displayName !== 'string') {
    throw new Error(
      `[AXON capability registry] displayName is required (id=${meta.id})`
    );
  }
  if (meta.id === meta.displayName) {
    throw new Error(
      `[AXON capability registry] id must never equal displayName (got "${meta.id}")`
    );
  }
  if (!meta.contractVersion || typeof meta.contractVersion !== 'string') {
    throw new Error(
      `[AXON capability registry] contractVersion is required (id=${meta.id})`
    );
  }
  if (!meta.implementationVersion || typeof meta.implementationVersion !== 'string') {
    throw new Error(
      `[AXON capability registry] implementationVersion is required (id=${meta.id})`
    );
  }
}

/**
 * Explicitly register a capability. Rejects duplicate ids and invalid metadata.
 * Does not run capability logic and does not mount UI.
 */
export function registerCapability(meta: Capability): void {
  assertValidMetadata(meta);
  if (byId.has(meta.id)) {
    throw new Error(
      `[AXON capability registry] capability already registered: ${meta.id}`
    );
  }
  // Store a shallow copy so callers cannot mutate the registry entry in place
  byId.set(meta.id, { ...meta });
}

/** Look up one capability by immutable id. */
export function getCapability(id: string): Capability | undefined {
  const found = byId.get(id);
  return found ? { ...found } : undefined;
}

/** List all registered capabilities (copy of current registry contents). */
export function listCapabilities(): Capability[] {
  return Array.from(byId.values()).map((c) => ({ ...c }));
}

/**
 * Read-only snapshot for verification / debugging.
 * Prefer listCapabilities() for normal reads.
 */
export function getRegistrySnapshot(): ReadonlyArray<Readonly<Capability>> {
  return listCapabilities();
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interface contract — Stage 3
 *
 * An interface is an architectural surface declared in the interface
 * registry. It is NOT the same as a React component being mounted, and
 * existence is NOT the same as being a navigation destination (`isNavigable`).
 */

/**
 * Structural kind of interface surface.
 * Used by near-term consumers to classify screens vs overlays without
 * assuming every interface is navigable.
 */
export type InterfaceKind =
  | 'screen'
  | 'panel'
  | 'drawer'
  | 'modal'
  | 'overlay';

/**
 * Stable architectural identity of an interface *type*.
 * Example: "iface.test-example"
 *
 * Distinct from `InterfaceInstanceId`, which identifies one runtime
 * occurrence of that type (e.g. two modals of the same type open at once).
 * This stage registers types only; instance tracking is defined here for
 * the contract but not implemented in the registry yet.
 */
export type InterfaceId = string;

/**
 * Runtime occurrence of an interface type.
 * Would be allocated when a concrete instance is created (e.g. opening a
 * second concurrent panel of the same interfaceId). Not stored by the
 * Stage 3 registry — type registration only.
 */
export type InterfaceInstanceId = string;

/**
 * Interface metadata contract (type-level registration).
 */
export interface InterfaceDescriptor {
  /**
   * Immutable stable id for this interface type. Never equals displayName
   * by convention of architectural ids (enforced at registration for clarity
   * when id looks human-readable).
   */
  interfaceId: InterfaceId;

  /** Human-readable label; may change without changing interfaceId. */
  displayName: string;

  /**
   * Parent interfaceId, or null for a root. Exactly one parent (or root).
   * Multi-parent graphs are rejected by the registry.
   */
  parentId: InterfaceId | null;

  /** Structural kind — see InterfaceKind. */
  kind: InterfaceKind;

  /**
   * Whether this interface is ever a direct navigation destination.
   * Separate from existence: a registered modal may have isNavigable=false.
   */
  isNavigable: boolean;
}

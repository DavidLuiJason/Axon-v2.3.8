/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON persistence layer — Stage 1B
 *
 * Introduces localStorage persistence for GLOBAL state only.
 * No prior persistence existed; this is new behavior.
 *
 * - Schema is versioned (v1) so future migrations can branch.
 * - UI-local / ephemeral fields are never written.
 * - Corrupt or unknown data falls back to defaults for the session
 *   without clearing storage (user data is not silently destroyed).
 * - Write failures (quota, private mode, etc.) are logged and ignored
 *   so the UI never blocks or crashes.
 */

import type { ChatMessage, RecentChat } from '../types';
import type { AxonScreen, GlobalState } from './axonState';

/** Monotonic schema version for the persisted GLOBAL payload. */
export const STORAGE_SCHEMA_VERSION = 1 as const;

/** localStorage key — includes version for future coexistence if needed. */
export const STORAGE_KEY = `axon.global.v${STORAGE_SCHEMA_VERSION}`;

/** Debounce interval for writes (ms). Batches rapid updates (e.g. messages). */
export const PERSIST_DEBOUNCE_MS = 400;

/** Shape actually written to disk — GLOBAL only, no UI-local fields. */
export interface PersistedGlobalPayload {
  schemaVersion: typeof STORAGE_SCHEMA_VERSION;
  currentScreen: AxonScreen;
  activeChatId: string | null;
  recents: RecentChat[];
  messages: ChatMessage[];
  selectedModel: string;
  userName: string;
}

const VALID_SCREENS: readonly AxonScreen[] = [
  'chat',
  'axon-source',
  'interface-capture',
  'axon-tools',
  'axon-build',
  'background-proof',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (value.role !== 'user' && value.role !== 'assistant') return false;
  if (typeof value.content !== 'string') return false;
  if (typeof value.timestamp !== 'number') return false;
  return true;
}

function isRecentChat(value: unknown): value is RecentChat {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.title !== 'string') return false;
  if (typeof value.timestamp !== 'string') return false;
  if (!Array.isArray(value.messages) || !value.messages.every(isChatMessage)) {
    return false;
  }
  return true;
}

/**
 * Validate a parsed value against the v1 schema.
 * Returns a typed payload or null if anything is wrong.
 * Does not throw.
 */
export function validatePersistedPayload(
  raw: unknown
): PersistedGlobalPayload | null {
  if (!isPlainObject(raw)) return null;
  if (raw.schemaVersion !== STORAGE_SCHEMA_VERSION) return null;
  if (
    typeof raw.currentScreen !== 'string' ||
    !VALID_SCREENS.includes(raw.currentScreen as AxonScreen)
  ) {
    return null;
  }
  if (raw.activeChatId !== null && typeof raw.activeChatId !== 'string') {
    return null;
  }
  if (!Array.isArray(raw.recents) || !raw.recents.every(isRecentChat)) {
    return null;
  }
  if (!Array.isArray(raw.messages) || !raw.messages.every(isChatMessage)) {
    return null;
  }
  if (typeof raw.selectedModel !== 'string') return null;
  if (typeof raw.userName !== 'string') return null;

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    currentScreen: raw.currentScreen as AxonScreen,
    activeChatId: raw.activeChatId as string | null,
    recents: raw.recents as RecentChat[],
    messages: raw.messages as ChatMessage[],
    selectedModel: raw.selectedModel,
    userName: raw.userName,
  };
}

/**
 * Load GLOBAL state from localStorage.
 * - Missing key → null (first run / no data).
 * - Parse or shape failure → null + console.warn; storage is left intact.
 * - Never throws.
 */
export function loadPersistedGlobal(): GlobalState | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(
        '[AXON storage] Persisted data failed to parse (JSON). Using defaults for this session; stored value left intact.'
      );
      return null;
    }
    const valid = validatePersistedPayload(parsed);
    if (!valid) {
      console.warn(
        '[AXON storage] Persisted data failed schema validation (v' +
          STORAGE_SCHEMA_VERSION +
          '). Using defaults for this session; stored value left intact.'
      );
      return null;
    }
    return {
      currentScreen: valid.currentScreen,
      activeChatId: valid.activeChatId,
      recents: valid.recents,
      messages: valid.messages,
      selectedModel: valid.selectedModel,
      userName: valid.userName,
    };
  } catch (err) {
    console.warn(
      '[AXON storage] Unexpected error while reading persisted state. Using defaults for this session.',
      err
    );
    return null;
  }
}

/**
 * Write GLOBAL state to localStorage.
 * - Never includes isTokensModalOpen or other UI-local fields.
 * - On failure (quota, security, etc.): log warning, do not throw.
 */
export function savePersistedGlobal(global: GlobalState): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const payload: PersistedGlobalPayload = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      currentScreen: global.currentScreen,
      activeChatId: global.activeChatId,
      recents: global.recents,
      messages: global.messages,
      selectedModel: global.selectedModel,
      userName: global.userName,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn(
      '[AXON storage] Failed to persist GLOBAL state (quota or access). App continues without blocking.',
      err
    );
  }
}

/** Extract GLOBAL slice from full AxonState (or any GlobalState). */
export function pickGlobal(state: GlobalState): GlobalState {
  return {
    currentScreen: state.currentScreen,
    activeChatId: state.activeChatId,
    recents: state.recents,
    messages: state.messages,
    selectedModel: state.selectedModel,
    userName: state.userName,
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON state root — Stage 1A shape + Stage 1B persistence capability
 *
 * Formal representation of the GLOBAL state category plus the single
 * proof UI-local item (isTokensModalOpen).
 *
 * Stage 1B: GLOBAL fields may be hydrated from / written to localStorage
 * via the storage layer (see storage.ts). isTokensModalOpen is never
 * persisted. Capability-local and remaining UI-local state stay outside
 * this root until later stages. Consumer migration of GLOBAL fields off
 * App local useState is Stage 1C — not this file's concern.
 */

import type { ChatMessage, RecentChat } from '../types';

/** Screen identity used by the top-level router in App. */
export type AxonScreen =
  | 'chat'
  | 'axon-source'
  | 'interface-capture'
  | 'axon-tools'
  | 'axon-build'
  | 'background-proof';

/**
 * GLOBAL ownership category (Stage 0 classification).
 * These fields are owned by the state root; only actions may mutate them.
 * In Stage 1A they are declared here but not yet fully driven from the
 * root for every field — only isTokensModalOpen is live-wired as proof.
 */
export interface GlobalState {
  currentScreen: AxonScreen;
  activeChatId: string | null;
  recents: RecentChat[];
  messages: ChatMessage[];
  selectedModel: string;
  userName: string;
}

/**
 * Full state shape held by the root.
 * isTokensModalOpen is the Stage 1A proof migration (UI-local-adjacent).
 */
export interface AxonState extends GlobalState {
  isTokensModalOpen: boolean;
}

export const initialAxonState: AxonState = {
  currentScreen: 'chat',
  activeChatId: null,
  recents: [],
  messages: [],
  selectedModel: 'Sonnet 5 Thinking',
  userName: 'Luidel',
  isTokensModalOpen: false,
};

/** Explicit actions. Only SET_TOKENS_MODAL_OPEN is used live in Stage 1A. */
export type AxonAction =
  | { type: 'SET_TOKENS_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_CURRENT_SCREEN'; payload: AxonScreen }
  | { type: 'SET_ACTIVE_CHAT_ID'; payload: string | null }
  | { type: 'SET_RECENTS'; payload: RecentChat[] }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_SELECTED_MODEL'; payload: string }
  | { type: 'SET_USER_NAME'; payload: string }
  /** First message of a brand-new chat: creates it, makes it active, shows its messages. */
  | { type: 'START_CHAT'; payload: { recent: RecentChat } }
  /** Opens an existing chat: sets the active id and the live messages together. */
  | { type: 'OPEN_CHAT'; payload: { chatId: string; messages: ChatMessage[] } }
  /** Leaves the current chat (new empty chat). */
  | { type: 'CLEAR_CHAT' }
  /**
   * Adds one message to a specific chat. The chat's saved copy is always updated;
   * the live messages change only when that chat is the one being shown. A reply
   * that arrives after the user switched chats therefore lands in the right chat.
   */
  | { type: 'APPEND_TO_CHAT'; payload: { chatId: string; message: ChatMessage } };

export function axonReducer(state: AxonState, action: AxonAction): AxonState {
  switch (action.type) {
    case 'SET_TOKENS_MODAL_OPEN':
      return { ...state, isTokensModalOpen: action.payload };
    case 'SET_CURRENT_SCREEN':
      return { ...state, currentScreen: action.payload };
    case 'SET_ACTIVE_CHAT_ID':
      return { ...state, activeChatId: action.payload };
    case 'SET_RECENTS':
      return { ...state, recents: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_SELECTED_MODEL':
      return { ...state, selectedModel: action.payload };
    case 'SET_USER_NAME':
      return { ...state, userName: action.payload };
    case 'START_CHAT':
      return {
        ...state,
        activeChatId: action.payload.recent.id,
        messages: action.payload.recent.messages,
        recents: [action.payload.recent, ...state.recents],
      };
    case 'OPEN_CHAT':
      return {
        ...state,
        activeChatId: action.payload.chatId,
        messages: action.payload.messages,
      };
    case 'CLEAR_CHAT':
      return { ...state, activeChatId: null, messages: [] };
    case 'APPEND_TO_CHAT': {
      const { chatId, message } = action.payload;
      const isShown = state.activeChatId === chatId;
      const saved = state.recents.find((r) => r.id === chatId);
      if (!saved) {
        // Unknown chat: only the live view can take it, and only if it is the one shown.
        return isShown ? { ...state, messages: [...state.messages, message] } : state;
      }
      const next = [...(isShown ? state.messages : saved.messages), message];
      return {
        ...state,
        messages: isShown ? next : state.messages,
        recents: state.recents.map((r) => (r.id === chatId ? { ...r, messages: next } : r)),
      };
    }
    default:
      return state;
  }
}

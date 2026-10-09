/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * React Context + reducer state root for AXON (Stage 1A + 1B).
 *
 * Stage 1A: Context + useReducer, proof-wired isTokensModalOpen.
 * Stage 1B: Hydrate GLOBAL fields from localStorage on init; debounce-
 * write GLOBAL fields only. isTokensModalOpen is never persisted.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
  type Dispatch,
} from 'react';
import {
  axonReducer,
  initialAxonState,
  type AxonState,
  type AxonAction,
  type AxonScreen,
} from './axonState';
import type { ChatMessage, RecentChat } from '../types';
import {
  loadPersistedGlobal,
  savePersistedGlobal,
  pickGlobal,
  PERSIST_DEBOUNCE_MS,
} from './storage';

const AxonStateContext = createContext<AxonState | null>(null);
const AxonDispatchContext = createContext<Dispatch<AxonAction> | null>(null);


/** Reference conversation used when a recent has empty messages (matches App Stage 0 seed). */
export const INITIAL_REFERENCE_MESSAGES: ChatMessage[] = [
  {
    id: 'user-ref-1',
    role: 'user',
    content:
      'Can you help me build a simple Android app using Kotlin? I want it to have a login screen and a home screen. Keep it beginner-friendly but with clean code.',
    timestamp: 1711200000000,
  },
  {
    id: 'axon-ref-1',
    role: 'assistant',
    content:
      "Absolutely, I can help you build a simple Android app with Kotlin. I'll show you a clean, beginner-friendly structure with a login screen and a home screen. The app will use modern Android practices, and I'll keep the code easy to follow and well-organized.\n\nBefore I provide the full code, let me outline the plan so you know what to expect:\n\n1. Set up a new Android project with Kotlin.\n2. Create a login screen with basic validation.\n3. Build a home screen that appears after login.\n4. Use ViewBinding or Jetpack Compose (depending on your preference).\n5. Keep the code structured, clean, and easy to modify.",
    leadParagraph:
      "Absolutely, I can help you build a simple Android app with Kotlin. I'll show you a clean, beginner-friendly structure with a login screen and a home screen. The app will use modern Android practices, and I'll keep the code easy to follow and well-organized.",
    planIntro: 'Before I provide the full code, let me outline the plan so you know what to expect:',
    planItems: [
      'Set up a new Android project with Kotlin.',
      'Create a login screen with basic validation.',
      'Build a home screen that appears after login.',
      'Use ViewBinding or Jetpack Compose (depending on your preference).',
      'Keep the code structured, clean, and easy to modify.',
    ],
    hasSources: false,
    suggestionPrompt: 'Would you like the full project structure next, or shall we start with the login screen?',
    timestamp: 1711200001000,
  },
];

/** Seed recents matching Image 3 — used on first run only (no persisted data). */
export const INITIAL_RECENTS: RecentChat[] = [
  {
    id: 'chat-layout',
    title: 'Describe Axon UI Layout',
    timestamp: 'Just now',
    messages: INITIAL_REFERENCE_MESSAGES,
  },
  {
    id: 'chat-resize',
    title: 'Resize chat input',
    timestamp: '2 hours ago',
    messages: [
      {
        id: 'msg-resize-1',
        role: 'user',
        content: 'How should the chat input bubble resize on mobile viewports?',
        timestamp: Date.now() - 7200000,
      },
      {
        id: 'msg-resize-2',
        role: 'assistant',
        content:
          "I'm here, but AXON's intelligence layer isn't online yet. The composer geometry is designed to remain anchored at 720px max-width with stable 26px rounded corners.",
        timestamp: Date.now() - 7190000,
      },
    ],
  },
  {
    id: 'chat-youtube',
    title: 'Recommend YouTube Channel',
    timestamp: 'Yesterday',
    messages: [],
  },
  {
    id: 'chat-termux',
    title: 'Offline Termux Voice Tools',
    timestamp: '2 days ago',
    messages: [],
  },
  {
    id: 'chat-showcase',
    title: 'Create AXON UI Showcase',
    timestamp: '3 days ago',
    messages: [],
  },
];

/**
 * Build initial reducer state: merge persisted GLOBAL (if valid) onto
 * defaults. isTokensModalOpen always starts false (ephemeral).
 * First run (no data) → seed recents matching pre-migration App defaults.
 */
function createInitialState(): AxonState {
  const persisted = loadPersistedGlobal();
  if (!persisted) {
    return {
      ...initialAxonState,
      recents: INITIAL_RECENTS,
      messages: [],
      activeChatId: null,
    };
  }
  return {
    ...initialAxonState,
    ...persisted,
    isTokensModalOpen: false,
  };
}


export function AxonStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(axonReducer, undefined, createInitialState);

  // Debounced persistence of GLOBAL fields only
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    // Skip the initial hydration write (already on disk or defaults)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      savePersistedGlobal(pickGlobal(state));
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [
    state.currentScreen,
    state.activeChatId,
    state.recents,
    state.messages,
    state.selectedModel,
    state.userName,
  ]);

  return (
    <AxonStateContext.Provider value={state}>
      <AxonDispatchContext.Provider value={dispatch}>
        {children}
      </AxonDispatchContext.Provider>
    </AxonStateContext.Provider>
  );
}

export function useAxonState(): AxonState {
  const ctx = useContext(AxonStateContext);
  if (ctx === null) {
    throw new Error('useAxonState must be used within AxonStateProvider');
  }
  return ctx;
}

export function useAxonDispatch(): Dispatch<AxonAction> {
  const ctx = useContext(AxonDispatchContext);
  if (ctx === null) {
    throw new Error('useAxonDispatch must be used within AxonStateProvider');
  }
  return ctx;
}

/** Convenience: open / close the Design Tokens modal via the state root. */
export function useTokensModal() {
  const { isTokensModalOpen } = useAxonState();
  const dispatch = useAxonDispatch();
  return {
    isTokensModalOpen,
    openTokensModal: () =>
      dispatch({ type: 'SET_TOKENS_MODAL_OPEN', payload: true }),
    closeTokensModal: () =>
      dispatch({ type: 'SET_TOKENS_MODAL_OPEN', payload: false }),
  };
}

/** Stage 1C-i: currentScreen read/write exclusively via the state root. */
export function useCurrentScreen() {
  const { currentScreen } = useAxonState();
  const dispatch = useAxonDispatch();
  return {
    currentScreen,
    setCurrentScreen: (screen: AxonScreen) =>
      dispatch({ type: 'SET_CURRENT_SCREEN', payload: screen }),
  };
}

/** Stage 1C-ii: coupled chat-session (activeChatId + recents + messages). */
export function useChatSession() {
  const { activeChatId, recents, messages } = useAxonState();
  const dispatch = useAxonDispatch();
  // The chat the current turn belongs to, so a reply always lands in the chat it answers.
  const turnChatIdRef = useRef<string | null>(null);

  const selectRecent = (chatId: string) => {
    const found = recents.find((r) => r.id === chatId);
    if (!found) return;
    dispatch({
      type: 'OPEN_CHAT',
      payload: {
        chatId: found.id,
        messages:
          found.messages.length > 0 ? found.messages : INITIAL_REFERENCE_MESSAGES,
      },
    });
  };

  /** Clears active session only (composer clear stays UI-local in App). */
  const newChat = () => {
    dispatch({ type: 'CLEAR_CHAT' });
  };

  /**
   * Append a user message. If no active chat, creates one and prepends to recents
   * (exact prior App behavior). Returns the messages array after the user append
   * so callers can continue the assistant turn.
   */
  const appendUserMessage = (text: string): ChatMessage[] => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };
    const nextMessages = [...messages, userMsg];

    if (activeChatId) {
      turnChatIdRef.current = activeChatId;
      dispatch({
        type: 'APPEND_TO_CHAT',
        payload: { chatId: activeChatId, message: userMsg },
      });
    } else {
      const newChatId = `chat-${Date.now()}`;
      turnChatIdRef.current = newChatId;
      const title =
        text.trim().slice(0, 28) + (text.trim().length > 28 ? '...' : '');
      const newRecent: RecentChat = {
        id: newChatId,
        title,
        timestamp: 'Just now',
        messages: nextMessages,
      };
      dispatch({ type: 'START_CHAT', payload: { recent: newRecent } });
    }

    return nextMessages;
  };

  /**
   * Append an assistant message to the chat the current turn belongs to, even if
   * the user has switched to another chat in the meantime. `after` is only used
   * as a fallback when no turn is known.
   */
  const appendAssistantMessage = (msg: ChatMessage, after?: ChatMessage[]) => {
    const chatId = turnChatIdRef.current;
    if (chatId) {
      dispatch({ type: 'APPEND_TO_CHAT', payload: { chatId, message: msg } });
      return;
    }
    const base = after ?? messages;
    dispatch({ type: 'SET_MESSAGES', payload: [...base, msg] });
  };

  const setActiveChatId = (id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_CHAT_ID', payload: id });
  };

  const setMessages = (msgs: ChatMessage[]) => {
    dispatch({ type: 'SET_MESSAGES', payload: msgs });
  };

  return {
    activeChatId,
    recents,
    messages,
    selectRecent,
    newChat,
    appendUserMessage,
    appendAssistantMessage,
    setActiveChatId,
    setMessages,
  };
}

/** Stage 1C-iii: selectedModel read/write exclusively via the state root. */
export function useSelectedModel() {
  const { selectedModel } = useAxonState();
  const dispatch = useAxonDispatch();
  return {
    selectedModel,
    setSelectedModel: (model: string) =>
      dispatch({ type: 'SET_SELECTED_MODEL', payload: model }),
  };
}

/** Stage 1C-iv: userName read/write exclusively via the state root. */
export function useUserName() {
  const { userName } = useAxonState();
  const dispatch = useAxonDispatch();
  return {
    userName,
    setUserName: (name: string) =>
      dispatch({ type: 'SET_USER_NAME', payload: name }),
  };
}

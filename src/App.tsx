/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Composer } from './components/Composer';
import { NavigationDrawer } from './components/NavigationDrawer';
import { WelcomeState } from './components/WelcomeState';
import { ActiveConversation } from './components/ActiveConversation';
import { DesignTokensModal } from './components/DesignTokensModal';
import { SettingsModal } from './components/SettingsModal';
import { AxonSourceScreen } from './components/AxonSourceScreen';
import { InterfaceCaptureScreen } from './components/InterfaceCaptureScreen';
import { AxonToolsScreen } from './components/AxonToolsScreen';
import { AxonBuildScreen } from './components/AxonBuildScreen';
import { BackgroundProofScreen } from './components/BackgroundProofScreen';
import { ScreenGuard } from './components/ScreenGuard';
import { sendQueryToAxonBoundary } from './services/axonBrainInterface';
import { AxonMode } from './types';
import { AxonStateProvider, useTokensModal, useCurrentScreen, useChatSession, INITIAL_REFERENCE_MESSAGES } from './state/AxonStateContext';

function AppInner() {
  // Stage 1A: tokens modal open/close lives in the state root (proof migration)
  const { openTokensModal } = useTokensModal();
  // Stage 1C-i: currentScreen lives exclusively in the state root
  const { currentScreen, setCurrentScreen } = useCurrentScreen();
  // Stage 1C-ii: chat session (activeChatId + recents + messages) via state root
  const {
    activeChatId,
    messages,
    newChat,
    appendUserMessage,
    appendAssistantMessage,
    setActiveChatId,
    setMessages,
  } = useChatSession();

  // Navigation & Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Composer & controls state
  const [composerInput, setComposerInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  // Which of the three AXON places is showing: Chat, Web or Apps
  const [mode, setMode] = useState<AxonMode>('chat');

  // Modals (isTokensModalOpen migrated to state root in Stage 1A)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (activeChatId && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, activeChatId]);

  // Stage 1C-iii regression fix: clear composer when starting a new chat
  // (activeChatId transitions to null). Matches pre-1C-ii App handleNewChat.
  const prevActiveChatIdRef = useRef<string | null>(activeChatId);
  useEffect(() => {
    if (prevActiveChatIdRef.current !== null && activeChatId === null) {
      setComposerInput('');
    }
    prevActiveChatIdRef.current = activeChatId;
  }, [activeChatId]);


  // Switch to reference state directly (from inspector modal)
  const handleSelectView = (view: 'welcome' | 'conversation' | 'drawer') => {
    setCurrentScreen('chat');
    if (view === 'welcome') {
      newChat();
      setComposerInput('');
      setIsDrawerOpen(false);
    } else if (view === 'conversation') {
      setActiveChatId('chat-layout');
      setMessages(INITIAL_REFERENCE_MESSAGES);
      setIsDrawerOpen(false);
    } else if (view === 'drawer') {
      setIsDrawerOpen(true);
    }
  };

  // Logo toggle logic per Spec (v3.3):
  // - Menu closed + tap logo → menu opens
  // - Menu open + tap logo → menu closes (stays on whatever screen the user was on — no navigation)
  const handleNonChatLogoClick = () => {
    setIsDrawerOpen((prev) => !prev);
  };

  // Tapping the logo mark inside the open NavigationDrawer:
  const handleDrawerLogoClick = () => {
    // Menu is open + tap logo → menu closes (stays on whatever screen the user was on)
    setIsDrawerOpen(false);
  };

  // Handle sending a message (session mutations via state root)
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;

    const nextAfterUser = appendUserMessage(text);

    setIsSending(true);

    try {
      // Dispatches to the strictly segregated AXON brain interface
      const axonResponse = await sendQueryToAxonBoundary(text);
      appendAssistantMessage(axonResponse, nextAfterUser);
    } catch {
      // Graceful fallback without exposing raw errors
      appendAssistantMessage(
        {
          id: `axon-${Date.now()}`,
          role: 'assistant',
          content:
            "I'm here, but AXON's intelligence layer isn't online yet. We're building the environment first.",
          timestamp: Date.now(),
        },
        nextAfterUser
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative w-full h-dvh bg-[#121315] text-[#ECECEC] font-sans antialiased overflow-hidden flex flex-col">
      <ScreenGuard onOpenMenu={handleNonChatLogoClick}>
      {currentScreen === 'axon-source' ? (
        <AxonSourceScreen
          onLogoClick={handleNonChatLogoClick}
        />
      ) : currentScreen === 'axon-tools' ? (
        <AxonToolsScreen
          onLogoClick={handleNonChatLogoClick}
        />
      ) : currentScreen === 'axon-build' ? (
        <AxonBuildScreen onLogoClick={handleNonChatLogoClick} />
      ) : currentScreen === 'interface-capture' ? (
        <InterfaceCaptureScreen onLogoClick={handleNonChatLogoClick} />
      ) : currentScreen === 'background-proof' ? (
        <BackgroundProofScreen onLogoClick={handleNonChatLogoClick} />
      ) : (
        <>
          {/* 1. ANCHORED PERSISTENT TOP BAR */}
          <TopBar
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onOpenInfo={openTokensModal}
          />

          {/* 2. INDEPENDENT SCROLLING VIEWPORT AREA */}
          <main
            ref={scrollContainerRef}
            className={`flex-1 w-full overflow-y-auto overflow-x-hidden ${
              activeChatId ? 'pt-16 pb-36 flex flex-col justify-between' : 'flex flex-col'
            }`}
          >
            {mode !== 'chat' ? (
              // Web and Apps are not built yet: say so honestly
              <div className="flex-1 flex items-center justify-center px-8 text-center text-sm text-[#8E9094]">
                {mode === 'web'
                  ? "Web is coming soon. AXON's own browser will live here."
                  : "Apps is coming soon. Your phone's apps will open here with AXON on top."}
              </div>
            ) : activeChatId ? (
              // Active Conversation State (Image 2)
              <ActiveConversation
                onSelectSuggestion={(prompt) => handleSendMessage(prompt)}
              />
            ) : (
              // Welcome / New Chat State (Image 1)
              <WelcomeState />
            )}
          </main>

          {/* 3. ANCHORED PERSISTENT BOTTOM COMPOSER */}
          <Composer
            input={composerInput}
            setInput={setComposerInput}
            onSend={handleSendMessage}
            onToggleCompactMode={openTokensModal}
            mode={mode}
            onModeChange={setMode}
            disabled={isSending || mode !== 'chat'}
          />
        </>
      )}
      </ScreenGuard>

      {/* 4. NAVIGATION DRAWER OVERLAY (Image 3) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLogoClick={handleDrawerLogoClick}
      />

      {/* 5. DESIGN TOKENS & ARCHITECTURE MODAL (open/close via state root) */}
      <DesignTokensModal
        onSelectView={handleSelectView}
        onLogoClick={handleNonChatLogoClick}
      />

      {/* 6. SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onLogoClick={handleNonChatLogoClick}
      />
    </div>
  );
}

/** Stage 1A: state root provider wraps the app shell. */
export default function App() {
  return (
    <AxonStateProvider>
      <AppInner />
    </AxonStateProvider>
  );
}

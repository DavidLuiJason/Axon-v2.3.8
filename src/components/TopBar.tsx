/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, MoreVertical, Plus, RotateCcw, Share2, Info, Sparkles, Layers } from 'lucide-react';
import { AXON_TOKENS } from '../tokens/designTokens';
import { useCurrentScreen, useChatSession } from '../state/AxonStateContext';

interface TopBarProps {
  onOpenDrawer: () => void;
  onOpenInfo: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenDrawer,
  onOpenInfo,
}) => {
  // Stage 1C-i: screen navigation via state root (not prop-drilled)
  const { setCurrentScreen } = useCurrentScreen();
  // Stage 1C-ii: chat session via state root
  const { activeChatId, newChat } = useChatSession();
  const hasActiveChat = Boolean(activeChatId);
  const [isAxonMenuOpen, setIsAxonMenuOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const axonMenuRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (axonMenuRef.current && !axonMenuRef.current.contains(e.target as Node)) {
        setIsAxonMenuOpen(false);
      }
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-[#121315]/90 backdrop-blur-md transition-colors select-none">
      {/* Left zone: Menu button & AXON selector pill */}
      <div className="flex items-center gap-3">
        {/* Menu/Drawer button */}
        <button
          onClick={onOpenDrawer}
          aria-label="Open navigation drawer"
          className="w-10 h-10 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-[#D0D2D7] hover:text-white flex items-center justify-center transition-all active:scale-95 focus-visible:ring-1 focus-visible:ring-white/20"
        >
          <Menu size={20} strokeWidth={2} />
        </button>

        {/* Anchored AXON Brand Selector Pill */}
        <div className="relative" ref={axonMenuRef}>
          <button
            onClick={() => setIsAxonMenuOpen(!isAxonMenuOpen)}
            aria-expanded={isAxonMenuOpen}
            aria-label="AXON options"
            className="h-9 px-3.5 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white flex items-center gap-1.5 transition-all active:scale-95 border border-white/5 shadow-sm"
          >
            <span className="font-serif font-bold tracking-wider text-sm">AXON</span>
            <ChevronDown size={14} className={`text-[#9A9B9F] transition-transform duration-200 ${isAxonMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* AXON selector dropdown */}
          {isAxonMenuOpen && (
            <div className="absolute top-11 left-0 w-52 py-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs">
              <button
                onClick={() => {
                  newChat();
                  setCurrentScreen('chat');
                  setIsAxonMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
              >
                <Plus size={15} className="text-[#E85A3C]" />
                <span>Start New Chat</span>
              </button>
              <button
                onClick={() => {
                  newChat();
                  setCurrentScreen('chat');
                  setIsAxonMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
              >
                <RotateCcw size={15} className="text-[#9A9B9F]" />
                <span>Welcome Screen</span>
              </button>
              <div className="my-1 border-t border-white/5" />
              <div className="px-3.5 py-2 text-[11px] text-[#7A7C82]">
                <div className="font-semibold text-white/90">AXON Foundation</div>
                <div>Intelligence in Motion</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right zone: Anchored Three-dot overflow button */}
      <div className="relative" ref={overflowRef}>
        <button
          onClick={() => setIsOverflowOpen(!isOverflowOpen)}
          aria-expanded={isOverflowOpen}
          aria-label="More conversation options"
          className="w-10 h-10 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-[#D0D2D7] hover:text-white flex items-center justify-center transition-all active:scale-95 focus-visible:ring-1 focus-visible:ring-white/20"
        >
          <MoreVertical size={20} strokeWidth={2} />
        </button>

        {/* Overflow Menu */}
        {isOverflowOpen && (
          <div className="absolute top-11 right-0 w-56 py-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs">
            <button
              onClick={() => {
                setCurrentScreen('interface-capture');
                setIsOverflowOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
            >
              <Layers size={15} className="text-[#E85A3C]" />
              <span>Interface Capture</span>
            </button>
            <button
              onClick={() => {
                onOpenInfo();
                setIsOverflowOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
            >
              <Info size={15} className="text-[#9A9B9F]" />
              <span>Design System Tokens</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                setIsOverflowOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
            >
              <Share2 size={15} className="text-[#9A9B9F]" />
              <span>Share Space</span>
            </button>
            {hasActiveChat && (
              <button
                onClick={() => {
                  newChat();
                  setCurrentScreen('chat');
                  setIsOverflowOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
              >
                <Sparkles size={15} className="text-[#9A9B9F]" />
                <span>Return to Welcome State</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

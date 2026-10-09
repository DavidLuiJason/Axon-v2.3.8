/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Library, 
  FolderGit2, 
  Sparkles, 
  Wrench, 
  Search, 
  MessageSquare, 
  Settings, 
  X,
  Compass,
  FileText
} from 'lucide-react';
import AxonLogo from './AxonLogo.jsx';
import { useCurrentScreen, useChatSession } from '../state/AxonStateContext';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onLogoClick?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onLogoClick,
}) => {
  // Stage 1C-i: screen navigation via state root (not prop-drilled)
  const { setCurrentScreen } = useCurrentScreen();
  // Stage 1C-ii: chat session via state root
  const { recents, activeChatId, selectRecent, newChat } = useChatSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);

  if (!isOpen) return null;

  const filteredRecents = searchQuery.trim()
    ? recents.filter((r) => r.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : recents;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Dimmed backdrop scrim overlay */}
      <div
        onClick={onClose}
        aria-label="Close navigation"
        className="fixed inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
      />

      {/* Main Drawer Overlay Body */}
      <aside
        className="relative z-50 w-[300px] sm:w-[320px] h-full bg-[#141517] border-r border-white/5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-200 select-none overflow-hidden"
      >
        {/* Top & Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-3">
          {/* Header: Logo, Brand lockup, and Search trigger */}
          <div className="flex items-center justify-between pb-5 border-b border-white/5 mb-3">
            <button
              onClick={() => {
                if (onLogoClick) {
                  onLogoClick();
                } else {
                  onClose();
                }
              }}
              aria-label="AXON Navigation"
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              <AxonLogo className="w-[34px] h-[34px] shrink-0 group-hover:opacity-90 transition-opacity" />
              <div className="flex flex-col">
                <span className="font-serif text-[22px] font-semibold tracking-wide text-white leading-tight">
                  AXON
                </span>
                <span className="text-[10.5px] text-[#9A9B9F] tracking-wider font-sans uppercase">
                  Intelligence in Motion
                </span>
              </div>
            </button>

            {/* Search Icon Trigger */}
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              aria-label="Search AXON"
              className="w-9 h-9 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-[#C4C6CA] hover:text-white flex items-center justify-center transition-colors"
            >
              <Search size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Search bar when toggled */}
          {showSearchInput && (
            <div className="mb-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1F2023] border border-white/10 text-xs text-white">
                <Search size={14} className="text-[#8E9094]" />
                <input
                  type="text"
                  placeholder="Filter recents & spaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent outline-none text-xs text-white placeholder-[#707277]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-[#8E9094] hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Primary Navigation Destinations (Image 3) */}
          <nav className="space-y-1 mb-5">
            {/* Library */}
            <button
              onClick={onClose}
              className="w-full h-11 px-3 rounded-xl flex items-center gap-3.5 text-[#E0E2E6] hover:bg-white/5 transition-colors text-[14.5px]"
            >
              {/* Stacked books icon */}
              <div className="w-5 h-5 flex items-center justify-center text-[#D0D2D6]">
                <Library size={19} strokeWidth={1.8} />
              </div>
              <span>Library</span>
            </button>

            {/* Projects */}
            <button
              onClick={onClose}
              className="w-full h-11 px-3 rounded-xl flex items-center gap-3.5 text-[#E0E2E6] hover:bg-white/5 transition-colors text-[14.5px]"
            >
              <div className="w-5 h-5 flex items-center justify-center text-[#D0D2D6]">
                <FolderGit2 size={19} strokeWidth={1.8} />
              </div>
              <span>Projects</span>
            </button>

            {/* Axon Source */}
            <button
              onClick={() => {
                onClose();
                setCurrentScreen('axon-source');
              }}
              className="w-full h-11 px-3 rounded-xl flex items-center gap-3.5 text-[#E0E2E6] hover:bg-white/5 transition-colors text-[14.5px]"
            >
              <div className="w-5 h-5 flex items-center justify-center text-[#E85A3C]">
                {/* Neural swirl / aperture source icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  <circle cx="12" cy="12" r="3.5" />
                </svg>
              </div>
              <span>Axon Source</span>
            </button>

            {/* Tools */}
            <button
              onClick={() => {
                onClose();
                setCurrentScreen('axon-tools');
              }}
              className="w-full h-11 px-3 rounded-xl flex items-center gap-3.5 text-[#E0E2E6] hover:bg-white/5 transition-colors text-[14.5px]"
            >
              <div className="w-5 h-5 flex items-center justify-center text-[#D0D2D6]">
                <Wrench size={19} strokeWidth={1.8} />
              </div>
              <span>Tools</span>
            </button>
          </nav>

          {/* Section Divider: Recents */}
          <div className="pt-2 pb-1.5 px-3">
            <span className="text-[12px] font-medium text-[#7A7C82] tracking-wider">
              Recents
            </span>
          </div>

          {/* Recents Conversation List */}
          <div className="space-y-1">
            {filteredRecents.map((item) => {
              const isSelected = activeChatId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    selectRecent(item.id);
                    setCurrentScreen('chat');
                    onClose();
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all text-[14px] leading-snug truncate block ${
                    isSelected
                      ? 'bg-[#232427] text-white font-normal'
                      : 'text-[#D0D2D7] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate block font-serif tracking-normal">
                    {item.title}
                  </span>
                </button>
              );
            })}

            {filteredRecents.length === 0 && (
              <div className="px-3 py-4 text-xs text-[#707277] italic">
                No conversations match &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>

        {/* Bottom Docked Section: Chat trigger & Settings */}
        <div className="p-4 border-t border-white/5 bg-[#121315]/80 flex items-center justify-between">
          {/* Chat Pill Button */}
          <button
            onClick={() => {
              newChat();
              setCurrentScreen('chat');
              onClose();
            }}
            className="h-10 px-4 rounded-full bg-[#25262A] hover:bg-[#2F3035] text-white flex items-center gap-2.5 text-sm font-medium transition-all active:scale-95 border border-white/5"
          >
            <MessageSquare size={17} className="text-[#E85A3C]" />
            <span>Chat</span>
          </button>

          {/* Settings Gear Button */}
          <button
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            aria-label="Open AXON settings"
            className="w-10 h-10 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-[#C4C6CA] hover:text-white flex items-center justify-center transition-all active:scale-95"
          >
            <Settings size={18} strokeWidth={2} />
          </button>
        </div>
      </aside>
    </div>
  );
};

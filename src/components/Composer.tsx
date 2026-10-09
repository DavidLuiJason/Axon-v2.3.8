/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Mic, ArrowUp, Layers, Image as ImageIcon, Code2, Globe, Paperclip } from 'lucide-react';
import { AxonMode } from '../types';

interface ComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (text: string) => void;
  onToggleCompactMode: () => void;
  mode: AxonMode;
  onModeChange: (mode: AxonMode) => void;
  disabled?: boolean;
}

const AXON_MODES: { id: AxonMode; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'web', label: 'Web' },
  { id: 'apps', label: 'Apps' },
];

const MODE_PLACEHOLDERS: Record<AxonMode, string> = {
  chat: 'Message AXON...',
  web: 'Web is not available yet',
  apps: 'Apps is not available yet',
};

export const Composer: React.FC<ComposerProps> = ({
  input,
  setInput,
  onSend,
  onToggleCompactMode,
  mode,
  onModeChange,
  disabled = false,
}) => {
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const hasText = input.trim().length > 0;

  // Auto-resize textarea smoothly without altering container geometry
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${Math.max(newHeight, 26)}px`;
    }
  }, [input]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setIsAttachmentOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasText || disabled) return;
    const textToSend = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '26px';
    }
    onSend(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceClick = () => {
    // UI foundation notice: Truthful notice that AXON voice intelligence connects with future brain
    setVoiceNotice('Spoken audio engine is staged. The AXON voice pipeline connects in Phase 2.');
    setTimeout(() => {
      setVoiceNotice(null);
    }, 3200);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none pb-4 px-4 sm:px-6">
      <div className="max-w-[720px] mx-auto w-full flex flex-col items-end pointer-events-auto">
        {/* Persistent Indicator Pill Above Composer */}
        <div className="flex items-center justify-end w-full mb-2 pr-1">
          <button
            onClick={onToggleCompactMode}
            title="Toggle Pane View"
            aria-label="Toggle pane layout"
            className="group flex items-center justify-center w-7 h-5 rounded-[5px] bg-[#232428] hover:bg-[#2C2D32] border border-white/10 transition-colors shadow-sm focus-visible:ring-1 focus-visible:ring-white/30"
          >
            {/* Split pane / sidebar toggle glyph matching reference images */}
            <div className="w-3.5 h-2.5 rounded-[2px] border border-[#A0A2A7] group-hover:border-white flex overflow-hidden">
              <div className="h-full transition-all w-1.5 bg-[#A0A2A7] group-hover:bg-white" />
              <div className="flex-1 h-full bg-transparent" />
            </div>
          </button>
        </div>

        {/* Voice status toast */}
        {voiceNotice && (
          <div className="w-full mb-2 px-4 py-2 rounded-xl bg-[#232428]/95 border border-[#E85A3C]/30 text-xs text-[#D8DADC] shadow-xl backdrop-blur-md flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E85A3C] animate-pulse" />
              {voiceNotice}
            </span>
            <button
              onClick={() => setVoiceNotice(null)}
              className="text-[#9A9B9F] hover:text-white ml-2 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Persistent Anchored Composer Bubble */}
        <div className="w-full bg-[#1E1F22] rounded-[26px] p-3 border border-white/[0.05] shadow-[0_8px_30px_rgb(0,0,0,0.4)] backdrop-blur-xl transition-all">
          {/* Top Row: Input Field */}
          <div className="px-1.5 pt-0.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={MODE_PLACEHOLDERS[mode]}
              disabled={mode !== 'chat'}
              aria-label="Message AXON"
              className="w-full bg-transparent text-[#ECECEC] placeholder-[#8E9094] text-[15px] font-normal leading-relaxed outline-none resize-none overflow-y-auto max-h-[120px]"
            />
          </div>

          {/* Bottom Row: Persistent Controls */}
          <div className="flex items-center justify-between pt-2">
            {/* Left Controls: Plus Button & Chat / Web / Apps switch */}
            <div className="flex items-center gap-2">
              {/* Plus Button */}
              <div className="relative" ref={attachMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
                  aria-label="Add attachment or action"
                  className="w-9 h-9 rounded-full bg-[#2C2D30] hover:bg-[#36373B] text-[#D0D2D6] hover:text-white flex items-center justify-center transition-all active:scale-95"
                >
                  <Plus size={18} strokeWidth={2.2} />
                </button>

                {/* Attachment popover */}
                {isAttachmentOpen && (
                  <div className="absolute bottom-11 left-0 w-48 py-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-xs">
                    <button
                      onClick={() => setIsAttachmentOpen(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                    >
                      <Paperclip size={14} className="text-[#9A9B9F]" />
                      <span>Upload Document</span>
                    </button>
                    <button
                      onClick={() => setIsAttachmentOpen(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                    >
                      <ImageIcon size={14} className="text-[#9A9B9F]" />
                      <span>Upload Image</span>
                    </button>
                    <button
                      onClick={() => setIsAttachmentOpen(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                    >
                      <Code2 size={14} className="text-[#9A9B9F]" />
                      <span>Code Snippet</span>
                    </button>
                    <button
                      onClick={() => setIsAttachmentOpen(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-white/5 flex items-center gap-2.5 text-[#E0E2E6]"
                    >
                      <Globe size={14} className="text-[#9A9B9F]" />
                      <span>Web Grounding</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Chat / Web / Apps switch */}
              <div role="tablist" aria-label="AXON mode" className="flex items-center">
                {AXON_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === m.id}
                    onClick={() => onModeChange(m.id)}
                    className={`h-8 px-2.5 rounded-full text-xs font-medium transition-all ${
                      mode === m.id
                        ? 'bg-[#2A2B2E] text-[#ECECEC]'
                        : 'text-[#8E9094] hover:text-[#ECECEC]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Controls: Microphone & Persistent Circular Action Button */}
            <div className="flex items-center gap-1.5">
              {/* Microphone Button */}
              <button
                type="button"
                onClick={handleVoiceClick}
                aria-label="Spoken microphone input"
                className="w-9 h-9 rounded-full text-[#9B9DA2] hover:text-white hover:bg-white/5 flex items-center justify-center transition-all active:scale-95"
              >
                <Mic size={19} strokeWidth={2} />
              </button>

              {/* Persistent Voice / Send Dual-State Circular Button */}
              {/* Stable geometry: 40px x 40px circle, solid white bg, black icon */}
              <button
                type="button"
                onClick={hasText ? () => handleSubmit() : handleVoiceClick}
                disabled={disabled}
                aria-label={hasText ? 'Send message' : 'Voice conversation'}
                className="w-10 h-10 rounded-full bg-white text-black hover:bg-[#F2F2F2] flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#E85A3C]"
              >
                {hasText ? (
                  // Send State (Arrow Up)
                  <ArrowUp size={19} strokeWidth={2.5} className="animate-in zoom-in-75 duration-150" />
                ) : (
                  // Voice State (Sound wave bars icon matching reference images)
                  <div className="flex items-center gap-[2.5px] h-4">
                    <span className="w-[2px] h-2 bg-black rounded-full" />
                    <span className="w-[2px] h-3.5 bg-black rounded-full" />
                    <span className="w-[2px] h-4 bg-black rounded-full" />
                    <span className="w-[2px] h-2.5 bg-black rounded-full" />
                    <span className="w-[2px] h-1.5 bg-black rounded-full" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

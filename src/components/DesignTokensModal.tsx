/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, CheckCircle2, ShieldCheck, Palette, Layout, Cpu } from 'lucide-react';
import { AXON_TOKENS } from '../tokens/designTokens';
import AxonLogo from './AxonLogo.jsx';
import { useTokensModal } from '../state/AxonStateContext';

interface DesignTokensModalProps {
  onSelectView: (view: 'welcome' | 'conversation' | 'drawer') => void;
  onLogoClick?: () => void;
}

export const DesignTokensModal: React.FC<DesignTokensModalProps> = ({
  onSelectView,
  onLogoClick,
}) => {
  // Stage 1A proof: open/close flows through the state root, not props
  const { isTokensModalOpen: isOpen, closeTokensModal: onClose } = useTokensModal();

  if (!isOpen) return null;

  const handleLogoTap = () => {
    onClose();
    onLogoClick?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" 
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg bg-[#18191C] border border-white/10 rounded-3xl p-6 shadow-2xl text-[#ECECEC] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogoTap}
              aria-label="AXON Navigation"
              className="cursor-pointer hover:opacity-85 transition-opacity"
            >
              <AxonLogo className="w-[28px] h-[28px] shrink-0" />
            </button>
            <div>
              <h2 className="font-serif text-xl font-semibold tracking-wide text-white">AXON Foundation</h2>
              <p className="text-xs text-[#9A9B9F]">Architecture &amp; Design System Tokens</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#A0A2A7] hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick View State Switcher (To rapidly inspect the 3 reference image states) */}
        <div className="py-4 border-b border-white/5">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8E9094] mb-2.5">
            Reference State Inspector
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                onSelectView('welcome');
                onClose();
              }}
              className="px-3 py-2 rounded-xl bg-[#232428] hover:bg-[#2D2E33] border border-white/5 text-xs text-center transition-colors"
            >
              <div className="font-medium text-white mb-0.5">Image 1</div>
              <div className="text-[10px] text-[#9A9B9F]">Welcome State</div>
            </button>
            <button
              onClick={() => {
                onSelectView('conversation');
                onClose();
              }}
              className="px-3 py-2 rounded-xl bg-[#232428] hover:bg-[#2D2E33] border border-white/5 text-xs text-center transition-colors"
            >
              <div className="font-medium text-white mb-0.5">Image 2</div>
              <div className="text-[10px] text-[#9A9B9F]">Active Chat</div>
            </button>
            <button
              onClick={() => {
                onSelectView('drawer');
                onClose();
              }}
              className="px-3 py-2 rounded-xl bg-[#232428] hover:bg-[#2D2E33] border border-white/5 text-xs text-center transition-colors"
            >
              <div className="font-medium text-white mb-0.5">Image 3</div>
              <div className="text-[10px] text-[#9A9B9F]">Navigation Drawer</div>
            </button>
          </div>
        </div>

        {/* Architectural Boundaries Checklist */}
        <div className="py-4 border-b border-white/5 space-y-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            System Discipline Compliance
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Decoupled Body: Zero background Gemini calls or hidden AI telemetry</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Anchored Frame: Top bar &amp; bottom composer stable during scroll</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Unified Voice/Send: 40px circle with smooth state morphing</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Official Axon Identity: Tree neural arborization preserved</span>
            </div>
          </div>
        </div>

        {/* Centralized Geometry Tokens */}
        <div className="pt-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            Centralized Dimensional Tokens
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 bg-[#121315] rounded-xl border border-white/5">
              <span className="text-[#8E9094] block text-[10px]">Top Bar Height</span>
              <span className="text-white">{AXON_TOKENS.topBar.height}</span>
            </div>
            <div className="p-2.5 bg-[#121315] rounded-xl border border-white/5">
              <span className="text-[#8E9094] block text-[10px]">Composer Radius</span>
              <span className="text-white">{AXON_TOKENS.composer.borderRadius}</span>
            </div>
            <div className="p-2.5 bg-[#121315] rounded-xl border border-white/5">
              <span className="text-[#8E9094] block text-[10px]">Plus Button</span>
              <span className="text-white">{AXON_TOKENS.composer.plusButtonSize}</span>
            </div>
            <div className="p-2.5 bg-[#121315] rounded-xl border border-white/5">
              <span className="text-[#8E9094] block text-[10px]">Voice/Send Button</span>
              <span className="text-white">{AXON_TOKENS.composer.voiceSendButtonSize}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

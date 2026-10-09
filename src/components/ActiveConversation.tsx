/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Copy, 
  Check, 
  Share2, 
  MoreVertical, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useChatSession } from '../state/AxonStateContext';

interface ActiveConversationProps {
  onSelectSuggestion: (prompt: string) => void;
}

export const ActiveConversation: React.FC<ActiveConversationProps> = ({
  onSelectSuggestion,
}) => {
  const { messages } = useChatSession();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSourcesFor, setShowSourcesFor] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 sm:px-6 pt-2 pb-8 space-y-6">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex justify-end animate-in fade-in duration-200">
              <div className="bg-[#242528] text-[#ECECEC] text-[15px] leading-relaxed rounded-[22px] rounded-tr-[6px] px-4.5 py-3.5 max-w-[85%] sm:max-w-[78%] shadow-sm border border-white/[0.04]">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          );
        }

        // Assistant (AXON) message
        return (
          <div key={msg.id} className="flex flex-col space-y-4 animate-in fade-in duration-300">
            {/* Main response typography rendered directly on canvas */}
            <div className="text-[#ECECEC] text-[15px] leading-[1.65] font-normal space-y-3.5 pt-1">
              {msg.leadParagraph ? (
                <p>{msg.leadParagraph}</p>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}

              {msg.planIntro && (
                <p className="pt-1">{msg.planIntro}</p>
              )}

              {/* Numbered plan list */}
              {msg.planItems && msg.planItems.length > 0 && (
                <ol className="space-y-2.5 pt-1 pl-1 list-none">
                  {msg.planItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-[#E6E8EB]">
                      <span className="font-mono text-sm text-[#A0A2A7] shrink-0 pt-0.5">
                        {idx + 1}.
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Action Bar (Sources pill, copy, share, overflow) */}
            <div className="flex items-center justify-end gap-1.5 pt-2 select-none">
              {/* Sources Pill Button */}
              {msg.hasSources && (
                <button
                  onClick={() => setShowSourcesFor(showSourcesFor === msg.id ? null : msg.id)}
                  aria-label="View sources"
                  className="h-7 px-3 rounded-full bg-[#232427] hover:bg-[#2C2D32] text-xs font-medium text-[#C4C6CA] hover:text-white flex items-center gap-1.5 border border-white/5 transition-colors mr-1"
                >
                  <FileText size={13} strokeWidth={2} />
                  <span>Sources</span>
                </button>
              )}

              {/* Copy Button */}
              <button
                onClick={() => handleCopy(msg.id, msg.content)}
                aria-label="Copy message text"
                title="Copy message"
                className="w-8 h-8 rounded-full text-[#9A9B9F] hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
              >
                {copiedId === msg.id ? (
                  <Check size={15} className="text-emerald-400" />
                ) : (
                  <Copy size={15} strokeWidth={2} />
                )}
              </button>

              {/* Share Button */}
              <button
                onClick={() => navigator.clipboard?.writeText(msg.content)}
                aria-label="Share response"
                title="Share response"
                className="w-8 h-8 rounded-full text-[#9A9B9F] hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
              >
                <Share2 size={15} strokeWidth={2} />
              </button>

              {/* More Vertical */}
              <button
                aria-label="More options"
                title="More options"
                className="w-8 h-8 rounded-full text-[#9A9B9F] hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
              >
                <MoreVertical size={15} strokeWidth={2} />
              </button>
            </div>

            {/* Sources drawer disclosure */}
            {showSourcesFor === msg.id && (
              <div className="p-3 bg-[#1C1D21] border border-white/10 rounded-2xl text-xs space-y-1.5 animate-in fade-in duration-150">
                <div className="font-semibold text-white/90">Referenced Architectural Sources:</div>
                <div className="text-[#A0A2A7] flex items-center gap-1.5 hover:text-white cursor-pointer">
                  <ExternalLink size={12} />
                  <span>Official AXON Design Specifications &bull; Section 4 (Anchored Viewport)</span>
                </div>
                <div className="text-[#A0A2A7] flex items-center gap-1.5 hover:text-white cursor-pointer">
                  <ExternalLink size={12} />
                  <span>Android Modern Architecture Guidelines &bull; Jetpack Compose &amp; Kotlin Clean Code</span>
                </div>
              </div>
            )}

            {/* Contextual Suggestion Prompt Card (Image 2) */}
            {msg.suggestionPrompt && (
              <button
                type="button"
                onClick={() => onSelectSuggestion && onSelectSuggestion(msg.suggestionPrompt!)}
                className="group w-full text-left bg-[#1F2023] hover:bg-[#25262A] rounded-2xl p-4 border border-white/[0.05] hover:border-white/10 flex items-start gap-3 transition-all shadow-md active:scale-[0.99]"
              >
                {/* 4-point star icon matching Image 2 */}
                <div className="text-white/70 group-hover:text-white shrink-0 mt-0.5">
                  <Sparkles size={16} strokeWidth={1.8} />
                </div>
                <p className="text-[14px] text-[#D8DADC] group-hover:text-white font-normal italic leading-relaxed">
                  {msg.suggestionPrompt}
                </p>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

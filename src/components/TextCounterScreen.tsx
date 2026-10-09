/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Text Counter: paste or type text, tap Count. The count runs as a real task on the
 * execution kernel (the same action the chat uses) and shows which task produced it.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import AxonLogo from './AxonLogo.jsx';
import { getAxonEngine } from '../kernel/axonEngine';
import { runTextCounter, type TextCounterOutcome } from '../tools/textCounterRun';

interface TextCounterScreenProps {
  onBack: () => void;
  onLogoClick: () => void;
}

export const TextCounterScreen: React.FC<TextCounterScreenProps> = ({ onBack, onLogoClick }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<TextCounterOutcome | null>(null);
  const [countedText, setCountedText] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleCount = async () => {
    if (busy || text === '') return;
    const submittedText = text;
    setBusy(true);
    const result = await runTextCounter(getAxonEngine(), submittedText);
    if (!mounted.current) return;
    setOutcome(result);
    setCountedText(submittedText);
    setBusy(false);
  };

  const handleClear = () => {
    setText('');
    setOutcome(null);
    setCountedText('');
  };

  const isStale = outcome !== null && outcome.ok && text !== countedText;

  const rows: Array<[string, number]> =
    outcome !== null && outcome.ok
      ? [
          ['Words', outcome.counts.words],
          ['Characters', outcome.counts.characters],
          ['Characters without spaces', outcome.counts.charactersNoSpaces],
          ['Letters', outcome.counts.letters],
          ['Lines', outcome.counts.lines],
        ]
      : [];

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden font-sans">
      <header className="px-5 pt-4 pb-3 bg-[#141517] border-b border-white/5 flex items-center gap-3 shrink-0 z-20">
        <button
          onClick={onBack}
          aria-label="Back to Tools"
          title="Back to Tools"
          className="p-1.5 -ml-1.5 rounded-xl hover:bg-white/5 active:scale-95 transition-all text-[#9A9B9F] hover:text-white cursor-pointer shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={onLogoClick}
          aria-label="AXON Navigation"
          title="Toggle navigation menu"
          className="p-1 rounded-xl hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center cursor-pointer shrink-0"
        >
          <AxonLogo className="w-[28px] h-[28px] shrink-0" />
        </button>
        <span className="font-serif text-[22px] font-semibold tracking-wide text-white leading-tight">
          Text Counter
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="space-y-2">
          <label htmlFor="text-counter-input" className="text-xs font-semibold uppercase tracking-wider text-[#8E9094]">
            Your text
          </label>
          <textarea
            id="text-counter-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type the text to count..."
            rows={8}
            className="w-full bg-[#1C1D21] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#686A70] focus:outline-none focus:border-[#E85A3C] transition-colors resize-y"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCount}
            disabled={busy || text === ''}
            className="px-5 py-2.5 rounded-xl bg-white text-black font-medium text-sm hover:bg-[#F0F0F0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? 'Counting...' : 'Count'}
          </button>
          <button
            onClick={handleClear}
            disabled={busy || (text === '' && outcome === null)}
            className="px-4 py-2.5 rounded-xl bg-white/5 text-[#D0D2D6] text-sm hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            <X size={14} />
            <span>Clear</span>
          </button>
        </div>

        {outcome !== null && !outcome.ok && (
          <div className="p-3.5 rounded-2xl bg-[#141517] border border-white/5 text-[13px] text-[#E0B4A8] leading-relaxed">
            {outcome.message}
          </div>
        )}

        {outcome !== null && outcome.ok && (
          <div className="p-4 rounded-2xl bg-[#141517] border border-white/5 space-y-3">
            {isStale && (
              <p className="text-[12px] text-[#E85A3C] leading-relaxed">
                The text has changed since this count. Tap Count again for a fresh result.
              </p>
            )}
            <div className={isStale ? 'opacity-50' : ''}>
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-b-0">
                  <span className="text-[13.5px] text-[#B8BABF]">{label}</span>
                  <span className="text-[15px] font-medium text-white tabular-nums">{value}</span>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] text-[#7A7C82] leading-relaxed">{outcome.evidence}</p>
          </div>
        )}
      </div>
    </div>
  );
};

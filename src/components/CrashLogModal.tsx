/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Crash log viewer: lists what the app caught (newest first), saves it as a text file,
 * clears it, and can crash a small panel on purpose to prove the error screen works.
 */

import React, { useState } from 'react';
import { X, Download, Trash2, Bug } from 'lucide-react';
import { ErrorBoundary, CrashPanel } from './ErrorBoundary';
import { getCrashLog, errorSummary } from '../crash/crashLog';
import { saveFile } from '../services/saveFile';

interface CrashLogModalProps {
  onClose: () => void;
}

/** Throws while drawing, on purpose. Only the test button shows it. */
const DeliberateCrash: React.FC = () => {
  throw new Error('Deliberate test crash from the crash log screen');
};

export const CrashLogModal: React.FC<CrashLogModalProps> = ({ onClose }) => {
  // Bumped to re-read the log after a change.
  const [, setTick] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [testing, setTesting] = useState(false);

  const log = getCrashLog();
  const entries = log.list().reverse();

  const refresh = () => setTick((n) => n + 1);

  const handleExport = async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const result = await saveFile(`axon-crash-log-${stamp}.txt`, log.exportText(), 'text/plain');
    setStatus(result.message ?? (result.success ? 'Saved.' : 'Saving failed.'));
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    log.clear();
    setConfirmClear(false);
    setStatus('The crash log was cleared.');
    refresh();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md max-h-[85dvh] flex flex-col bg-[#18191C] border border-white/10 rounded-3xl p-6 shadow-2xl text-[#ECECEC] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0">
          <h2 className="font-serif text-lg font-semibold tracking-wide text-white">Crash log</h2>
          <button
            onClick={onClose}
            aria-label="Close crash log"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#A0A2A7] hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <p className="text-[12px] text-[#8E9094] leading-relaxed shrink-0">
          Errors this app caught on this device, newest first. {entries.length} recorded. An empty log means nothing was caught, not that nothing can go wrong.
        </p>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={handleExport}
            className="px-3.5 py-2 rounded-xl bg-white text-black font-medium text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Download size={13} />
            <span>Save as file</span>
          </button>
          <button
            onClick={handleClear}
            disabled={entries.length === 0 && !confirmClear}
            className="px-3.5 py-2 rounded-xl bg-white/5 text-[#D0D2D6] text-xs hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span>{confirmClear ? 'Tap again to clear' : 'Clear'}</span>
          </button>
          <button
            onClick={() => {
              setTesting(true);
              setStatus(null);
            }}
            className="px-3.5 py-2 rounded-xl bg-white/5 text-[#D0D2D6] text-xs hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Bug size={13} />
            <span>Test the error screen</span>
          </button>
        </div>

        {status && <p className="text-[12px] text-[#E85A3C] leading-relaxed shrink-0">{status}</p>}

        {testing && (
          <div className="flex flex-col shrink-0 rounded-2xl border border-white/5 overflow-hidden">
            <ErrorBoundary
              where="crash-log-test"
              onCatch={refresh}
              fallback={({ error, reset }) => (
                <CrashPanel
                  title="Caught on purpose"
                  message={errorSummary(error)}
                  note="This panel crashed deliberately. The error screen caught it and wrote it to the log below."
                  actions={[
                    {
                      label: 'Close test',
                      onClick: () => {
                        reset();
                        setTesting(false);
                      },
                      primary: true,
                    },
                  ]}
                />
              )}
            >
              <DeliberateCrash />
            </ErrorBoundary>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {entries.length === 0 && (
            <p className="text-[12.5px] text-[#707277] italic py-4 text-center">No crashes recorded.</p>
          )}
          {entries.map((entry) => (
            <details key={entry.id} className="p-3 bg-[#141517] rounded-2xl border border-white/5 text-xs">
              <summary className="cursor-pointer text-[#ECECEC] leading-relaxed break-words">
                <span className="text-[#8E9094]">{new Date(entry.at).toLocaleString()}</span>
                {' · '}
                <span className="text-[#E85A3C]">{entry.where}</span>
                <br />
                <span>{entry.message}</span>
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-[10.5px] text-[#9A9B9F] leading-relaxed">
                {entry.stack === '' ? '(no stack)' : entry.stack}
                {entry.componentStack !== '' ? `\n\nComponent stack:${entry.componentStack}` : ''}
              </pre>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
};

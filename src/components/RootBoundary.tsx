/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The outermost safety net. It catches a crash anywhere the screen guard does not
 * (the menu, dialogs, the state root itself) and offers: try again, save the crash log
 * as a file, and reset only the saved current screen to chat so a screen that crashes
 * on start cannot trap the app. Chats and other saved data are never cleared.
 */

import React, { useState } from 'react';
import { ErrorBoundary, CrashPanel } from './ErrorBoundary';
import { getCrashLog, errorSummary, resetSavedScreenToChat } from '../crash/crashLog';
import { STORAGE_KEY } from '../state/storage';
import { saveFile } from '../services/saveFile';

interface RootFallbackProps {
  error: unknown;
  reset: () => void;
}

const RootFallback: React.FC<RootFallbackProps> = ({ error, reset }) => {
  const [status, setStatus] = useState<string | null>(null);

  const handleSaveLog = async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const result = await saveFile(`axon-crash-log-${stamp}.txt`, getCrashLog().exportText(), 'text/plain');
    setStatus(result.message ?? (result.success ? 'Saved.' : 'Saving failed.'));
  };

  const handleResetScreen = () => {
    try {
      const next = resetSavedScreenToChat(localStorage.getItem(STORAGE_KEY));
      if (next !== null) localStorage.setItem(STORAGE_KEY, next);
      reset();
    } catch {
      setStatus('Could not reset the saved screen on this device.');
    }
  };

  return (
    <div className="relative w-full h-dvh flex flex-col bg-[#121315]">
      <CrashPanel
        title="AXON hit a problem"
        message={errorSummary(error)}
        note={
          status ??
          'Nothing was deleted. You can try again, reset only the saved screen back to chat, or save the crash log to send for fixing.'
        }
        actions={[
          { label: 'Try again', onClick: reset, primary: true },
          { label: 'Reset saved screen', onClick: handleResetScreen },
          { label: 'Save crash log', onClick: handleSaveLog },
        ]}
      />
    </div>
  );
};

interface RootBoundaryProps {
  children?: React.ReactNode;
}

export const RootBoundary: React.FC<RootBoundaryProps> = ({ children }) => (
  <ErrorBoundary where="root" fallback={(info) => <RootFallback error={info.error} reset={info.reset} />}>
    {children}
  </ErrorBoundary>
);

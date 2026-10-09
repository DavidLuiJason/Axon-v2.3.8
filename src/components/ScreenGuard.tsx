/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Wraps whatever screen is showing. If it crashes, the user sees an error card with a way
 * out (try again, back to chat, open the menu) instead of a blank screen. Changing screen
 * clears the error. The menu and dialogs are outside this guard and keep working.
 */

import React from 'react';
import { ErrorBoundary, CrashPanel } from './ErrorBoundary';
import { errorSummary } from '../crash/crashLog';
import { useCurrentScreen } from '../state/AxonStateContext';

interface ScreenGuardProps {
  onOpenMenu: () => void;
  children?: React.ReactNode;
}

export const ScreenGuard: React.FC<ScreenGuardProps> = ({ onOpenMenu, children }) => {
  const { currentScreen, setCurrentScreen } = useCurrentScreen();

  return (
    <ErrorBoundary
      where={`screen:${currentScreen}`}
      resetKey={currentScreen}
      fallback={({ error, reset }) => (
        <CrashPanel
          title="This screen hit a problem"
          message={errorSummary(error)}
          note="Nothing was deleted. The details were added to the crash log in Settings."
          actions={[
            { label: 'Try again', onClick: reset, primary: true },
            {
              label: 'Back to chat',
              onClick: () => {
                setCurrentScreen('chat');
                reset();
              },
            },
            { label: 'Open menu', onClick: onOpenMenu },
          ]}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Error boundary: when something inside it crashes while drawing, it shows a fallback
 * instead of a blank screen, and writes the error to the crash log.
 * It draws no element of its own, so it never changes the layout around it.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { getCrashLog } from '../crash/crashLog';

export interface FallbackInfo {
  error: unknown;
  /** Clears the error and draws the children again. */
  reset: () => void;
}

interface ErrorBoundaryProps {
  /** Where this boundary sits, written into the crash log, for example "screen:axon-tools". */
  where: string;
  fallback: (info: FallbackInfo) => ReactNode;
  /** When this value changes, a shown error is cleared (for example when the screen changes). */
  resetKey?: string;
  /** Called after the error has been written to the crash log. */
  onCatch?: () => void;
  children?: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
  error: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    getCrashLog().record({
      where: this.props.where,
      error,
      componentStack: info.componentStack ?? '',
    });
    this.props.onCatch?.();
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ failed: false, error: null });
  };

  render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}

export interface CrashPanelAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface CrashPanelProps {
  title: string;
  message: string;
  note?: string;
  actions: CrashPanelAction[];
}

/** The plain fallback card used by every boundary. */
export const CrashPanel: React.FC<CrashPanelProps> = ({ title, message, note, actions }) => (
  <div className="flex-1 w-full flex items-center justify-center px-6 py-8 bg-[#121315] text-[#ECECEC] font-sans">
    <div className="w-full max-w-md bg-[#18191C] border border-white/10 rounded-3xl p-6 space-y-4">
      <h2 className="font-serif text-lg font-semibold tracking-wide text-white">{title}</h2>
      <p className="text-[13px] text-[#C8CACE] leading-relaxed break-words">{message}</p>
      {note && <p className="text-[12px] text-[#8E9094] leading-relaxed">{note}</p>}
      <div className="flex flex-wrap gap-2.5 pt-1">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={
              action.primary
                ? 'px-4 py-2 rounded-xl bg-white text-black font-medium text-xs hover:bg-[#F0F0F0] transition-colors cursor-pointer'
                : 'px-4 py-2 rounded-xl bg-white/5 text-[#D0D2D6] text-xs hover:bg-white/10 transition-colors cursor-pointer'
            }
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

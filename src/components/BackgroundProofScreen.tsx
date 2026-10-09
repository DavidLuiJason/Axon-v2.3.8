/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 6 — Background Proof screen.
 * Uses existing AXON design tokens and component style.
 * Native heartbeats are the only evidence; UI timers are not.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Play,
  Square,
  ListOrdered,
  Download,
  Shield,
  Activity,
  Battery,
  Bell,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import AxonLogo from './AxonLogo.jsx';
import {
  getBackgroundAdapter,
  formatElapsed,
  elapsedFromStart,
  computeEvidence,
  type JobSnapshot,
  type BackgroundCapabilities,
  type EvidenceStats,
} from '../background';
import { saveFile } from '../services/saveFile';

interface BackgroundProofScreenProps {
  onLogoClick: () => void;
}

const STEP_LABELS = [
  'Initializing workspace',
  'Loading configuration',
  'Validating permissions',
  'Preparing counter state',
  'Writing first checkpoint',
  'Finalizing demo',
];

export const BackgroundProofScreen: React.FC<BackgroundProofScreenProps> = ({
  onLogoClick,
}) => {
  const adapter = getBackgroundAdapter();
  const [snap, setSnap] = useState<JobSnapshot | null>(null);
  const [caps, setCaps] = useState<BackgroundCapabilities | null>(null);
  const [evidence, setEvidence] = useState<EvidenceStats | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [batteryExempt, setBatteryExempt] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Display clock only for ELAPSED label (derived from persisted start — not evidence)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const c = await adapter.getCapabilities();
        setCaps(c);
        const s = await adapter.getSnapshot();
        setSnap(s);
        setEvidence(computeEvidence(s));
        const ignoring = await adapter.isIgnoringBatteryOptimizations();
        setBatteryExempt(ignoring);
      } catch (e) {
        setError(String(e));
      }
    })();
    unsub = adapter.subscribe((s) => {
      setSnap(s);
      setEvidence(computeEvidence(s));
    });
    return () => unsub();
  }, [adapter]);

  // Recompute evidence age on tick
  useEffect(() => {
    if (snap) setEvidence(computeEvidence(snap));
  }, [tick, snap]);

  const startCounter = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await adapter.startJob({ kind: 'counter' });
      const s = await adapter.getSnapshot();
      setSnap(s);
      setEvidence(computeEvidence(s));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [adapter]);

  const startSteps = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await adapter.startJob({ kind: 'steps', steps: STEP_LABELS });
      const s = await adapter.getSnapshot();
      setSnap(s);
      setEvidence(computeEvidence(s));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [adapter]);

  const stopJob = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await adapter.stopJob();
      const s = await adapter.getSnapshot();
      setSnap(s);
      setEvidence(computeEvidence(s));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [adapter]);

  const requestNotif = useCallback(async () => {
    const ok = await adapter.requestNotificationPermission();
    setNotifGranted(ok);
  }, [adapter]);

  const openBattery = useCallback(async () => {
    await adapter.openBatteryOptimizationSettings();
    // Re-check after user returns
    setTimeout(async () => {
      const ignoring = await adapter.isIgnoringBatteryOptimizations();
      setBatteryExempt(ignoring);
    }, 1500);
  }, [adapter]);

  const exportDiag = useCallback(async () => {
    try {
      const json = await adapter.exportDiagnostics();
      const fileName = `axon-background-proof-${Date.now()}.json`;
      const result = await saveFile(fileName, json, 'application/json');
      if (result.success) {
        setExportStatus(`Saved / shared: ${fileName}`);
        setError(null);
      } else {
        setError(`Export failed: ${result.error || 'Unknown error'}`);
      }
      setTimeout(() => setExportStatus(null), 3500);
    } catch (e: any) {
      setError(`Export failed: ${e?.message || String(e)}`);
      setTimeout(() => setError(null), 3500);
    }
  }, [adapter]);

  const refresh = useCallback(async () => {
    const s = await adapter.getSnapshot();
    setSnap(s);
    setEvidence(computeEvidence(s));
    const ignoring = await adapter.isIgnoringBatteryOptimizations();
    setBatteryExempt(ignoring);
  }, [adapter]);

  const elapsedMs = elapsedFromStart(snap?.startWallClock ?? null);
  const elapsedLabel = formatElapsed(elapsedMs);
  const activityLabel =
    snap?.stepLabel && snap.stepLabel.length > 0
      ? snap.stepLabel
      : snap?.running
        ? 'Starting…'
        : 'Idle';
  const verdict = evidence?.verdict ?? 'NEVER STARTED';

  const verdictColor =
    verdict === 'PROVEN RUNNING'
      ? 'text-emerald-400'
      : verdict === 'GAPS DETECTED'
        ? 'text-amber-400'
        : verdict === 'STOPPED'
          ? 'text-[#9A9B9F]'
          : 'text-[#68696E]';

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden select-none font-sans">
      {/* HEADER — matches AxonTools / Source style */}
      <header className="px-5 pt-4 pb-3 bg-[#141517] border-b border-white/5 flex flex-col shrink-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onLogoClick}
              aria-label="AXON Navigation"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
            >
              <AxonLogo className="w-7 h-7" />
            </button>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[20px] font-semibold tracking-tight text-[#EDEDED]">
                AXON
              </span>
              <span className="font-serif text-[18px] font-normal text-[#9A9B9F]">
                Background Proof
              </span>
            </div>
          </div>
          <button
            onClick={refresh}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 text-[#9A9B9F]"
            aria-label="Refresh"
          >
            <RefreshCw size={18} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Platform banner */}
        <div className="rounded-2xl bg-[#1E1F22] border border-white/[0.07] p-4">
          <div className="text-[12px] uppercase tracking-wider text-[#68696E] mb-1">
            Platform
          </div>
          <div className="text-[14px] text-[#EDEDED]">
            {caps?.platform === 'android-native'
              ? 'Android native foreground service'
              : 'Web / non-native'}
          </div>
          <p className="mt-2 text-[13px] text-[#9A9B9F] leading-relaxed">
            {caps?.reason ??
              'Loading capabilities…'}
          </p>
        </div>

        {/* Controls */}
        <div className="rounded-2xl bg-[#1E1F22] border border-white/[0.07] p-4 space-y-3">
          <div className="text-[12px] uppercase tracking-wider text-[#68696E]">
            Jobs
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || !!snap?.running}
              onClick={startCounter}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#E85A3C] text-white text-[13px] font-medium disabled:opacity-40 hover:bg-[#F0684B] transition-colors"
            >
              <Play size={16} strokeWidth={2} />
              Start counter
            </button>
            <button
              disabled={busy || !!snap?.running}
              onClick={startSteps}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#25262A] text-[#EDEDED] text-[13px] font-medium border border-white/10 disabled:opacity-40 hover:bg-[#26272B] transition-colors"
            >
              <ListOrdered size={16} strokeWidth={1.8} />
              Start steps demo
            </button>
            <button
              disabled={busy || !snap?.running}
              onClick={stopJob}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#25262A] text-[#EDEDED] text-[13px] font-medium border border-white/10 disabled:opacity-40 hover:bg-[#26272B] transition-colors"
            >
              <Square size={16} strokeWidth={1.8} />
              Stop
            </button>
          </div>
          {error && (
            <p className="text-[12px] text-amber-400">{error}</p>
          )}
        </div>

        {/* Live status */}
        <div className="rounded-2xl bg-[#1E1F22] border border-white/[0.07] p-4 space-y-3">
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-wider text-[#68696E]">
            <Activity size={14} />
            Live status
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-[#68696E]">Activity label</div>
              <div className="text-[15px] text-[#EDEDED] font-medium mt-0.5">
                {activityLabel}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#68696E]">Elapsed</div>
              <div className="text-[15px] text-[#EDEDED] font-medium mt-0.5 tabular-nums">
                {snap?.startWallClock != null ? elapsedLabel : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#68696E]">
                Background service active
              </div>
              <div className="text-[15px] text-[#EDEDED] font-medium mt-0.5">
                {snap?.serviceActive ? 'yes' : 'no'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#68696E]">Counter</div>
              <div className="text-[15px] text-[#EDEDED] font-medium mt-0.5 tabular-nums">
                {snap?.jobKind === 'counter' ? snap.counterValue : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Evidence panel */}
        <div className="rounded-2xl bg-[#1E1F22] border border-white/[0.07] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] uppercase tracking-wider text-[#68696E]">
              <Shield size={14} />
              Evidence
            </div>
            <span className={`text-[13px] font-semibold ${verdictColor}`}>
              {verdict}
            </span>
          </div>
          <p className="text-[12px] text-[#68696E] leading-relaxed">
            Verdict is computed only from the native heartbeat log, confirmed
            against whether the service is actually alive. A UI timer is not
            evidence.
          </p>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <Stat label="Beats received" value={String(evidence?.beatsReceived ?? 0)} />
            <Stat label="Beats expected" value={String(evidence?.beatsExpected ?? 0)} />
            <Stat label="Missed" value={String(evidence?.missed ?? 0)} />
            <Stat
              label="Longest gap"
              value={
                evidence && evidence.longestGapMs > 0
                  ? formatElapsed(evidence.longestGapMs)
                  : '0s'
              }
            />
            <Stat
              label="Last heartbeat age"
              value={
                evidence?.lastHeartbeatAgeMs != null
                  ? formatElapsed(evidence.lastHeartbeatAgeMs)
                  : '—'
              }
            />
            <Stat
              label="RESTARTED events"
              value={String(evidence?.restartedEvents ?? 0)}
            />
            <Stat
              label="TIMEOUT events"
              value={String(evidence?.timeoutEvents ?? 0)}
            />
            <Stat
              label="Battery samples"
              value={
                evidence && evidence.batterySamples.length > 0
                  ? `${evidence.batterySamples[evidence.batterySamples.length - 1]}%`
                  : '—'
              }
            />
          </div>
        </div>

        {/* Health panel */}
        <div className="rounded-2xl bg-[#1E1F22] border border-white/[0.07] p-4 space-y-3">
          <div className="flex items-center gap-2 text-[12px] uppercase tracking-wider text-[#68696E]">
            <Battery size={14} />
            Health
          </div>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[13px] text-[#EDEDED]">
                  <Bell size={14} className="text-[#9A9B9F]" />
                  Notification permission
                </div>
                <p className="text-[12px] text-[#68696E] mt-1">
                  Required for the foreground service notification on Android 13+.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[12px] text-[#9A9B9F]">
                  {notifGranted == null ? 'unknown' : notifGranted ? 'granted' : 'denied'}
                </span>
                <button
                  onClick={requestNotif}
                  className="px-3 py-1.5 rounded-full text-[12px] bg-[#25262A] border border-white/10 hover:bg-[#26272B]"
                >
                  Request
                </button>
              </div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] text-[#EDEDED]">
                  Battery optimization exemption
                </div>
                <p className="text-[12px] text-[#68696E] mt-1 leading-relaxed">
                  Without exemption, the OS may still restrict the process after
                  long idle periods even with a foreground service. Open system
                  settings and allow unrestricted battery use for AXON.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[12px] text-[#9A9B9F]">
                  {batteryExempt == null
                    ? 'unknown'
                    : batteryExempt
                      ? 'exempt'
                      : 'not exempt'}
                </span>
                <button
                  onClick={openBattery}
                  className="px-3 py-1.5 rounded-full text-[12px] bg-[#25262A] border border-white/10 hover:bg-[#26272B] flex items-center gap-1"
                >
                  Settings
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Export */}
        <button
          onClick={exportDiag}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#25262A] border border-white/10 text-[13px] text-[#EDEDED] hover:bg-[#26272B] transition-colors"
        >
          <Download size={16} strokeWidth={1.8} />
          Export diagnostics (JSON)
        </button>

        {exportStatus && (
          <p className="text-[12px] text-emerald-400 text-center animate-in fade-in duration-150">{exportStatus}</p>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-[#68696E]">{label}</div>
      <div className="text-[14px] text-[#EDEDED] font-medium mt-0.5 tabular-nums">
        {value}
      </div>
    </div>
  );
}

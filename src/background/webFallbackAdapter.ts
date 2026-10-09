/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 6 — Web fallback adapter.
 * Plainly states: cannot run in background; foreground only.
 * Provides a local demo clock only while the tab is visible so the UI
 * remains exercisable in browsers. This is NOT background evidence.
 */

import type {
  BackgroundCapabilities,
  BackgroundExecutionAdapter,
  HeartbeatRecord,
  JobSnapshot,
  StartJobOptions,
} from './types';

const DEFAULT_STEPS = [
  'Initializing workspace',
  'Loading configuration',
  'Validating permissions',
  'Preparing counter state',
  'Writing first checkpoint',
  'Finalizing demo',
];

function emptySnapshot(): JobSnapshot {
  return {
    jobId: null,
    jobKind: null,
    running: false,
    startWallClock: null,
    stepLabel: '',
    counterValue: 0,
    serviceActive: false,
    heartbeats: [],
  };
}

/**
 * Foreground-only simulation. Heartbeats stop when the tab is hidden
 * (page visibility) to avoid pretending background work exists.
 */
export function createWebFallbackAdapter(): BackgroundExecutionAdapter {
  let snap: JobSnapshot = emptySnapshot();
  let timer: ReturnType<typeof setInterval> | null = null;
  let stepIndex = 0;
  let steps: string[] = DEFAULT_STEPS;
  const listeners = new Set<(s: JobSnapshot) => void>();
  let seq = 0;

  function emit() {
    const copy: JobSnapshot = {
      ...snap,
      heartbeats: [...snap.heartbeats],
    };
    listeners.forEach((cb) => cb(copy));
  }

  function clearTimer() {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function pushHb(partial: Partial<HeartbeatRecord> & { eventType: HeartbeatRecord['eventType'] }) {
    seq += 1;
    const rec: HeartbeatRecord = {
      jobId: snap.jobId ?? 'web',
      seq,
      wallClock: Date.now(),
      elapsedRealtime: snap.startWallClock != null ? Date.now() - snap.startWallClock : 0,
      batteryPercent: null,
      stepLabel: snap.stepLabel,
      gapMs: partial.gapMs,
      counterValue: snap.counterValue,
      ...partial,
    };
    snap = {
      ...snap,
      heartbeats: [...snap.heartbeats, rec].slice(-500),
      stepLabel: rec.stepLabel,
      counterValue: rec.counterValue ?? snap.counterValue,
    };
    emit();
  }

  function tick() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      // Do not fake background heartbeats on web.
      return;
    }
    if (!snap.running) return;

    if (snap.jobKind === 'counter') {
      snap = {
        ...snap,
        counterValue: snap.counterValue + 1,
        stepLabel: `Counting · ${snap.counterValue + 1}`,
      };
      pushHb({ eventType: 'HEARTBEAT', stepLabel: snap.stepLabel, counterValue: snap.counterValue });
    } else if (snap.jobKind === 'steps') {
      if (stepIndex < steps.length) {
        const label = steps[stepIndex];
        snap = { ...snap, stepLabel: label };
        pushHb({ eventType: 'STEP', stepLabel: label });
        pushHb({ eventType: 'HEARTBEAT', stepLabel: label });
        stepIndex += 1;
        if (stepIndex >= steps.length) {
          // Finish finite demo
          pushHb({ eventType: 'STOPPED', stepLabel: label });
          snap = { ...snap, running: false, serviceActive: false };
          clearTimer();
          emit();
        }
      }
    }
  }

  return {
    async getCapabilities(): Promise<BackgroundCapabilities> {
      return {
        canRunInBackground: false,
        platform: 'web-fallback',
        reason:
          'cannot run in background; foreground only. Native Android foreground service is required for real background proof.',
      };
    },

    async startJob(opts: StartJobOptions): Promise<{ jobId: string }> {
      clearTimer();
      const jobId = `web-${Date.now()}`;
      seq = 0;
      stepIndex = 0;
      steps = opts.steps && opts.steps.length > 0 ? opts.steps : DEFAULT_STEPS;
      const startLabel =
        opts.kind === 'counter' ? 'Counting · 0' : steps[0] ?? 'Starting';
      snap = {
        jobId,
        jobKind: opts.kind,
        running: true,
        startWallClock: Date.now(),
        stepLabel: startLabel,
        counterValue: 0,
        serviceActive: true,
        heartbeats: [],
      };
      pushHb({ eventType: 'STARTED', stepLabel: startLabel });
      timer = setInterval(tick, 5000);
      // First tick soon so UI is responsive
      setTimeout(tick, 200);
      emit();
      return { jobId };
    },

    async stopJob(): Promise<void> {
      if (!snap.running) return;
      pushHb({ eventType: 'STOPPED', stepLabel: snap.stepLabel || 'Stopped' });
      snap = { ...snap, running: false, serviceActive: false };
      clearTimer();
      emit();
    },

    async getSnapshot(): Promise<JobSnapshot> {
      return {
        ...snap,
        heartbeats: [...snap.heartbeats],
      };
    },

    subscribe(cb: (s: JobSnapshot) => void): () => void {
      listeners.add(cb);
      cb({ ...snap, heartbeats: [...snap.heartbeats] });
      return () => {
        listeners.delete(cb);
      };
    },

    async requestNotificationPermission(): Promise<boolean> {
      return false;
    },

    async openBatteryOptimizationSettings(): Promise<void> {
      // no-op on web
    },

    async isIgnoringBatteryOptimizations(): Promise<boolean> {
      return false;
    },

    async exportDiagnostics(): Promise<string> {
      const caps = await this.getCapabilities();
      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          capabilities: caps,
          snapshot: snap,
          note: 'Web fallback — not valid background evidence.',
        },
        null,
        2
      );
    },
  };
}

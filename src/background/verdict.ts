/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 6.1 — evidence verdict computed ONLY from the heartbeat log,
 * confirmed against whether the service is actually alive.
 *
 * Verdicts: PROVEN RUNNING | GAPS DETECTED | STOPPED | NEVER STARTED | RESTART BLOCKED
 *
 * Expected heartbeat interval: 5 seconds.
 * Understands SUMMARY records (counts as heartbeatCount without double-counting
 * pruned HEARTBEAT detail) and RESTART_BLOCKED.
 */

import type { HeartbeatRecord, JobSnapshot } from './types';

export const HEARTBEAT_INTERVAL_MS = 5000;
/** Tolerate up to 2.5 intervals before counting a gap. */
export const GAP_THRESHOLD_MS = Math.floor(HEARTBEAT_INTERVAL_MS * 2.5);

export type Verdict =
  | 'PROVEN RUNNING'
  | 'GAPS DETECTED'
  | 'STOPPED'
  | 'NEVER STARTED'
  | 'RESTART BLOCKED'
  | 'WAITING FOR FIRST BEAT';

export interface EvidenceStats {
  beatsReceived: number;
  beatsExpected: number;
  missed: number;
  longestGapMs: number;
  lastHeartbeatAgeMs: number | null;
  restartedEvents: number;
  timeoutEvents: number;
  restartBlockedEvents: number;
  batterySamples: number[];
  verdict: Verdict;
}

/**
 * Expand records for gap analysis: SUMMARY contributes heartbeatCount synthetic
 * beats so pruned detail is not double-counted. HEARTBEAT lines count as 1.
 */
function expandBeatWallClocks(records: HeartbeatRecord[]): number[] {
  const walls: number[] = [];
  for (const r of records) {
    if (r.eventType === 'HEARTBEAT' || r.eventType === 'RESTARTED') {
      walls.push(r.wallClock);
    } else if (r.eventType === 'SUMMARY') {
      const count = typeof r.heartbeatCount === 'number' ? r.heartbeatCount : 0;
      const start = r.firstWall ?? r.windowStartWall ?? r.wallClock;
      const end = r.lastWall ?? r.windowEndWall ?? r.wallClock;
      if (count <= 0) continue;
      if (count === 1) {
        walls.push(start);
      } else {
        const span = Math.max(0, end - start);
        for (let i = 0; i < count; i++) {
          const t = start + Math.floor((span * i) / Math.max(1, count - 1));
          walls.push(t);
        }
      }
    }
  }
  return walls.sort((a, b) => a - b);
}

/**
 * Compute evidence stats and verdict from a snapshot.
 * A UI timer or notification chronometer is NOT evidence — only native heartbeats.
 * serviceActive must come from a fresh native heartbeat timestamp, not stale prefs.
 */
export function computeEvidence(
  snap: JobSnapshot,
  now: number = Date.now()
): EvidenceStats {
  const all = snap.heartbeats ?? [];

  const restartedEvents = all.filter((h) => h.eventType === 'RESTARTED').length;
  const timeoutEvents = all.filter((h) => h.eventType === 'TIMEOUT').length;
  const restartBlockedEvents = all.filter(
    (h) => h.eventType === 'RESTART_BLOCKED'
  ).length;

  const batterySamples = all
    .map((h) => h.batteryPercent)
    .filter((b): b is number => typeof b === 'number' && Number.isFinite(b));

  if (all.length === 0 && !snap.running && snap.startWallClock == null) {
    return {
      beatsReceived: 0,
      beatsExpected: 0,
      missed: 0,
      longestGapMs: 0,
      lastHeartbeatAgeMs: null,
      restartedEvents: 0,
      timeoutEvents: 0,
      restartBlockedEvents: 0,
      batterySamples: [],
      verdict: 'NEVER STARTED',
    };
  }

  if (restartBlockedEvents > 0 && !snap.serviceActive) {
    return {
      beatsReceived: 0,
      beatsExpected: 0,
      missed: 0,
      longestGapMs: 0,
      lastHeartbeatAgeMs: null,
      restartedEvents,
      timeoutEvents,
      restartBlockedEvents,
      batterySamples,
      verdict: 'RESTART BLOCKED',
    };
  }

  const beatWalls = expandBeatWallClocks(all);
  const beatsReceived = beatWalls.length;

  let longestGapMs = 0;
  let missed = 0;

  for (let i = 1; i < beatWalls.length; i++) {
    const gap = beatWalls[i] - beatWalls[i - 1];
    if (gap > longestGapMs) longestGapMs = gap;
    if (gap > GAP_THRESHOLD_MS) {
      const expectedInGap = Math.floor(gap / HEARTBEAT_INTERVAL_MS) - 1;
      if (expectedInGap > 0) missed += expectedInGap;
    }
  }

  for (const h of all) {
    if (h.eventType === 'RESTARTED' && typeof h.gapMs === 'number') {
      if (h.gapMs > longestGapMs) longestGapMs = h.gapMs;
      const expectedInGap = Math.floor(h.gapMs / HEARTBEAT_INTERVAL_MS) - 1;
      if (expectedInGap > 0) missed += expectedInGap;
    }
  }

  if (typeof snap.longestGapMs === 'number' && snap.longestGapMs > longestGapMs) {
    longestGapMs = snap.longestGapMs;
  }

  const lastHbWall =
    beatWalls.length > 0
      ? beatWalls[beatWalls.length - 1]
      : snap.lastHeartbeatWall ?? null;
  const lastHeartbeatAgeMs =
    lastHbWall != null ? Math.max(0, now - lastHbWall) : null;

  let beatsExpected = beatsReceived;
  if (snap.startWallClock != null) {
    const end =
      snap.running && snap.serviceActive
        ? now
        : lastHbWall != null
          ? lastHbWall
          : snap.startWallClock;
    const duration = Math.max(0, end - snap.startWallClock);
    beatsExpected = Math.max(1, Math.floor(duration / HEARTBEAT_INTERVAL_MS) + 1);
  }

  let verdict: Verdict;
  if (all.length === 0 && !snap.running) {
    verdict = 'NEVER STARTED';
  } else if (restartBlockedEvents > 0 && !snap.serviceActive) {
    verdict = 'RESTART BLOCKED';
  } else if (timeoutEvents > 0 && !snap.running) {
    verdict = 'STOPPED';
  } else if (!snap.running || !snap.serviceActive) {
    const recentRestart = all.some(
      (h) =>
        h.eventType === 'RESTARTED' &&
        now - h.wallClock < GAP_THRESHOLD_MS * 2
    );
    if (recentRestart && missed === 0) {
      verdict = snap.serviceActive ? 'PROVEN RUNNING' : 'STOPPED';
    } else if (missed > 0 || longestGapMs > GAP_THRESHOLD_MS || restartedEvents > 0) {
      verdict = 'GAPS DETECTED';
    } else {
      verdict = 'STOPPED';
    }
  } else {
    const stale =
      lastHeartbeatAgeMs != null && lastHeartbeatAgeMs > GAP_THRESHOLD_MS;
    if (stale || missed > 0 || longestGapMs > GAP_THRESHOLD_MS) {
      verdict = 'GAPS DETECTED';
    } else if (beatsReceived > 0 || (snap.totalHeartbeats ?? 0) > 0) {
      verdict = 'PROVEN RUNNING';
    } else {
      // Running, but no real heartbeat has arrived yet: nothing is proven.
      verdict = 'WAITING FOR FIRST BEAT';
    }
  }

  return {
    beatsReceived: Math.max(beatsReceived, snap.totalHeartbeats ?? 0),
    beatsExpected,
    missed,
    longestGapMs,
    lastHeartbeatAgeMs,
    restartedEvents,
    timeoutEvents,
    restartBlockedEvents,
    batterySamples,
    verdict,
  };
}

/**
 * Pure helper used by unit tests: build a synthetic JobSnapshot from records.
 */
export function snapshotFromLog(
  records: HeartbeatRecord[],
  opts: Partial<JobSnapshot> = {}
): JobSnapshot {
  const last = records[records.length - 1];
  return {
    jobId: opts.jobId ?? last?.jobId ?? null,
    jobKind: opts.jobKind ?? 'counter',
    running: opts.running ?? false,
    startWallClock: opts.startWallClock ?? records[0]?.wallClock ?? null,
    stepLabel: opts.stepLabel ?? last?.stepLabel ?? 'Idle',
    counterValue: opts.counterValue ?? last?.counterValue ?? 0,
    serviceActive: opts.serviceActive ?? false,
    heartbeats: records,
    seq: opts.seq,
    lastHeartbeatWall: opts.lastHeartbeatWall,
    totalHeartbeats: opts.totalHeartbeats,
    firstWallClock: opts.firstWallClock,
    lastWallClock: opts.lastWallClock,
    longestGapMs: opts.longestGapMs,
    restartCount: opts.restartCount,
    timeoutCount: opts.timeoutCount,
    blockReason: opts.blockReason,
  };
}

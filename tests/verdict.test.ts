/**
 * Stage 6.1 unit tests — verdict / gap logic
 */
import {
  computeEvidence,
  snapshotFromLog,
  HEARTBEAT_INTERVAL_MS,
  GAP_THRESHOLD_MS,
} from '../src/background/verdict';
import type { HeartbeatRecord } from '../src/background/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

function hb(
  overrides: Partial<HeartbeatRecord> & Pick<HeartbeatRecord, 'seq' | 'wallClock' | 'eventType'>
): HeartbeatRecord {
  return {
    jobId: 'job-1',
    elapsedRealtime: overrides.wallClock,
    batteryPercent: 80,
    stepLabel: overrides.stepLabel ?? 'Counting · 1',
    counterValue: 1,
    ...overrides,
  };
}

console.log('=== verdict tests ===');
console.log(`HEARTBEAT_INTERVAL_MS=${HEARTBEAT_INTERVAL_MS} GAP_THRESHOLD_MS=${GAP_THRESHOLD_MS}`);

{
  const snap = snapshotFromLog([], { running: false, serviceActive: false, startWallClock: null });
  const e = computeEvidence(snap, 10_000);
  assert(e.verdict === 'NEVER STARTED', 'empty log → NEVER STARTED');
}

{
  const t0 = 1_000_000;
  const records: HeartbeatRecord[] = [];
  for (let i = 0; i < 6; i++) {
    records.push(hb({ seq: i + 1, wallClock: t0 + i * HEARTBEAT_INTERVAL_MS, eventType: 'HEARTBEAT', stepLabel: `Counting · ${i + 1}`, counterValue: i + 1 }));
  }
  const snap = snapshotFromLog(records, { running: true, serviceActive: true, startWallClock: t0, stepLabel: 'Counting · 6' });
  const now = t0 + 5 * HEARTBEAT_INTERVAL_MS + 500;
  const e = computeEvidence(snap, now);
  assert(e.verdict === 'PROVEN RUNNING', 'steady heartbeats → PROVEN RUNNING');
  assert(e.missed === 0, 'no missed beats');
}

{
  const t0 = 2_000_000;
  const records: HeartbeatRecord[] = [
    hb({ seq: 1, wallClock: t0, eventType: 'HEARTBEAT' }),
    hb({ seq: 2, wallClock: t0 + 5000, eventType: 'HEARTBEAT' }),
    hb({ seq: 3, wallClock: t0 + 10000, eventType: 'HEARTBEAT' }),
  ];
  const snap = snapshotFromLog(records, { running: true, serviceActive: true, startWallClock: t0 });
  const e = computeEvidence(snap, t0 + 10000 + 60_000);
  assert(e.verdict === 'GAPS DETECTED', 'stale last heartbeat → GAPS DETECTED');
}

{
  const t0 = 3_000_000;
  const records: HeartbeatRecord[] = [
    hb({ seq: 1, wallClock: t0, eventType: 'HEARTBEAT' }),
    hb({ seq: 2, wallClock: t0 + 5000, eventType: 'HEARTBEAT' }),
    hb({ seq: 3, wallClock: t0 + 5000 + 45_000, eventType: 'RESTARTED', gapMs: 45_000 }),
    hb({ seq: 4, wallClock: t0 + 5000 + 45_000 + 5000, eventType: 'HEARTBEAT' }),
  ];
  const snap = snapshotFromLog(records, { running: true, serviceActive: true, startWallClock: t0 });
  const e = computeEvidence(snap, t0 + 5000 + 45_000 + 5000 + 500);
  assert(e.verdict === 'GAPS DETECTED', 'restart with 45s gap → GAPS DETECTED');
  assert(e.restartedEvents === 1, 'one RESTARTED event');
}

{
  const t0 = 4_000_000;
  const records: HeartbeatRecord[] = [
    hb({ seq: 1, wallClock: t0, eventType: 'STARTED' }),
    hb({ seq: 2, wallClock: t0 + 5000, eventType: 'HEARTBEAT' }),
    hb({ seq: 3, wallClock: t0 + 10000, eventType: 'TIMEOUT' }),
  ];
  const snap = snapshotFromLog(records, { running: false, serviceActive: false, startWallClock: t0 });
  const e = computeEvidence(snap, t0 + 15000);
  assert(e.verdict === 'STOPPED', 'TIMEOUT → STOPPED');
  assert(e.timeoutEvents === 1, 'one TIMEOUT');
}

{
  const t0 = 5_000_000;
  const records: HeartbeatRecord[] = [
    hb({ seq: 1, wallClock: t0, eventType: 'STARTED' }),
    hb({ seq: 100, wallClock: t0 + 600_000, eventType: 'SUMMARY', heartbeatCount: 120, firstWall: t0 + 5000, lastWall: t0 + 600_000, windowStartWall: t0, windowEndWall: t0 + 600_000 }),
    hb({ seq: 101, wallClock: t0 + 605_000, eventType: 'HEARTBEAT' }),
    hb({ seq: 102, wallClock: t0 + 610_000, eventType: 'HEARTBEAT' }),
  ];
  const snap = snapshotFromLog(records, { running: true, serviceActive: true, startWallClock: t0, totalHeartbeats: 122 });
  const e = computeEvidence(snap, t0 + 610_000 + 500);
  assert(e.verdict === 'PROVEN RUNNING', 'SUMMARY + recent detail → PROVEN RUNNING');
  assert(e.beatsReceived >= 120, 'SUMMARY heartbeatCount counted');
}

{
  const t0 = 6_000_000;
  const records: HeartbeatRecord[] = [
    hb({ seq: 1, wallClock: t0, eventType: 'STARTED' }),
    hb({ seq: 2, wallClock: t0 + 1000, eventType: 'RESTART_BLOCKED', stepLabel: 'Blocked' }),
  ];
  const snap = snapshotFromLog(records, { running: false, serviceActive: false, startWallClock: t0, blockReason: 'ForegroundServiceStartNotAllowedException' });
  const e = computeEvidence(snap, t0 + 5000);
  assert(e.verdict === 'RESTART BLOCKED', 'RESTART_BLOCKED → RESTART BLOCKED');
  assert(e.restartBlockedEvents === 1, 'one RESTART_BLOCKED');
}

{
  const t0 = 7_000_000;
  const records: HeartbeatRecord[] = [hb({ seq: 1, wallClock: t0, eventType: 'HEARTBEAT' })];
  const snap = snapshotFromLog(records, { running: true, serviceActive: false, startWallClock: t0, lastHeartbeatWall: t0 });
  const e = computeEvidence(snap, t0 + 120_000);
  assert(e.verdict !== 'PROVEN RUNNING', 'stale running=true must not yield PROVEN RUNNING');
}

{
  const t0 = 8_000_000;
  const records: HeartbeatRecord[] = [
    hb({ seq: 1, wallClock: t0, eventType: 'HEARTBEAT' }),
    hb({ seq: 2, wallClock: t0 + 30_000, eventType: 'RESTARTED', gapMs: 25_000 }),
    hb({ seq: 3, wallClock: t0 + 35_000, eventType: 'HEARTBEAT' }),
  ];
  const snap = snapshotFromLog(records, { running: true, serviceActive: true, startWallClock: t0 });
  const e = computeEvidence(snap, t0 + 35_000 + 1000);
  assert(e.verdict === 'GAPS DETECTED' || e.verdict === 'PROVEN RUNNING', 'restart+short post-gap yields GAPS or PROVEN');
  assert(e.restartedEvents === 1, 'restart counted');
}

{
  // A 185 s stall that was later rolled into an evenly spread SUMMARY must still show,
  // because the native service reports the true longest gap between real heartbeats.
  const t0 = 9_000_000;
  const records: HeartbeatRecord[] = [
    hb({ seq: 1, wallClock: t0, eventType: 'STARTED' }),
    hb({ seq: 100, wallClock: t0 + 600_000, eventType: 'SUMMARY', heartbeatCount: 120, firstWall: t0 + 5000, lastWall: t0 + 600_000, windowStartWall: t0, windowEndWall: t0 + 600_000 }),
    hb({ seq: 101, wallClock: t0 + 605_000, eventType: 'HEARTBEAT' }),
    hb({ seq: 102, wallClock: t0 + 610_000, eventType: 'HEARTBEAT' }),
  ];
  const snap = snapshotFromLog(records, { running: true, serviceActive: true, startWallClock: t0, totalHeartbeats: 122, longestGapMs: 185_000 });
  const e = computeEvidence(snap, t0 + 610_000 + 500);
  assert(e.verdict === 'GAPS DETECTED', 'native longest gap of 185 s inside a SUMMARY window → GAPS DETECTED');
  assert(e.longestGapMs === 185_000, 'longest gap reported from the native service');
}

{
  // Service is running and looks fresh, but no real heartbeat has arrived yet.
  const t0 = 9_500_000;
  const records: HeartbeatRecord[] = [hb({ seq: 1, wallClock: t0, eventType: 'STARTED' })];
  const snap = snapshotFromLog(records, { running: true, serviceActive: true, startWallClock: t0, lastHeartbeatWall: t0, totalHeartbeats: 0 });
  const e = computeEvidence(snap, t0 + 2000);
  assert(e.verdict === 'WAITING FOR FIRST BEAT', 'no real heartbeat yet → WAITING FOR FIRST BEAT, not PROVEN RUNNING');
}

console.log('=== all verdict tests passed ===');

# EVIDENCE — Stage 6.1 Background Proof

## What counts as evidence
Only native heartbeat records written by `BackgroundJobService` (JSONL log + prefs totals). UI timers and notification chronometers are display aids, not evidence.

## Verdicts
- PROVEN RUNNING — fresh heartbeats, serviceActive from live timestamp
- GAPS DETECTED — missed intervals / long gaps / stale last beat
- STOPPED — user stop or OS TIMEOUT
- NEVER STARTED — empty log, never ran
- RESTART BLOCKED — startForeground threw ForegroundServiceStartNotAllowedException (Android 12+)

## Log retention
Append-only JSON Lines. SUMMARY ~every 10 minutes; detailed HEARTBEAT lines older than the window are pruned in batch. Snapshot bridge reads a bounded tail only.

## Device procedure
See `scripts/device-test-background-proof.md`.

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 6 — adaptive elapsed formatting from persisted start time.
 * Units: 42s, 3m 05s, 1h 04m 12s, 2d 3h 10m
 */

/**
 * Format elapsed milliseconds into adaptive human units.
 */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${pad2(minutes)}m`;
  }
  if (hours > 0) {
    return `${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${pad2(seconds)}s`;
  }
  return `${seconds}s`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Derive elapsed ms from a persisted start wall-clock and "now".
 */
export function elapsedFromStart(
  startWallClock: number | null,
  now: number = Date.now()
): number {
  if (startWallClock == null || !Number.isFinite(startWallClock)) return 0;
  return Math.max(0, now - startWallClock);
}

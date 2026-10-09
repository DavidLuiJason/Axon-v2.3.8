/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 6 — Background Execution Proof public API.
 */

export type {
  JobKind,
  HeartbeatEventType,
  HeartbeatRecord,
  JobSnapshot,
  BackgroundCapabilities,
  StartJobOptions,
  BackgroundExecutionAdapter,
} from './types';

export { formatElapsed, elapsedFromStart } from './elapsedFormat';
export {
  computeEvidence,
  snapshotFromLog,
  HEARTBEAT_INTERVAL_MS,
  GAP_THRESHOLD_MS,
  type Verdict,
  type EvidenceStats,
} from './verdict';
export { getBackgroundAdapter, createNativeBridgeAdapter } from './nativeBridge';
export { createWebFallbackAdapter } from './webFallbackAdapter';

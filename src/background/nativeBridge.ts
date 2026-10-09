/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stage 6 — Capacitor native bridge to BackgroundJobs plugin.
 * Falls back to web adapter when the plugin is unavailable.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BackgroundCapabilities,
  BackgroundExecutionAdapter,
  JobSnapshot,
  StartJobOptions,
} from './types';
import { createWebFallbackAdapter } from './webFallbackAdapter';

interface BackgroundJobsPlugin {
  getCapabilities(): Promise<BackgroundCapabilities>;
  startJob(opts: { kind: string; steps?: string[] }): Promise<{ jobId: string }>;
  stopJob(): Promise<void>;
  getSnapshot(): Promise<JobSnapshot>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  openBatteryOptimizationSettings(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  exportDiagnostics(): Promise<{ json: string }>;
  addListener(
    eventName: 'snapshot',
    listenerFunc: (snap: JobSnapshot) => void
  ): Promise<{ remove: () => void }>;
}

const BackgroundJobs = registerPlugin<BackgroundJobsPlugin>('BackgroundJobs');

function getPlugin(): BackgroundJobsPlugin | null {
  try {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }
    return BackgroundJobs;
  } catch {
    return null;
  }
}

export function createNativeBridgeAdapter(): BackgroundExecutionAdapter {
  const plugin = getPlugin();
  if (!plugin) {
    return createWebFallbackAdapter();
  }

  const listeners = new Set<(s: JobSnapshot) => void>();
  let removeNative: (() => void) | null = null;

  async function ensureNativeSub() {
    if (removeNative) return;
    try {
      const handle = await plugin!.addListener('snapshot', (snap) => {
        listeners.forEach((cb) => cb(snap));
      });
      removeNative = () => handle.remove();
    } catch {
      // Plugin may not support listeners in all builds; poll instead.
    }
  }

  return {
    async getCapabilities(): Promise<BackgroundCapabilities> {
      try {
        return await plugin.getCapabilities();
      } catch {
        return {
          canRunInBackground: false,
          platform: 'web-fallback',
          reason: 'BackgroundJobs plugin call failed; foreground only.',
        };
      }
    },

    async startJob(opts: StartJobOptions): Promise<{ jobId: string }> {
      await ensureNativeSub();
      return plugin.startJob({
        kind: opts.kind,
        steps: opts.steps,
      });
    },

    async stopJob(): Promise<void> {
      await plugin.stopJob();
    },

    async getSnapshot(): Promise<JobSnapshot> {
      return plugin.getSnapshot();
    },

    subscribe(cb: (s: JobSnapshot) => void): () => void {
      listeners.add(cb);
      void ensureNativeSub();
      void plugin.getSnapshot().then((s) => cb(s)).catch(() => {});
      // Light poll as safety net if native events miss
      const poll = setInterval(() => {
        void plugin.getSnapshot().then((s) => {
          listeners.forEach((l) => l(s));
        }).catch(() => {});
      }, 3000);
      return () => {
        listeners.delete(cb);
        clearInterval(poll);
        if (listeners.size === 0 && removeNative) {
          removeNative();
          removeNative = null;
        }
      };
    },

    async requestNotificationPermission(): Promise<boolean> {
      try {
        const r = await plugin.requestNotificationPermission();
        return !!r.granted;
      } catch {
        return false;
      }
    },

    async openBatteryOptimizationSettings(): Promise<void> {
      await plugin.openBatteryOptimizationSettings();
    },

    async isIgnoringBatteryOptimizations(): Promise<boolean> {
      try {
        const r = await plugin.isIgnoringBatteryOptimizations();
        return !!r.ignoring;
      } catch {
        return false;
      }
    },

    async exportDiagnostics(): Promise<string> {
      try {
        const r = await plugin.exportDiagnostics();
        return r.json;
      } catch (e) {
        return JSON.stringify({ error: String(e) });
      }
    },
  };
}

/** Singleton adapter chosen at first use. */
let _adapter: BackgroundExecutionAdapter | null = null;

export function getBackgroundAdapter(): BackgroundExecutionAdapter {
  if (!_adapter) {
    _adapter = createNativeBridgeAdapter();
  }
  return _adapter;
}

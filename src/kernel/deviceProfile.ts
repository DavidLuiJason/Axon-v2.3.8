/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON execution kernel: Device Profile.
 * Live readings only. A reading that is not available is "unknown", never a guess.
 * No device model, RAM size or ratio is built into this file.
 */

import type { ResourceNeeds } from './types';

export type Reading<T> = { known: true; value: T } | { known: false };

export interface DeviceProfile {
  takenAt: number;
  memoryGb: Reading<number>;
  cpuCores: Reading<number>;
  /** Free space inside the storage this app may use (quota minus usage). */
  storageFreeBytes: Reading<number>;
  storageQuotaBytes: Reading<number>;
  batteryPercent: Reading<number>;
  charging: Reading<boolean>;
}

/** Where readings come from. The browser reader is the default; tests inject their own. */
export interface DeviceReader {
  memoryGb(): number | undefined;
  cpuCores(): number | undefined;
  storage(): Promise<{ usage?: number; quota?: number } | undefined>;
  battery(): Promise<{ level: number; charging: boolean } | undefined>;
}

interface NavigatorLike {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> };
  getBattery?: () => Promise<{ level: number; charging: boolean }>;
}

export function browserDeviceReader(nav?: NavigatorLike): DeviceReader {
  const n: NavigatorLike | undefined =
    nav ?? (typeof navigator !== 'undefined' ? (navigator as unknown as NavigatorLike) : undefined);
  return {
    memoryGb: () => n?.deviceMemory,
    cpuCores: () => n?.hardwareConcurrency,
    storage: async () => (n?.storage?.estimate ? n.storage.estimate() : undefined),
    battery: async () => (n?.getBattery ? n.getBattery() : undefined),
  };
}

const UNKNOWN = { known: false } as const;

function positive(value: unknown): Reading<number> {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? { known: true, value }
    : UNKNOWN;
}

function nonNegative(value: unknown): Reading<number> {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? { known: true, value }
    : UNKNOWN;
}

async function safely<T>(read: () => T | Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/** Takes one live reading of the device. Never throws. */
export async function readDeviceProfile(
  reader: DeviceReader = browserDeviceReader(),
  now: () => number = Date.now
): Promise<DeviceProfile> {
  const memory = await safely(() => reader.memoryGb());
  const cores = await safely(() => reader.cpuCores());
  const storage = await safely(() => reader.storage());
  const battery = await safely(() => reader.battery());

  const quota = nonNegative(storage?.quota);
  const usage = nonNegative(storage?.usage);
  const free: Reading<number> =
    quota.known && usage.known && quota.value >= usage.value
      ? { known: true, value: quota.value - usage.value }
      : UNKNOWN;

  const level =
    typeof battery?.level === 'number' && battery.level >= 0 && battery.level <= 1
      ? { known: true as const, value: Math.round(battery.level * 100) }
      : UNKNOWN;

  return {
    takenAt: now(),
    memoryGb: positive(memory),
    cpuCores: positive(cores),
    storageFreeBytes: free,
    storageQuotaBytes: quota,
    batteryPercent: level,
    charging:
      typeof battery?.charging === 'boolean'
        ? { known: true, value: battery.charging }
        : UNKNOWN,
  };
}

export interface SimulatedSpec {
  memoryGb?: number;
  cpuCores?: number;
  storageFreeBytes?: number;
  storageQuotaBytes?: number;
  batteryPercent?: number;
  charging?: boolean;
  takenAt?: number;
}

/** Builds a profile from fixed numbers, for tests. A field left out is unknown. */
export function simulatedProfile(spec: SimulatedSpec): DeviceProfile {
  const known = <T,>(v: T | undefined): Reading<T> =>
    v === undefined ? UNKNOWN : { known: true, value: v };
  return {
    takenAt: spec.takenAt ?? 0,
    memoryGb: known(spec.memoryGb),
    cpuCores: known(spec.cpuCores),
    storageFreeBytes: known(spec.storageFreeBytes),
    storageQuotaBytes: known(spec.storageQuotaBytes),
    batteryPercent: known(spec.batteryPercent),
    charging: known(spec.charging),
  };
}

export interface ResourceCheck {
  ok: boolean;
  /** Needs the device does not meet right now, in plain words. */
  blockers: string[];
  /** Needs that could not be checked because the reading is unknown. */
  unverified: string[];
  /** What the user could do about the blockers. */
  options: string[];
}

/** Compares declared needs with a live profile. Unknown readings never block. */
export function checkResources(profile: DeviceProfile, needs: ResourceNeeds): ResourceCheck {
  const blockers: string[] = [];
  const unverified: string[] = [];
  const options: string[] = [];

  if (needs.minMemoryGb !== undefined) {
    if (!profile.memoryGb.known) {
      unverified.push('memory could not be read');
    } else if (profile.memoryGb.value < needs.minMemoryGb) {
      blockers.push(
        `needs about ${needs.minMemoryGb} GB of memory; this device reports ${profile.memoryGb.value} GB`
      );
      options.push('use a lighter mode if the tool offers one');
    }
  }

  if (needs.minFreeStorageBytes !== undefined) {
    if (!profile.storageFreeBytes.known) {
      unverified.push('free storage could not be read');
    } else if (profile.storageFreeBytes.value < needs.minFreeStorageBytes) {
      blockers.push(
        `needs ${needs.minFreeStorageBytes} bytes of free storage; ${profile.storageFreeBytes.value} bytes are free`
      );
      options.push('free up storage or remove a pack you no longer use');
    }
  }

  if (needs.minBatteryPercent !== undefined) {
    const chargingNow = profile.charging.known && profile.charging.value;
    if (!profile.batteryPercent.known) {
      unverified.push('battery level could not be read');
    } else if (!chargingNow && profile.batteryPercent.value < needs.minBatteryPercent) {
      blockers.push(
        `needs at least ${needs.minBatteryPercent}% battery or a charger; battery is at ${profile.batteryPercent.value}%`
      );
      options.push('plug in the charger or wait');
    }
  }

  return { ok: blockers.length === 0, blockers, unverified, options };
}

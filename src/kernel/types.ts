/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON execution kernel: contract types.
 * Capability -> Action -> Task -> Executor -> Result -> Evidence.
 * Types only. No behaviour lives here.
 */

/** How an action runs. */
export type ExecutionClass =
  | 'instant'
  | 'async'
  | 'background'
  | 'device'
  | 'network'
  | 'interactive';

/** How a running task can be stopped. */
export type CancelModel = 'immediate' | 'checkpoint' | 'none';

export type FieldType = 'string' | 'number' | 'boolean';

/** One input the action needs. `prompt` is the follow-up question when it is missing. */
export interface FieldSpec {
  name: string;
  type: FieldType;
  required: boolean;
  prompt: string;
}

/** Resources an action declares it needs. Every field is optional. */
export interface ResourceNeeds {
  minMemoryGb?: number;
  minFreeStorageBytes?: number;
  /** Ignored while the device is charging. */
  minBatteryPercent?: number;
}

/** Everything a running action may use. */
export interface TaskContext {
  taskId: string;
  signal: AbortSignal;
  now: () => number;
  /** Fraction between 0 and 1. Values outside are clamped. */
  reportProgress: (fraction: number) => void;
  /** Save data the action needs in order to resume after an interruption. */
  saveCheckpoint: (data: unknown) => void;
  /** Data saved by an earlier run of this task, or undefined on a first run. */
  restored: unknown;
  /** Throws CancelledError when a cancel was requested. Call it at safe points. */
  throwIfCancelled: () => void;
}

/** One operation, for example `text.count`. */
export interface ActionDef {
  /** Lowercase dotted id, for example `text.count`. */
  id: string;
  /** Id of the capability this action belongs to. */
  capabilityId: string;
  label: string;
  executionClass: ExecutionClass;
  inputFields: FieldSpec[];
  outputFields: { name: string; type: FieldType }[];
  resources: ResourceNeeds;
  cancel: CancelModel;
  /** Plain words: what proves this action really ran. */
  evidence: string;
  run: (input: Record<string, unknown>, ctx: TaskContext) => Promise<unknown>;
}

export type TaskState =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'INTERRUPTED';

export interface TaskCheckpoint {
  at: number;
  data: unknown;
}

export interface InterruptInfo {
  reason: string;
  resumable: boolean;
}

export interface TaskEvidence {
  at: number;
  event: string;
  detail?: string;
}

/** One run of an action. */
export interface Task {
  id: string;
  capabilityId: string;
  actionId: string;
  input: Record<string, unknown>;
  state: TaskState;
  /** 0 to 1, or null until the action reports progress. */
  progress: number | null;
  output?: unknown;
  error?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  checkpoint?: TaskCheckpoint;
  interrupt?: InterruptInfo;
  evidence: TaskEvidence[];
}

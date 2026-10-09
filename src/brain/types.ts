/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Brain: contracts.
 * One Brain. Every request passes through it, whichever place it comes from
 * (Chat, Web or Apps). Sources of answers plug in as providers.
 */

/** The place in the app the request comes from. */
export type Place = 'chat' | 'web' | 'apps';

export interface BrainRequest {
  text: string;
  place: Place;
}

export interface BrainReply {
  content: string;
  /** Id of the provider that produced this reply. Every reply names its source. */
  source: string;
  /** The kernel task behind the reply, when a task ran. */
  taskId?: string;
  leadParagraph?: string;
  planIntro?: string;
  planItems?: string[];
  hasSources?: boolean;
  suggestionPrompt?: string;
}

export interface SourceStatus {
  id: string;
  label: string;
  ready: boolean;
  note: string;
}

/** A source of answers. Providers are asked in order; the first to reply wins. */
export interface BrainProvider {
  id: string;
  label: string;
  status(): SourceStatus;
  /** True while the provider is waiting for the answer to a follow-up question. */
  holdsConversation(): boolean;
  /** Returns a reply, or null when the message is not for this provider. */
  handle(request: BrainRequest): Promise<BrainReply | null>;
}

/** A source that is planned but not built yet. Listed honestly, never faked. */
export interface PlannedSource {
  id: string;
  label: string;
}

/** One thing the local rules can run, written as data so new tools only add an entry. */
export interface CommandMatch {
  input: Record<string, unknown>;
  /** The input still missing, with the question to ask for it. Absent when complete. */
  ask?: { field: string; question: string };
}

export interface CommandDef {
  id: string;
  actionId: string;
  title: string;
  /** Example phrasings shown when the owner asks what AXON can do. */
  examples: string[];
  /** Recognises a message, or returns null when it is not this command. */
  match(message: string): CommandMatch | null;
  /** Completes the awaited field from the answer to a follow-up question. */
  fill(partial: Record<string, unknown>, field: string, answer: string): Record<string, unknown>;
  /** Plain-words description of a finished result. */
  describe(output: unknown, input: Record<string, unknown>): string;
}

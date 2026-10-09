/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Brain: the router.
 * Sends a request to the provider that holds an open follow-up question first,
 * then to each provider in order, and finally to the honest fallback.
 */

import type {
  BrainProvider,
  BrainReply,
  BrainRequest,
  PlannedSource,
  SourceStatus,
} from './types';

export const PLANNED_SOURCES: PlannedSource[] = [
  { id: 'api-keys', label: 'your API keys' },
  { id: 'web-search', label: 'web search' },
  { id: 'ai-apps', label: 'other AI apps and sites' },
  { id: 'local-model', label: 'a local model' },
  { id: 'local-files', label: 'your local files' },
];

export interface BrainSources {
  connected: SourceStatus[];
  planned: PlannedSource[];
}

export function createBrain(
  providers: BrainProvider[],
  fallback: BrainProvider,
  planned: PlannedSource[] = PLANNED_SOURCES
) {
  async function tryProvider(
    provider: BrainProvider,
    request: BrainRequest
  ): Promise<BrainReply | null> {
    try {
      return await provider.handle(request);
    } catch {
      // A broken source must never break the Brain: move on to the next one.
      return null;
    }
  }

  return {
    async ask(request: BrainRequest): Promise<BrainReply> {
      if (request.text.trim() !== '') {
        const holder = providers.find((p) => p.holdsConversation());
        if (holder) {
          const reply = await tryProvider(holder, request);
          if (reply) return reply;
        }
        for (const provider of providers) {
          const reply = await tryProvider(provider, request);
          if (reply) return reply;
        }
      }
      const last = await tryProvider(fallback, request);
      return (
        last ?? {
          content: 'I could not produce an answer to that.',
          source: fallback.id,
        }
      );
    },

    sources(): BrainSources {
      return {
        connected: [...providers, fallback].map((p) => p.status()),
        planned: [...planned],
      };
    },
  };
}

export type Brain = ReturnType<typeof createBrain>;

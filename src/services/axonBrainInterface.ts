/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AXON Brain Interface Boundary
 *
 * Strict architectural abstraction separating the AXON visual/functional body
 * from the Brain. Every request from the screens passes through here into the
 * one Brain, which asks its sources in order and always names the source that
 * answered.
 *
 * NOTE: No network request is made here. Sources that need the network (web
 * search, API keys, other AI apps) are not connected yet.
 */

import { ChatMessage } from '../types';
import { getAxonBrain } from '../brain';

export interface BrainStatus {
  isOnline: boolean;
  phase: string;
  version: string;
}

export const getAxonBrainStatus = (): BrainStatus => {
  return {
    isOnline: false,
    phase: 'Foundation Body (Phase 1)',
    version: '1.0.0-foundation',
  };
};

/**
 * Dispatches a user query to the AXON Brain and returns its reply as a chat message.
 */
export async function sendQueryToAxonBoundary(
  userInput: string
): Promise<ChatMessage> {
  const reply = await getAxonBrain().ask({ text: userInput, place: 'chat' });
  const at = Date.now();
  return {
    id: `axon-${at}`,
    role: 'assistant',
    content: reply.content,
    leadParagraph: reply.leadParagraph,
    planIntro: reply.planIntro,
    planItems: reply.planItems,
    hasSources: reply.hasSources ?? false,
    suggestionPrompt: reply.suggestionPrompt,
    source: reply.source,
    taskId: reply.taskId,
    timestamp: at,
  };
}

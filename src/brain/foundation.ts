/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The honest fallback of the Brain. It answers when no source can, says
 * plainly that the intelligence layer is not online yet, and points to what
 * AXON can really do. It never pretends to understand.
 */

import type { BrainProvider, BrainReply } from './types';

const SOURCE = 'foundation';

export function createFoundation(): BrainProvider {
  return {
    id: SOURCE,
    label: 'AXON foundation',

    status() {
      return {
        id: SOURCE,
        label: 'AXON foundation',
        ready: true,
        note: 'honest fallback; no intelligence connected',
      };
    },

    holdsConversation: () => false,

    async handle(request): Promise<BrainReply> {
      // A brief settling pause, without any network request.
      await new Promise((resolve) => setTimeout(resolve, 350));

      const lower = request.text.trim().toLowerCase();

      if (lower.includes('axon ui') || lower.includes('layout') || lower.includes('describe axon')) {
        const items = [
          'Fixed Top Controls: Menu trigger, anchored AXON brand selector, and contextual overflow.',
          'Independent Scrolling Viewport: Generous typography for clean discourse without heavy card-in-card containers.',
          'Anchored Adaptive Composer: Persistent bottom bubble holding the Chat / Web / Apps switch, audio controls, and unified voice/send transitions.',
        ];
        const lead =
          'The AXON interface is built upon a calm, minimal foundation designed to eliminate scattered dashboard clutter. It anchors three persistent interface zones:';
        return {
          content: `${lead}\n\n1. ${items[0]}\n2. ${items[1]}\n3. ${items[2]}`,
          source: SOURCE,
          leadParagraph: lead,
          planItems: items,
          hasSources: true,
          suggestionPrompt:
            'Would you like to explore the navigation drawer structure or inspect the persistent composer tokens?',
        };
      }

      const lead =
        "I'm here, but AXON's intelligence layer isn't online yet. We're building the environment first. Once the AXON brain is connected, I'll be able to process and respond to your requests directly.";
      return {
        content: lead,
        source: SOURCE,
        leadParagraph: lead,
        planIntro: 'During this foundation phase, the body and design system are fully active:',
        planItems: [
          'Responsive anchored framing and layout stability.',
          'Independent conversation stream and typography.',
          'Persistent adaptive composer with the Chat / Web / Apps switch.',
          'Navigation drawer hierarchy and system options.',
        ],
        hasSources: false,
        suggestionPrompt: 'Say "what can you do" to see what I can run right now.',
      };
    },
  };
}

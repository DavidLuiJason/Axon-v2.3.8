/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  badge?: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  leadParagraph?: string;
  planIntro?: string;
  planItems?: string[];
  hasSources?: boolean;
  suggestionPrompt?: string;
  /** Which Brain source produced this reply (assistant messages only). */
  source?: string;
  /** The kernel task behind this reply, when a task ran. */
  taskId?: string;
  timestamp: number;
}

export interface RecentChat {
  id: string;
  title: string;
  timestamp: string;
  active?: boolean;
  messages: ChatMessage[];
}

export type ViewMode = 'welcome' | 'conversation';

export type AxonMode = 'chat' | 'web' | 'apps';

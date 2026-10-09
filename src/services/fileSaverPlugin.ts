/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TypeScript wrapper for native Android FileSaver Capacitor plugin.
 * Includes a safe web fallback.
 */

import { registerPlugin } from '@capacitor/core';

export interface SaveToDownloadsOptions {
  fileName: string;
  mimeType: string;
  base64Data: string;
}

export interface SaveToDownloadsResult {
  success: boolean;
  fileName: string;
  location: string;
  path: string;
}

export interface FileSaverPlugin {
  saveToDownloads(options: SaveToDownloadsOptions): Promise<SaveToDownloadsResult>;
}

export const FileSaver = registerPlugin<FileSaverPlugin>('FileSaver', {
  web: () => ({
    async saveToDownloads() {
      throw new Error('FileSaver native plugin is not available on web; use browser download fallback.');
    },
  }),
});

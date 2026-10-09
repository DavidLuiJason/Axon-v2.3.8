/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared file saving and export service.
 * - On native Android (Capacitor): writes directly to public Downloads folder under Downloads/Axon
 *   via the custom FileSaver plugin (MediaStore on Android 10+, public Downloads on Android 9-).
 *   Never opens the share sheet automatically.
 *   Provides a secondary `share()` callback if the user chooses to share.
 * - On web (AI Studio preview): triggers standard browser file download.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileSaver } from './fileSaverPlugin';

export interface SaveFileResult {
  success: boolean;
  method?: 'native-downloads' | 'browser-download';
  fileName?: string;
  location?: string;
  message?: string;
  path?: string;
  error?: string;
  canShare?: boolean;
  share?: () => Promise<void>;
}

/**
 * Converts a Blob or UTF-8 string to a base64 encoded string.
 */
async function toBase64(data: Blob | string, mimeType: string): Promise<string> {
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const commaIndex = result.indexOf(',');
        resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
      } else {
        reject(new Error('Failed to read data as base64 string'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves a file:
 * - On native Android: saves directly to Downloads/Axon via FileSaver plugin.
 *   Does NOT open the share menu.
 * - On web: uses browser download.
 */
export async function saveFile(
  fileName: string,
  data: Blob | string,
  mimeType = 'application/octet-stream'
): Promise<SaveFileResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      const base64Data = await toBase64(data, mimeType);

      // Save directly to public Downloads/Axon folder
      const downloadResult = await FileSaver.saveToDownloads({
        fileName,
        mimeType,
        base64Data,
      });

      const finalFileName = downloadResult.fileName || fileName;
      const location = downloadResult.location || `Downloads/Axon/${finalFileName}`;
      const message = `Saved to ${location}`;

      // Secondary share action: user can optionally tap "Share"
      const shareAction = async () => {
        try {
          // Write to cache for FileProvider sharing
          const cacheResult = await Filesystem.writeFile({
            path: finalFileName,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true,
          });
          await Share.share({
            title: finalFileName,
            url: cacheResult.uri,
            dialogTitle: 'Share or send file',
          });
        } catch (shareErr: any) {
          console.warn('Manual share failed:', shareErr);
        }
      };

      return {
        success: true,
        method: 'native-downloads',
        fileName: finalFileName,
        location,
        message,
        path: downloadResult.path,
        canShare: true,
        share: shareAction,
      };
    } else {
      // Browser environment: normal file download
      const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setTimeout(() => {
        try {
          URL.revokeObjectURL(downloadUrl);
        } catch {
          // ignore cleanup error
        }
      }, 1500);

      return {
        success: true,
        method: 'browser-download',
        fileName,
        message: `Saved / downloaded: ${fileName}`,
      };
    }
  } catch (err: any) {
    console.error(`saveFile failed for "${fileName}":`, err);
    return {
      success: false,
      fileName,
      error: err?.message || String(err),
      message: `Failed to save ${fileName}: ${err?.message || String(err)}`,
    };
  }
}

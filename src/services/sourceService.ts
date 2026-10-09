/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { RecentChat } from '../types';
import { saveFile, SaveFileResult } from './saveFile';

export interface SourceNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: number;
  children?: SourceNode[];
}

export interface SourceFileRecord {
  path: string;
  name: string;
  content: string;
  size?: number;
  mtime?: number;
}

// Fallback glob in case direct API is unreachable
const fallbackGlob = import.meta.glob(
  [
    '/**/*.{ts,tsx,js,jsx,json,html,css,example,gitignore,java,xml,md,sh,gradle,yml,yaml,properties}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/.git/**',
    '!**/bun.lock',
    '!**/build/**',
    '!**/.gradle/**',
  ],
  { query: '?raw', import: 'default', eager: false }
);

export async function fetchLiveSourceTree(): Promise<SourceNode[]> {
  try {
    const res = await fetch('/api/source/tree');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tree)) {
        return data.tree;
      }
    }
  } catch (err) {
    console.warn('API source tree fetch failed, falling back to glob', err);
  }

  // Fallback: build tree from import.meta.glob keys
  const paths = Object.keys(fallbackGlob).map((p) => p.replace(/^\//, ''));
  const rootNodes: SourceNode[] = [];

  for (const rawPath of paths) {
    const parts = rawPath.split('/');
    let currentLevel = rootNodes;
    let accumulatedPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (isFile) {
        currentLevel.push({
          name: part,
          path: accumulatedPath,
          type: 'file',
        });
      } else {
        let dir = currentLevel.find((n) => n.type === 'directory' && n.name === part);
        if (!dir) {
          dir = {
            name: part,
            path: accumulatedPath,
            type: 'directory',
            children: [],
          };
          currentLevel.push(dir);
        }
        currentLevel = dir.children!;
      }
    }
  }

  return rootNodes;
}

export async function fetchLiveSourceFile(filePath: string): Promise<{ content: string; size?: number; mtime?: number }> {
  try {
    const res = await fetch(`/api/source/file?path=${encodeURIComponent(filePath)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.content === 'string') {
        return {
          content: data.content,
          size: typeof data.size === 'number' ? data.size : undefined,
          mtime: typeof data.mtime === 'number' ? data.mtime : undefined,
        };
      }
    }
  } catch (err) {
    console.warn(`API source file fetch failed for ${filePath}, attempting fallback`, err);
  }

  // Fallback: load from glob
  const normKey = filePath.startsWith('/') ? filePath : `/${filePath}`;
  const loader = fallbackGlob[normKey];
  if (loader) {
    const raw = (await loader()) as string;
    return {
      content: raw,
      size: new TextEncoder().encode(raw).length,
    };
  }

  throw new Error(`Unable to read file: ${filePath}`);
}

export async function fetchAllLiveFiles(): Promise<SourceFileRecord[]> {
  try {
    const res = await fetch('/api/source/all');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        return data.files;
      }
    }
  } catch (err) {
    console.warn('API source all files fetch failed, using glob fallback', err);
  }

  // Fallback: load all files through glob
  const records: SourceFileRecord[] = [];
  for (const [key, loader] of Object.entries(fallbackGlob)) {
    try {
      const content = (await loader()) as string;
      const cleanPath = key.replace(/^\//, '');
      records.push({
        path: cleanPath,
        name: cleanPath.split('/').pop() || cleanPath,
        content,
        size: new TextEncoder().encode(content).length,
      });
    } catch {
      // skip unreadable
    }
  }
  return records;
}

export interface ExportZipOptions {
  withUserData: boolean;
  recents: RecentChat[];
  userName: string;
  selectedModel: string;
  activeChatId: string | null;
}

export async function exportAsZip(options: ExportZipOptions): Promise<SaveFileResult> {
  const zip = new JSZip();
  const allFiles = await fetchAllLiveFiles();

  // Add source code files to the ZIP
  for (const file of allFiles) {
    // Avoid bundling build artifacts or system files
    if (file.path.startsWith('dist/') || file.path.startsWith('node_modules/')) {
      continue;
    }
    zip.file(file.path, file.content);
  }

  // Conditionally add user data
  if (options.withUserData) {
    const userDataFolder = zip.folder('user-data');
    if (userDataFolder) {
      const chatsPayload = {
        exportedAt: new Date().toISOString(),
        userName: options.userName,
        selectedModel: options.selectedModel,
        activeChatId: options.activeChatId,
        conversations: options.recents,
      };
      userDataFolder.file('conversations.json', JSON.stringify(chatsPayload, null, 2));

      const settingsPayload = {
        userName: options.userName,
        selectedModel: options.selectedModel,
        exportedAt: new Date().toISOString(),
        version: 'AXON 1.0 Foundation',
      };
      userDataFolder.file('settings.json', JSON.stringify(settingsPayload, null, 2));

      // Markdown summary of user chats
      let historyMd = `# AXON Conversation History\nExported: ${new Date().toLocaleString()}\nUser: ${options.userName}\n\n`;
      for (const chat of options.recents) {
        historyMd += `## ${chat.title}\n*Timestamp: ${chat.timestamp}*\n\n`;
        for (const msg of chat.messages) {
          historyMd += `### ${msg.role === 'user' ? options.userName : 'AXON'}\n${msg.content}\n\n`;
        }
        historyMd += `---\n\n`;
      }
      userDataFolder.file('conversation-history.md', historyMd);
    }
  }

  // Generate ZIP blob and trigger save / share
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = options.withUserData
    ? `axon-source-with-userdata-${timestamp}.zip`
    : `axon-source-code-${timestamp}.zip`;

  const result = await saveFile(filename, blob, 'application/zip');
  if (!result.success) {
    throw new Error(result.error || 'Failed to save ZIP archive');
  }
  return result;
}

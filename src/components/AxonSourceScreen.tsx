/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  Archive, 
  Search,
  X,
  FileJson,
  Layers,
  Code2
} from 'lucide-react';
import AxonLogo from './AxonLogo.jsx';
import { useChatSession, useSelectedModel, useUserName } from '../state/AxonStateContext';
import { 
  SourceNode, 
  fetchLiveSourceTree, 
  fetchLiveSourceFile, 
  exportAsZip 
} from '../services/sourceService';
import { saveFile } from '../services/saveFile';

interface AxonSourceScreenProps {
  onLogoClick: () => void;
}

export const AxonSourceScreen: React.FC<AxonSourceScreenProps> = ({
  onLogoClick,
}) => {
  // Stage 1C-ii: chat session data for export via state root
  const { recents, activeChatId } = useChatSession();
  // Stage 1C-iii: selectedModel via state root (export payload unchanged)
  const { selectedModel } = useSelectedModel();
  // Stage 1C-iv: userName via state root (export payload unchanged)
  const { userName } = useUserName();
  const [tree, setTree] = useState<SourceNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileMeta, setFileMeta] = useState<{ size?: number; mtime?: number } | null>(null);
  const fileContentRef = useRef<string>('');
  const selectedFilePathRef = useRef<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['src', 'src/components', 'src/services', 'src/tokens', 'src/types'])
  );
  const [filterQuery, setFilterQuery] = useState('');

  // Actions states
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Update check states
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<number>(Date.now());
  const previousSnapshotRef = useRef<Map<string, number | undefined>>(new Map());

  // Mobile layout switch
  const [mobileView, setMobileView] = useState<'tree' | 'viewer'>('tree');

  // Load initial tree
  const loadTree = async (isManualCheck = false) => {
    if (isManualCheck) {
      setIsCheckingUpdates(true);
    } else {
      setIsLoadingTree(true);
    }

    try {
      const liveTree = await fetchLiveSourceTree();
      setTree(liveTree);

      // Collect current snapshot of paths and modification times
      const currentSnapshot = new Map<string, number | undefined>();
      function traverse(nodes: SourceNode[]) {
        for (const node of nodes) {
          if (node.type === 'file') {
            currentSnapshot.set(node.path, node.mtime);
          } else if (node.children) {
            traverse(node.children);
          }
        }
      }
      traverse(liveTree);

      const hasKnownMtimes = Array.from(currentSnapshot.values()).some(
        (m) => typeof m === 'number'
      );

      if (isManualCheck) {
        let modifiedCount = 0;
        let addedCount = 0;
        let removedCount = 0;
        const prev = previousSnapshotRef.current;

        for (const [p, mtime] of currentSnapshot.entries()) {
          if (!prev.has(p)) {
            addedCount++;
          } else {
            const prevMtime = prev.get(p);
            if (
              typeof prevMtime === 'number' &&
              typeof mtime === 'number' &&
              prevMtime !== mtime
            ) {
              modifiedCount++;
            }
          }
        }
        for (const p of prev.keys()) {
          if (!currentSnapshot.has(p)) {
            removedCount++;
          }
        }

        // The currently open file is ALWAYS re-read on a manual check, and its text is compared with the previously shown text
        let activeFileContentChanged = false;
        const currentOpenPath = selectedFilePathRef.current;
        if (currentOpenPath) {
          try {
            const res = await fetchLiveSourceFile(currentOpenPath);
            if (res.content !== fileContentRef.current) {
              activeFileContentChanged = true;
              setFileContent(res.content);
              fileContentRef.current = res.content;
            }
            setFileMeta({ size: res.size, mtime: res.mtime });
          } catch (err) {
            console.error(`Failed to refresh open file ${currentOpenPath}`, err);
          }
        }

        const changesList: string[] = [];
        if (modifiedCount > 0) {
          changesList.push(`${modifiedCount} file${modifiedCount > 1 ? 's' : ''} modified`);
        }
        if (addedCount > 0) {
          changesList.push(`${addedCount} file${addedCount > 1 ? 's' : ''} added`);
        }
        if (removedCount > 0) {
          changesList.push(`${removedCount} file${removedCount > 1 ? 's' : ''} removed`);
        }
        if (activeFileContentChanged) {
          changesList.push('open file changed (content)');
        }

        if (changesList.length > 0) {
          setUpdateStatus(`Live source updated · ${changesList.join(', ')}`);
        } else if (!hasKnownMtimes) {
          setUpdateStatus('Modified times are not available here; checked the file list and the open file only.');
        } else {
          setUpdateStatus('No changes');
        }
        setLastCheckTime(Date.now());
        setTimeout(() => setUpdateStatus(null), 3500);
      } else {
        // Initial load: pick a default file to open (e.g. src/App.tsx)
        const defaultPath = 'src/App.tsx';
        loadFile(defaultPath);
      }

      previousSnapshotRef.current = currentSnapshot;
    } catch (err) {
      console.error('Failed to load source tree', err);
      if (isManualCheck) {
        setUpdateStatus('Unable to reach live source');
        setTimeout(() => setUpdateStatus(null), 3000);
      }
    } finally {
      setIsLoadingTree(false);
      setIsCheckingUpdates(false);
    }
  };

  useEffect(() => {
    loadTree(false);
  }, []);

  // Load specific file
  const loadFile = async (filePath: string) => {
    setIsLoadingFile(true);
    setSelectedFilePath(filePath);
    selectedFilePathRef.current = filePath;
    setMobileView('viewer');
    setIsDownloadMenuOpen(false);

    try {
      const res = await fetchLiveSourceFile(filePath);
      setFileContent(res.content);
      fileContentRef.current = res.content;
      setFileMeta({ size: res.size, mtime: res.mtime });
    } catch (err) {
      console.error(`Failed to load file ${filePath}`, err);
      const fallbackContent = `// Unable to inspect ${filePath}`;
      setFileContent(fallbackContent);
      fileContentRef.current = fallbackContent;
      setFileMeta(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Copy file content action
  const handleCopyContent = async () => {
    if (!fileContent) return;
    try {
      await navigator.clipboard.writeText(fileContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Download file action
  const handleDownloadFile = async (format: 'txt' | 'md') => {
    if (!selectedFilePath || !fileContent) return;
    setIsDownloadMenuOpen(false);

    const baseName = selectedFilePath.split('/').pop() || 'file';
    let outputContent = fileContent;
    let fileName = '';

    if (format === 'txt') {
      fileName = `${baseName}.txt`;
    } else {
      const extension = baseName.split('.').pop() || '';
      fileName = `${baseName}.md`;
      outputContent = `# ${baseName}\nPath: \`${selectedFilePath}\`\n\n\`\`\`${extension}\n${fileContent}\n\`\`\`\n`;
    }

    const result = await saveFile(fileName, outputContent, 'text/plain;charset=utf-8');
    if (result.success) {
      setUpdateStatus(`Saved / shared: ${fileName}`);
    } else {
      setUpdateStatus(`Save failed: ${result.error || 'Unknown error'}`);
    }
    setTimeout(() => setUpdateStatus(null), 3500);
  };

  // Export ZIP action
  const handleExportZip = async (withUserData: boolean) => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    try {
      const result = await exportAsZip({
        withUserData,
        recents,
        userName,
        selectedModel,
        activeChatId,
      });
      if (result.success) {
        setUpdateStatus('Saved / shared ZIP archive');
      } else {
        setUpdateStatus(`Export failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Export failed', err);
      setUpdateStatus(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setTimeout(() => setUpdateStatus(null), 3500);
    }
  };

  // Flattened & filtered files for search
  const flatFiles = useMemo(() => {
    const list: SourceNode[] = [];
    function flatten(nodes: SourceNode[]) {
      for (const node of nodes) {
        if (node.type === 'file') {
          list.push(node);
        } else if (node.children) {
          flatten(node.children);
        }
      }
    }
    flatten(tree);
    return list;
  }, [tree]);

  const filteredFiles = useMemo(() => {
    if (!filterQuery.trim()) return null;
    const q = filterQuery.toLowerCase();
    return flatFiles.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
  }, [flatFiles, filterQuery]);

  // Format file size
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return 'unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Icon selector based on file extension
  const getFileIcon = (name: string) => {
    if (name.endsWith('.json')) return <FileJson size={15} className="text-[#9A9B9F]" />;
    if (name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith('.jsx') || name.endsWith('.js')) {
      return <FileCode size={15} className="text-[#E85A3C]" />;
    }
    if (name.endsWith('.css') || name.endsWith('.html')) {
      return <Code2 size={15} className="text-[#9A9B9F]" />;
    }
    return <FileText size={15} className="text-[#8E9094]" />;
  };

  // Render tree node recursively
  const renderNode = (node: SourceNode, depth = 0) => {
    const isFolder = node.type === 'directory';
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFilePath === node.path;

    if (isFolder) {
      return (
        <div key={node.path} className="select-none">
          <button
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className="w-full h-8 flex items-center gap-2 hover:bg-white/5 text-[#D0D2D7] hover:text-white rounded-lg text-[13px] font-sans transition-colors group text-left"
          >
            <span className="text-[#7A7C82] group-hover:text-[#A0A2A7]">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="text-[#8E9094] group-hover:text-white">
              {isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
            </span>
            <span className="truncate tracking-tight font-medium text-white/90">
              {node.name}
            </span>
          </button>
          {isExpanded && node.children && (
            <div className="space-y-0.5">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        onClick={() => loadFile(node.path)}
        style={{ paddingLeft: `${depth * 14 + 26}px` }}
        className={`w-full h-8 flex items-center justify-between pr-2.5 rounded-lg text-[13px] font-sans transition-all text-left ${
          isSelected
            ? 'bg-white/10 text-white font-medium shadow-xs'
            : 'text-[#B0B3B8] hover:bg-white/5 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
        </div>
        {node.size !== undefined && (
          <span className="text-[10px] text-[#6E7075] font-mono shrink-0 ml-2">
            {formatBytes(node.size)}
          </span>
        )}
      </button>
    );
  };

  // Lines calculation
  const lineCount = useMemo(() => {
    if (!fileContent) return 0;
    return fileContent.split('\n').length;
  }, [fileContent]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden select-none">
      {/* 1. TOP HEADER (Restructured into 4 distinct rows to eliminate crowding) */}
      <header className="px-4 pt-4 pb-3 bg-[#141517] border-b border-white/5 flex flex-col shrink-0 z-20">
        {/* Row 1: Tree logo + "AXON" wordmark + "Source" title, fully visible, not truncated */}
        <div className="flex items-center gap-3">
          <button
            onClick={onLogoClick}
            aria-label="AXON Navigation"
            title="Open navigation menu"
            className="p-1 -ml-1 rounded-xl hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center cursor-pointer group shrink-0"
          >
            <AxonLogo className="w-[32px] h-[32px] shrink-0 group-hover:opacity-90 transition-opacity" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-serif text-[22px] sm:text-[24px] font-semibold tracking-wide text-white leading-tight">
              AXON
            </span>
            <span className="font-serif text-[22px] sm:text-[24px] font-normal tracking-wide text-[#ECECEC] leading-tight">
              Source
            </span>
          </div>
        </div>

        {/* Row 2: "INTELLIGENCE IN MOTION · LIVE CODEBASE" subtitle on its own line */}
        <div className="pt-1">
          <span className="text-[10px] sm:text-[10.5px] text-[#9A9B9F] tracking-widest font-sans uppercase">
            Intelligence in Motion · Live Codebase
          </span>
        </div>

        {/* Row 3: Tree/Viewer toggle and Export button on their own row with ample padding */}
        <div className="flex items-center justify-between gap-3 pt-3 pb-1">
          {/* Tree / Viewer Toggle */}
          <div className="flex items-center bg-[#232428] rounded-xl p-1 border border-white/5 shadow-inner">
            <button
              onClick={() => setMobileView('tree')}
              className={`px-3.5 py-1.5 text-xs rounded-lg font-sans transition-all cursor-pointer ${
                mobileView === 'tree'
                  ? 'bg-[#313339] text-white font-medium shadow-xs'
                  : 'text-[#8E9094] hover:text-[#D0D2D7]'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setMobileView('viewer')}
              className={`px-3.5 py-1.5 text-xs rounded-lg font-sans transition-all cursor-pointer ${
                mobileView === 'viewer'
                  ? 'bg-[#313339] text-white font-medium shadow-xs'
                  : 'text-[#8E9094] hover:text-[#D0D2D7]'
              }`}
            >
              Viewer
            </button>
          </div>

          {/* Export as ZIP button (exact casing) */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={isExporting}
              aria-label="Export source as ZIP"
              className="h-9 px-4 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white text-xs font-medium flex items-center gap-2 border border-white/5 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Archive size={14} className="text-[#E85A3C]" />
              <span>Export as ZIP</span>
              <ChevronDown
                size={13}
                className={`text-[#8E9094] transition-transform duration-200 ${
                  isExportMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Export options: small design-matched chip/tab selector */}
            {isExportMenuOpen && (
              <div className="absolute right-0 top-11 z-30 w-72 p-2 bg-[#1A1B1F] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7C82] px-3 py-1 mb-1">
                  Export Options
                </div>

                {/* Option 1: WITHOUT user data */}
                <button
                  onClick={() => handleExportZip(false)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 text-xs transition-colors flex flex-col gap-0.5 group cursor-pointer"
                >
                  <span className="font-medium text-white group-hover:text-white">
                    Export WITHOUT user data
                  </span>
                  <span className="text-[10.5px] text-[#8E9094] leading-tight">
                    Pure app &amp; source code only (clean repository)
                  </span>
                </button>

                <div className="my-1 border-t border-white/5" />

                {/* Option 2: WITH user data */}
                <button
                  onClick={() => handleExportZip(true)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 text-xs transition-colors flex flex-col gap-0.5 group cursor-pointer"
                >
                  <span className="font-medium text-white group-hover:text-white">
                    Export WITH user data
                  </span>
                  <span className="text-[10.5px] text-[#8E9094] leading-tight">
                    Source code + saved chats, history, and preferences
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Search/filter bar with clear spacing separating it from row above */}
        <div className="pt-2 pb-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1C1D21] border border-white/5 text-xs text-white focus-within:border-white/20 transition-colors">
            <Search size={14} className="text-[#7A7C82] shrink-0" />
            <input
              type="text"
              placeholder="Filter files in project..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-transparent outline-none text-xs text-white placeholder-[#686A70]"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                aria-label="Clear filter"
                className="text-[#7A7C82] hover:text-white cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN BODY (Dual Pane on Desktop / Responsive on Mobile) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Pane: File & Folder Tree */}
        <aside
          className={`${
            mobileView === 'tree' ? 'flex' : 'hidden'
          } md:flex flex-col w-full md:w-80 lg:w-88 shrink-0 bg-[#141517] border-r border-white/5 h-full overflow-hidden select-none`}
        >
          {/* Tree Scroll Area */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {isLoadingTree ? (
              <div className="p-6 text-center text-xs text-[#7A7C82] flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-[#E85A3C]" />
                <span>Reading live filesystem...</span>
              </div>
            ) : filteredFiles ? (
              // Filtered search list
              <div className="space-y-0.5">
                <div className="px-2.5 py-1 text-[11px] text-[#7A7C82]">
                  {filteredFiles.length} file{filteredFiles.length === 1 ? '' : 's'} matching &quot;{filterQuery}&quot;
                </div>
                {filteredFiles.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => loadFile(file.path)}
                    className={`w-full h-8 flex items-center justify-between px-2.5 rounded-lg text-[13px] font-sans transition-colors text-left ${
                      selectedFilePath === file.path
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-[#B0B3B8] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getFileIcon(file.name)}
                      <span className="truncate">{file.path}</span>
                    </div>
                    {file.size !== undefined && (
                      <span className="text-[10px] text-[#6E7075] font-mono shrink-0 ml-2">
                        {formatBytes(file.size)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              // Normal hierarchical tree
              tree.map((node) => renderNode(node))
            )}
          </div>

          {/* Tree Footer / Project Stats */}
          <div className="p-3 border-t border-white/5 bg-[#121315]/60 flex items-center justify-between text-[11px] text-[#7A7C82]">
            <span className="flex items-center gap-1.5 font-sans">
              <Layers size={13} className="text-[#E85A3C]" />
              <span>{flatFiles.length} live files</span>
            </span>
            <span className="text-[10px] tracking-wider uppercase font-mono text-[#5A5C62]">
              Real Project Source
            </span>
          </div>
        </aside>

        {/* Right Pane: Focused Source Viewer */}
        <section
          className={`${
            mobileView === 'viewer' ? 'flex' : 'hidden'
          } md:flex flex-1 flex-col h-full bg-[#0E0F11] overflow-hidden`}
        >
          {selectedFilePath ? (
            <>
              {/* File Viewer Action Bar */}
              <div className="h-12 px-4 bg-[#141517] border-b border-white/5 flex items-center justify-between shrink-0 z-10">
                {/* File Breadcrumb & Info */}
                <div className="flex items-center gap-2.5 truncate mr-3">
                  <div className="p-1 rounded-md bg-white/5">
                    {getFileIcon(selectedFilePath)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs truncate">
                    <span className="font-mono text-[#D0D2D7] font-medium truncate">
                      {selectedFilePath}
                    </span>
                    <span className="text-[#5A5C62] hidden sm:inline">·</span>
                    <span className="text-[11px] text-[#7A7C82] font-mono hidden sm:inline">
                      {lineCount} lines
                    </span>
                    {fileMeta && (
                      <>
                        <span className="text-[#5A5C62] hidden sm:inline">·</span>
                        <span className="text-[11px] text-[#7A7C82] font-mono hidden sm:inline">
                          {formatBytes(fileMeta.size)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* File Viewer Action Buttons: Copy & Download */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Copy Button */}
                  <button
                    onClick={handleCopyContent}
                    aria-label="Copy file contents"
                    className="h-8 px-3 rounded-lg bg-[#232428] hover:bg-[#2C2D32] text-[#D0D2D7] hover:text-white flex items-center gap-1.5 text-xs font-sans transition-all active:scale-95 border border-white/5"
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {/* Download Button with .txt / .md choice */}
                  <div className="relative">
                    <button
                      onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                      aria-label="Download file options"
                      className="h-8 px-3 rounded-lg bg-[#232428] hover:bg-[#2C2D32] text-[#D0D2D7] hover:text-white flex items-center gap-1.5 text-xs font-sans transition-all active:scale-95 border border-white/5"
                    >
                      <Download size={14} />
                      <span className="hidden sm:inline">Download</span>
                      <ChevronDown
                        size={12}
                        className={`text-[#8E9094] transition-transform ${
                          isDownloadMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Download options chip */}
                    {isDownloadMenuOpen && (
                      <div className="absolute right-0 top-10 z-30 w-44 p-1.5 bg-[#1C1D21] border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in duration-100">
                        <button
                          onClick={() => handleDownloadFile('txt')}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-[#E0E2E6] flex items-center justify-between"
                        >
                          <span>Plain Text</span>
                          <span className="text-[10px] text-[#8E9094] font-mono">.txt</span>
                        </button>
                        <button
                          onClick={() => handleDownloadFile('md')}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-[#E0E2E6] flex items-center justify-between"
                        >
                          <span>Markdown</span>
                          <span className="text-[10px] text-[#8E9094] font-mono">.md</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Code Contents Area */}
              <div className="flex-1 overflow-auto bg-[#0E0F11] font-mono text-[12.5px] leading-relaxed text-[#D6D8DC] select-text">
                {isLoadingFile ? (
                  <div className="p-8 text-center text-xs text-[#7A7C82] flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-[#E85A3C]" />
                    <span>Loading file content...</span>
                  </div>
                ) : (
                  <div className="p-4 flex">
                    {/* Line numbers gutter */}
                    <div className="select-none pr-4 mr-4 border-r border-white/5 text-[#4D4F55] text-right font-mono text-xs">
                      {fileContent.split('\n').map((_, idx) => (
                        <div key={idx} className="h-5">
                          {idx + 1}
                        </div>
                      ))}
                    </div>

                    {/* Raw file lines */}
                    <pre className="flex-1 overflow-x-auto whitespace-pre font-mono text-xs text-[#D8DAE0] leading-5">
                      {fileContent}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Empty / welcome state for source viewer
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-[#E85A3C] mb-4">
                <Code2 size={28} strokeWidth={1.8} />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-white tracking-wide mb-1">
                Select a file to inspect
              </h2>
              <p className="text-xs text-[#8E9094] max-w-sm">
                Explore the live runtime project files from the tree on the left. All contents are read directly from the current active codebase.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* 3. UPDATE-CHECK BUTTON (Fixed/floating bottom-right, icon-only, subtle palette, strictly on Axon Source) */}
      <button
        onClick={() => loadTree(true)}
        disabled={isCheckingUpdates}
        aria-label="Check for source updates"
        title="Check for source changes"
        className="fixed bottom-6 right-6 z-30 w-10 h-10 rounded-full bg-[#232428] hover:bg-[#2C2D32] active:scale-95 text-[#D0D2D7] hover:text-white border border-white/10 shadow-2xl flex items-center justify-center transition-all group cursor-pointer"
      >
        <RefreshCw
          size={16}
          className={`${
            isCheckingUpdates ? 'animate-spin text-[#E85A3C]' : 'group-hover:text-white transition-colors'
          }`}
        />
      </button>

      {/* Subtle update status toast message */}
      {updateStatus && (
        <div className="fixed bottom-20 right-6 z-30 px-3.5 py-2 rounded-xl bg-[#1C1D21] border border-white/10 text-xs text-[#E0E2E6] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#E85A3C]" />
          <span>{updateStatus}</span>
        </div>
      )}
    </div>
  );
};

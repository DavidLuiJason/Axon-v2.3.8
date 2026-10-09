/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronDown, 
  Download, 
  Copy, 
  Search, 
  X, 
  Layers, 
  Play, 
  Pause, 
  Image as ImageIcon, 
  FileText, 
  Check, 
  ArrowLeft,
  Smartphone,
  RotateCcw,
  CheckSquare
} from 'lucide-react';
import AxonLogo from './AxonLogo.jsx';

export type InterfaceStatus = 'queued' | 'capturing' | 'done' | 'failed' | 'pending';

export interface RegisteredInterface {
  id: string;
  name: string;
  description: string;
  category: string;
  componentFactory?: () => React.ReactElement;
}

export interface InterfaceCaptureState {
  item: RegisteredInterface;
  status: InterfaceStatus;
  detail: string;
}

interface InterfaceCaptureScreenProps {
  onLogoClick: () => void;
}

export const InterfaceCaptureScreen: React.FC<InterfaceCaptureScreenProps> = ({
  onLogoClick,
}) => {
  const [activeTab, setActiveTab] = useState<'capture' | 'list'>('capture');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<RegisteredInterface | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Dropdowns & selection states
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedInterfaceIds, setSelectedInterfaceIds] = useState<Set<string>>(new Set());
  const [showRecaptureConfirm, setShowRecaptureConfirm] = useState(false);

  // Data source: empty array per surgical backend removal specification
  const itemsState: InterfaceCaptureState[] = [];
  const stats = { discovered: 0, captured: 0, successful: 0, failed: 0, pending: 0 };
  const isRunning = false;
  const isFullyComplete = false;

  // Load preview image when previewing an item
  useEffect(() => {
    setPreviewImageUrl(null);
    setIsLoadingPreview(false);
  }, [selectedPreviewItem]);

  // Filter items
  const filteredStates = useMemo(() => {
    if (!filterQuery.trim()) return itemsState;
    const q = filterQuery.toLowerCase();
    return itemsState.filter(
      (s) =>
        s.item.name.toLowerCase().includes(q) ||
        s.item.description.toLowerCase().includes(q) ||
        s.item.category.toLowerCase().includes(q)
    );
  }, [filterQuery]);

  // Toggle selection for an interface
  const toggleInterfaceSelection = (id: string) => {
    setSelectedInterfaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Status indicator icon helper
  const renderStatusIcon = (status: InterfaceStatus) => {
    switch (status) {
      case 'capturing':
        return <RefreshCw size={19} className="animate-spin text-[#E85A3C]" />;
      case 'done':
        return <CheckCircle2 size={19} className="text-[#E85A3C]" />;
      case 'failed':
        return <XCircle size={19} className="text-red-500" />;
      case 'pending':
        return <Clock size={19} className="text-[#7A7C82]" />;
      case 'queued':
      default:
        return <Clock size={19} className="text-[#5A5C62]" />;
    }
  };

  // Status label styling
  const renderStatusLabel = (status: InterfaceStatus) => {
    switch (status) {
      case 'capturing':
        return <span className="text-xs text-[#E85A3C] font-medium">Capturing</span>;
      case 'done':
        return <span className="text-xs text-[#E0E2E6] font-normal">Done</span>;
      case 'failed':
        return <span className="text-xs text-red-400 font-medium">Failed</span>;
      case 'pending':
        return <span className="text-xs text-[#8E9094] font-normal">Pending</span>;
      case 'queued':
      default:
        return <span className="text-xs text-[#707277] font-normal">Queued</span>;
    }
  };

  // Copy list handler
  const handleCopyList = (format: 'markdown' | 'text' | 'json') => {
    const text = format === 'json' ? '[]' : '';
    navigator.clipboard?.writeText(text);
    setCopyFeedback(true);
    setIsCopyMenuOpen(false);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Trigger capture for single preview item
  const handleCaptureSingle = async (_itemId: string) => {
    // Disconnected
  };

  // Handle Play / Recapture button
  const handlePlayOrRecapture = () => {
    if (isFullyComplete) {
      setShowRecaptureConfirm(true);
    }
  };

  // Confirm and start fresh one-at-a-time capture run
  const handleConfirmRecapture = async () => {
    setShowRecaptureConfirm(false);
    setSelectedInterfaceIds(new Set());
  };

  // Download handlers supporting selectable interface mode
  const handleDownloadPNG = () => {
    setIsDownloadOpen(false);
  };

  const handleDownloadPDF = () => {
    setIsDownloadOpen(false);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121315] text-[#ECECEC] overflow-hidden select-none font-sans">
      {/* 1. HEADER (AXON bold serif + page name in lighter serif + small-caps gray tagline) */}
      <header className="px-5 pt-4 pb-3 bg-[#141517] border-b border-white/5 flex flex-col shrink-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* AXON Tree Logo */}
            <button
              onClick={onLogoClick}
              aria-label="AXON Navigation"
              title="Toggle navigation menu"
              className="p-1 -ml-1 rounded-xl hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center cursor-pointer group shrink-0"
            >
              <AxonLogo className="w-[32px] h-[32px] shrink-0 group-hover:opacity-90 transition-opacity" />
            </button>

            <div className="flex items-center">
              <span className="font-serif text-[23px] sm:text-[25px] font-semibold tracking-wide text-white leading-tight">
                AXON
              </span>
              <span className="font-serif text-[23px] sm:text-[25px] font-normal tracking-wide text-[#ECECEC] ml-2 leading-tight">
                Interface Capture
              </span>
            </div>
          </div>
        </div>

        {/* Small-caps tagline below */}
        <div className="pt-1 pl-1">
          <span className="text-[10px] sm:text-[10.5px] text-[#9A9B9F] tracking-widest font-sans uppercase">
            {selectedPreviewItem
              ? 'INTELLIGENCE IN MOTION · INTERFACE PREVIEW'
              : activeTab === 'capture'
              ? 'INTELLIGENCE IN MOTION · REAL-TIME CAPTURE'
              : 'INTELLIGENCE IN MOTION · INTERFACE LIST'}
          </span>
        </div>
      </header>

      {/* 2. CONTROLS ROW */}
      <div className="px-5 py-3 border-b border-white/5 bg-[#141517]/60 flex items-center justify-between shrink-0">
        {selectedPreviewItem ? (
          // In Preview View: Back button + Copy + Download
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedPreviewItem(null)}
                aria-label="Back to interface list"
                className="h-9 px-3.5 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border border-white/5"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>

              <button
                onClick={() => {
                  const text = `# AXON Interface: ${selectedPreviewItem.name}\n${selectedPreviewItem.description}`;
                  navigator.clipboard?.writeText(text);
                  setCopyFeedback(true);
                  setTimeout(() => setCopyFeedback(false), 2000);
                }}
                className="h-9 px-4 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white text-xs font-medium flex items-center gap-2 transition-all cursor-pointer border border-white/5"
              >
                {copyFeedback ? (
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
            </div>

            {/* Download dropdown for single preview */}
            <div className="relative">
              <button
                onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                aria-label="Download options"
                className="h-9 px-4 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white text-xs font-medium flex items-center gap-2 transition-all cursor-pointer border border-white/5"
              >
                <Download size={14} className="text-[#E85A3C]" />
                <span>Download</span>
                <ChevronDown size={13} className={`text-[#8E9094] transition-transform ${isDownloadOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDownloadOpen && (
                <div className="absolute right-0 top-11 z-30 w-52 p-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in duration-100">
                  <button
                    onClick={() => {
                      setIsDownloadOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/5 text-xs text-white flex items-center gap-2.5 cursor-pointer"
                  >
                    <ImageIcon size={15} className="text-[#E85A3C]" />
                    <span>Download as PNG</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsDownloadOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-white/5 text-xs text-white flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileText size={15} className="text-[#9A9B9F]" />
                    <span>Download as PDF</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          // In Capture or List View: Pill toggle + Action button
          <>
            {/* Pill-shaped toggle (Capture / List) */}
            <div className="flex items-center bg-[#232428] rounded-full p-1 border border-white/5 shadow-inner">
              <button
                onClick={() => setActiveTab('capture')}
                className={`px-4 py-1.5 text-xs rounded-full font-sans transition-all cursor-pointer ${
                  activeTab === 'capture'
                    ? 'bg-[#313339] text-white font-medium shadow-xs'
                    : 'text-[#8E9094] hover:text-[#D0D2D7]'
                }`}
              >
                Capture
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`px-4 py-1.5 text-xs rounded-full font-sans transition-all cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-[#313339] text-white font-medium shadow-xs'
                    : 'text-[#8E9094] hover:text-[#D0D2D7]'
                }`}
              >
                List
              </button>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              {activeTab === 'capture' ? (
                <>
                  {/* Start / Pause / Recapture button */}
                  {isRunning ? (
                    <button
                      onClick={handlePlayOrRecapture}
                      className="h-9 px-3.5 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white text-xs font-medium flex items-center gap-1.5 border border-white/5 cursor-pointer"
                    >
                      <Pause size={13} className="text-[#E85A3C]" />
                      <span className="hidden sm:inline">Pause</span>
                    </button>
                  ) : isFullyComplete ? (
                    /* Once capture run is fully complete, center button changes to refresh/recapture icon */
                    <button
                      onClick={handlePlayOrRecapture}
                      className="h-9 px-3.5 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white text-xs font-medium flex items-center gap-1.5 border border-white/5 shadow-sm cursor-pointer active:scale-95 transition-all"
                    >
                      <RotateCcw size={13} className="text-[#E85A3C]" />
                      <span className="hidden sm:inline">Recapture</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePlayOrRecapture}
                      className="h-9 px-3.5 rounded-full bg-[#E85A3C] hover:bg-[#E85A3C]/90 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                    >
                      <Play size={13} />
                      <span className="hidden sm:inline">
                        {stats.captured > 0 && stats.pending > 0 ? 'Resume' : 'Start Capture'}
                      </span>
                    </button>
                  )}

                  {/* Download dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                      className="h-9 px-3.5 sm:px-4 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white text-xs font-medium flex items-center gap-2 border border-white/5 transition-all cursor-pointer"
                    >
                      <Download size={14} className="text-[#E85A3C]" />
                      <span>Download</span>
                      <ChevronDown size={13} className={`text-[#8E9094] transition-transform ${isDownloadOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDownloadOpen && (
                      <div className="absolute right-0 top-11 z-30 w-64 p-2 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in duration-100">
                        {/* Select interfaces toggle */}
                        <button
                          onClick={() => {
                            setIsSelectionMode(!isSelectionMode);
                            setIsDownloadOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white flex items-center justify-between cursor-pointer border-b border-white/5 mb-1"
                        >
                          <div className="flex items-center gap-2">
                            <CheckSquare size={14} className="text-[#E85A3C]" />
                            <span className="font-medium">
                              {isSelectionMode ? 'Exit selection mode' : 'Select interfaces'}
                            </span>
                          </div>
                          {isSelectionMode && selectedInterfaceIds.size > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E85A3C]/20 text-[#E85A3C] font-mono">
                              {selectedInterfaceIds.size}
                            </span>
                          )}
                        </button>

                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7C82] px-3 py-1 mb-1">
                          Export Formats
                        </div>

                        <button
                          onClick={handleDownloadPNG}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white flex items-center gap-2.5 cursor-pointer"
                        >
                          <ImageIcon size={15} className="text-[#E85A3C]" />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {isSelectionMode && selectedInterfaceIds.size > 0
                                ? `Download selected (${selectedInterfaceIds.size}) as PNG`
                                : 'Download all as PNG (ZIP)'}
                            </span>
                            <span className="text-[10px] text-[#8E9094]">
                              {isSelectionMode && selectedInterfaceIds.size > 0
                                ? `${selectedInterfaceIds.size} selected interfaces`
                                : `${stats.successful} saved captures`}
                            </span>
                          </div>
                        </button>

                        <button
                          onClick={handleDownloadPDF}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white flex items-center gap-2.5 cursor-pointer"
                        >
                          <FileText size={15} className="text-[#9A9B9F]" />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {isSelectionMode && selectedInterfaceIds.size > 0
                                ? `Combined PDF (${selectedInterfaceIds.size} selected)`
                                : 'Combined Document (PDF)'}
                            </span>
                            <span className="text-[10px] text-[#8E9094]">Multi-page presentation</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* List View: Copy List dropdown */
                <div className="relative">
                  <button
                    onClick={() => setIsCopyMenuOpen(!isCopyMenuOpen)}
                    className="h-9 px-4 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-white text-xs font-medium flex items-center gap-2 border border-white/5 transition-all cursor-pointer"
                  >
                    <Copy size={14} className="text-[#E85A3C]" />
                    <span>Copy List</span>
                    <ChevronDown size={13} className={`text-[#8E9094] transition-transform ${isCopyMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCopyMenuOpen && (
                    <div className="absolute right-0 top-11 z-30 w-52 p-1.5 bg-[#1C1D21] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in duration-100">
                      <button
                        onClick={() => handleCopyList('markdown')}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white flex items-center justify-between cursor-pointer"
                      >
                        <span>Markdown List</span>
                        <span className="text-[10px] text-[#8E9094] font-mono">.md</span>
                      </button>
                      <button
                        onClick={() => handleCopyList('text')}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white flex items-center justify-between cursor-pointer"
                      >
                        <span>Plain Text</span>
                        <span className="text-[10px] text-[#8E9094] font-mono">.txt</span>
                      </button>
                      <button
                        onClick={() => handleCopyList('json')}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-white flex items-center justify-between cursor-pointer"
                      >
                        <span>JSON Array</span>
                        <span className="text-[10px] text-[#8E9094] font-mono">.json</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 3. FILTER BAR (when not in preview) */}
      {!selectedPreviewItem && (
        <div className="px-5 py-2.5 border-b border-white/5 bg-[#141517]/40 shrink-0">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#1C1D21] border border-white/5 text-xs text-white focus-within:border-white/20 transition-colors">
            <Search size={14} className="text-[#7A7C82] shrink-0" />
            <input
              type="text"
              placeholder="Filter interfaces..."
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
      )}

      {/* 4. MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto">
        {selectedPreviewItem ? (
          /* PREVIEW VIEW */
          <div className="p-6 flex flex-col items-center justify-center">
            {/* Subheader */}
            <div className="w-full max-w-sm flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#E85A3C]/15 border border-[#E85A3C]/30 flex items-center justify-center text-[#E85A3C]">
                  <Smartphone size={13} />
                </div>
                <h2 className="font-serif text-lg font-semibold text-white">
                  {selectedPreviewItem.name}
                </h2>
              </div>

              {/* Quick capture button for this preview item */}
              <button
                onClick={() => handleCaptureSingle(selectedPreviewItem.id)}
                disabled={isRunning}
                className="h-8 px-3 rounded-full bg-[#232428] hover:bg-[#2C2D32] text-xs font-medium text-white flex items-center gap-1.5 border border-white/5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={isRunning ? 'animate-spin text-[#E85A3C]' : ''} />
                <span>Capture Now</span>
              </button>
            </div>

            {/* Mobile Viewport Screen Frame (390 x 844) */}
            <div className="w-[390px] h-[780px] rounded-3xl border border-white/10 bg-[#0E0F11] shadow-2xl overflow-hidden relative flex flex-col">
              {isLoadingPreview ? (
                <div className="flex-1 flex flex-col items-center justify-center text-xs text-[#7A7C82] gap-2">
                  <RefreshCw size={18} className="animate-spin text-[#E85A3C]" />
                  <span>Loading captured state...</span>
                </div>
              ) : previewImageUrl ? (
                // Real captured image snapshot
                <img
                  src={previewImageUrl}
                  alt={selectedPreviewItem.name}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                // Real component render
                <div className="w-full h-full overflow-y-auto">
                  {selectedPreviewItem.componentFactory?.()}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'capture' ? (
          /* CAPTURE TAB */
          <div className="divide-y divide-white/5">
            {filteredStates.map((state) => {
              return (
                <div
                  key={state.item.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleInterfaceSelection(state.item.id);
                    } else {
                      setSelectedPreviewItem(state.item);
                    }
                  }}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    {/* Consistent status icon per state - untouched in selection mode */}
                    <div className="shrink-0 flex items-center justify-center w-6 h-6">
                      {renderStatusIcon(state.status)}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[14px] font-sans font-medium text-white group-hover:text-white transition-colors">
                        {state.item.name}
                      </span>
                      <span className="text-[11.5px] text-[#7A7C82] font-sans">
                        {state.detail}
                      </span>
                    </div>
                  </div>

                  {/* Right side: Checkbox when in selection mode, else status label */}
                  <div className="shrink-0">
                    {isSelectionMode ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleInterfaceSelection(state.item.id);
                        }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          selectedInterfaceIds.has(state.item.id)
                            ? 'bg-[#E85A3C] border-[#E85A3C] text-white'
                            : 'border-white/20 bg-[#1C1D21] hover:border-white/40'
                        }`}
                      >
                        {selectedInterfaceIds.has(state.item.id) && (
                          <Check size={12} strokeWidth={3} />
                        )}
                      </div>
                    ) : (
                      renderStatusLabel(state.status)
                    )}
                  </div>
                </div>
              );
            })}

            {filteredStates.length === 0 && (
              <div className="p-8 text-center text-xs text-[#707277] italic">
                No interfaces match &quot;{filterQuery}&quot;
              </div>
            )}
          </div>
        ) : (
          /* LIST TAB */
          <div className="divide-y divide-white/5">
            {filteredStates.map((state) => {
              return (
                <div
                  key={state.item.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleInterfaceSelection(state.item.id);
                    } else {
                      setSelectedPreviewItem(state.item);
                    }
                  }}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 truncate pr-3">
                    {/* Consistent icon treatment matching AXON's existing UI */}
                    <div className="w-8 h-8 rounded-xl bg-[#E85A3C]/10 border border-[#E85A3C]/20 flex items-center justify-center text-[#E85A3C] shrink-0">
                      <FileText size={16} strokeWidth={1.8} />
                    </div>

                    <div className="flex flex-col truncate">
                      <span className="text-[14px] font-sans font-medium text-white group-hover:text-white truncate">
                        {state.item.name}
                      </span>
                      <span className="text-[11.5px] text-[#7A7C82] font-sans truncate">
                        {state.item.description}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isSelectionMode ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleInterfaceSelection(state.item.id);
                        }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                          selectedInterfaceIds.has(state.item.id)
                            ? 'bg-[#E85A3C] border-[#E85A3C] text-white'
                            : 'border-white/20 bg-[#1C1D21] hover:border-white/40'
                        }`}
                      >
                        {selectedInterfaceIds.has(state.item.id) && (
                          <Check size={12} strokeWidth={3} />
                        )}
                      </div>
                    ) : (
                      <ChevronRight size={17} className="text-[#5A5C62] group-hover:text-[#A0A2A7] transition-colors shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}

            {filteredStates.length === 0 && (
              <div className="p-8 text-center text-xs text-[#707277] italic">
                No interfaces match &quot;{filterQuery}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. FOOTER STATS ROW */}
      <footer className="h-12 px-5 bg-[#141517] border-t border-white/5 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2 text-[#ECECEC]">
          <Layers size={16} className="text-[#E85A3C]" />
          <span>
            {selectedPreviewItem
              ? '1 interface'
              : isSelectionMode
              ? `${selectedInterfaceIds.size} of ${filteredStates.length} selected`
              : activeTab === 'capture'
              ? `${stats.captured} of ${stats.discovered} captured`
              : `${filteredStates.length} interfaces`}
          </span>
        </div>

        <div className="text-[10px] text-[#7A7C82] tracking-widest uppercase font-mono">
          {selectedPreviewItem
            ? 'REAL CAPTURE PREVIEW'
            : isSelectionMode
            ? 'SELECTION MODE ACTIVE'
            : activeTab === 'capture'
            ? 'REAL LIVE CAPTURES'
            : 'REAL INTERFACE LIST'}
        </div>
      </footer>

      {/* Recapture Confirmation Modal */}
      {showRecaptureConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#1C1D21] border border-white/10 p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E85A3C]/15 border border-[#E85A3C]/20 flex items-center justify-center text-[#E85A3C] shrink-0">
                <RotateCcw size={18} />
              </div>
              <div>
                <h3 className="font-serif text-base font-semibold text-white">
                  Recapture All Interfaces
                </h3>
                <p className="text-xs text-[#9A9B9F] mt-0.5">
                  Recapture all? This will replace existing captures.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setShowRecaptureConfirm(false)}
                className="h-9 px-4 rounded-xl hover:bg-white/5 text-xs text-[#9A9B9F] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRecapture}
                className="h-9 px-4 rounded-xl bg-[#E85A3C] hover:bg-[#E85A3C]/90 text-xs font-medium text-white shadow-sm transition-all cursor-pointer"
              >
                Recapture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

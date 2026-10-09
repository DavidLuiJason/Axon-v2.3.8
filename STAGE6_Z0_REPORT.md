# STAGE Z0 REPORT

## 1. Input
9fb4cbc265aed4ee5af68e9671541850ec31a29d4cb63d09f170fd5c302f2f95  /home/workdir/attachments/axon-stage6-2e-result.zip

## 2. Pre-check hash
b0a98a06934d2d69d18cfca1deace6cf55bb9cab392f993a30bf99062d5db5dd  types.ts

## 3. Audit script and output hashes
exit=0
8b104e56b08e0aa43f83e9eb515d5e000d106d3526322242879e4a74a6629fde  /tmp/z0_audit.py
3413 /tmp/z0_audit.py
exit=0
501aec2e0378ae57896faa7f3171dde965541ea8da0c974bb6cf2628621447f4  /tmp/z0.out
10716 /tmp/z0.out

## 4. Audit output (raw contents of /tmp/z0.out, appended by the next command)
Z0 AUDIT (read-only) root=axon-stage6
-- Z1 AXON Source fake size / mtime
== Z1a | regex=\b1024\b | paths=src/services/sourceService.ts,src/components/AxonSourceScreen.tsx | matches=4
src/components/AxonSourceScreen.tsx:263: if (bytes < 1024) return `${bytes} B`;
src/components/AxonSourceScreen.tsx:264: if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
src/components/AxonSourceScreen.tsx:265: return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
src/services/sourceService.ts:70: size: 1024,
== Z1b | regex=mtime|modified | paths=src/services/sourceService.ts,src/components/AxonSourceScreen.tsx | matches=13
src/components/AxonSourceScreen.tsx:51: const [fileMeta, setFileMeta] = useState<{ size: number; mtime: number } | null>(null);
src/components/AxonSourceScreen.tsx:90: currentSnapshot.set(node.path, node.mtime || 0);
src/components/AxonSourceScreen.tsx:101: for (const [p, mtime] of currentSnapshot.entries()) {
src/components/AxonSourceScreen.tsx:102: if (!prev.has(p) || prev.get(p) !== mtime) {
src/components/AxonSourceScreen.tsx:113: setUpdateStatus(`Live source updated · ${changedCount} file${changedCount > 1 ? 's' : ''} modified`);
src/components/AxonSourceScreen.tsx:156: setFileMeta({ size: res.size, mtime: res.mtime });
src/services/sourceService.ts:14: mtime?: number;
src/services/sourceService.ts:23: mtime: number;
src/services/sourceService.ts:71: mtime: Date.now(),
src/services/sourceService.ts:92: export async function fetchLiveSourceFile(filePath: string): Promise<{ content: string; size: number; mtime: n
src/services/sourceService.ts:101: mtime: data.mtime || Date.now(),
src/services/sourceService.ts:117: mtime: Date.now(),
src/services/sourceService.ts:148: mtime: Date.now(),
== Z1c | regex=fallback | paths=src/services/sourceService.ts,src/components/AxonSourceScreen.tsx | matches=10
src/services/sourceService.ts:26: // Fallback glob in case direct API is unreachable
src/services/sourceService.ts:27: const fallbackGlob = import.meta.glob(
src/services/sourceService.ts:51: // Fallback: build tree from import.meta.glob keys
src/services/sourceService.ts:52: const paths = Object.keys(fallbackGlob).map((p) => p.replace(/^\//, ''));
src/services/sourceService.ts:106: console.warn(`API source file fetch failed for ${filePath}, attempting fallback`, err);
src/services/sourceService.ts:109: // Fallback: load from glob
src/services/sourceService.ts:111: const loader = fallbackGlob[normKey];
src/services/sourceService.ts:134: console.warn('API source all files fetch failed, using glob fallback', err);
src/services/sourceService.ts:137: // Fallback: load all files through glob
src/services/sourceService.ts:139: for (const [key, loader] of Object.entries(fallbackGlob)) {
-- Z2 root AxonLogo.jsx
FILE AxonLogo.jsx | exists=YES | bytes=49399 | sha256=ddcd5d70559b70388827adbe858ce1f24c4a92f4beaa9c319ee5646358239457
FILE src/components/AxonLogo.jsx | exists=YES | bytes=49399 | sha256=ddcd5d70559b70388827adbe858ce1f24c4a92f4beaa9c319ee5646358239457
== Z2a | regex=from ['"][^'"]*AxonLogo | paths=src,tests,vite.config.ts,capacitor.config.ts,index.html,tsconfig.json,package.json,.gitignore,.env.example,metadata.json | matches=9
src/components/AxonBuildScreen.tsx:30: import AxonLogo from './AxonLogo.jsx';
src/components/AxonSourceScreen.tsx:25: import AxonLogo from './AxonLogo.jsx';
src/components/AxonToolsScreen.tsx:8: import AxonLogo from './AxonLogo.jsx';
src/components/BackgroundProofScreen.tsx:23: import AxonLogo from './AxonLogo.jsx';
src/components/DesignTokensModal.tsx:9: import AxonLogo from './AxonLogo.jsx';
src/components/InterfaceCaptureScreen.tsx:29: import AxonLogo from './AxonLogo.jsx';
src/components/NavigationDrawer.tsx:19: import AxonLogo from './AxonLogo.jsx';
src/components/SettingsModal.tsx:8: import AxonLogo from './AxonLogo.jsx';
src/components/WelcomeState.tsx:7: import AxonLogo from './AxonLogo.jsx';
-- Z3 unused dependencies
== Z3a | regex=@google/genai | paths=src,tests,vite.config.ts,capacitor.config.ts,index.html,tsconfig.json,package.json,.gitignore,.env.example,metadata.json | matches=1
package.json:18: "@google/genai": "^2.4.0",
== Z3b | regex=dotenv | paths=src,tests,vite.config.ts,capacitor.config.ts,index.html,tsconfig.json,package.json,.gitignore,.env.example,metadata.json | matches=1
package.json:22: "dotenv": "^17.2.3",
== Z3c | regex=['"]motion['"/]|framer-motion | paths=src,tests,vite.config.ts,capacitor.config.ts,index.html,tsconfig.json,package.json,.gitignore,.env.example,metadata.json | matches=1
package.json:26: "motion": "^12.23.24",
-- Z4 isCompactMode
== Z4a | regex=compactmode | paths=src | matches=10
src/App.tsx:45: const [isCompactMode, setIsCompactMode] = useState(false);
src/App.tsx:179: isCompactMode={isCompactMode}
src/App.tsx:180: onToggleCompactMode={openTokensModal}
src/components/Composer.tsx:15: isCompactMode: boolean;
src/components/Composer.tsx:16: onToggleCompactMode: () => void;
src/components/Composer.tsx:58: isCompactMode,
src/components/Composer.tsx:59: onToggleCompactMode,
src/components/Composer.tsx:129: onClick={onToggleCompactMode}
src/components/Composer.tsx:130: title={isCompactMode ? 'Standard Layout' : 'Toggle Pane View'}
src/components/Composer.tsx:136: <div className={`h-full transition-all ${isCompactMode ? 'w-2 bg-[#E85A3C]' : 'w-1.5 bg-[#A0A2A7] group-hover:
-- Z5 Express / server.js residue
FILE server.js | exists=NO
FILE server.ts | exists=NO
== Z5a | regex=express | paths=src,tests,vite.config.ts,capacitor.config.ts,index.html,tsconfig.json,package.json,.gitignore,.env.example,metadata.json | matches=2
package.json:23: "express": "^4.21.2",
package.json:44: "@types/express": "^4.17.21"
== Z5b | regex=server\.js | paths=src,tests,vite.config.ts,capacitor.config.ts,index.html,tsconfig.json,package.json,.gitignore,.env.example,metadata.json | matches=1
package.json:10: "clean": "rm -rf dist server.js",
-- Z6 Library / Projects overlay
== Z6a | regex=\blibrary\b|\bprojects?\b | paths=src | matches=14
src/components/AxonSourceScreen.tsx:464: placeholder="Filter files in project..."
src/components/AxonSourceScreen.tsx:531: {/* Tree Footer / Project Stats */}
src/components/AxonSourceScreen.tsx:538: Real Project Source
src/components/AxonSourceScreen.tsx:674: Explore the live runtime project files from the tree on the left. All contents are read directly from the curr
src/components/AxonToolsScreen.tsx:128: INTELLIGENCE IN MOTION · TOOL LIBRARY
src/components/NavigationDrawer.tsx:8: Library,
src/components/NavigationDrawer.tsx:121: {/* Library */}
src/components/NavigationDrawer.tsx:128: <Library size={19} strokeWidth={1.8} />
src/components/NavigationDrawer.tsx:130: <span>Library</span>
src/components/NavigationDrawer.tsx:133: {/* Projects */}
src/components/NavigationDrawer.tsx:141: <span>Projects</span>
src/state/AxonStateContext.tsx:53: "Absolutely, I can help you build a simple Android app with Kotlin. I'll show you a clean, beginner-friendly s
src/state/AxonStateContext.tsx:58: 'Set up a new Android project with Kotlin.',
src/state/AxonStateContext.tsx:65: suggestionPrompt: 'Would you like the full project structure next, or shall we start with the login screen?',
-- Z7 API key masking, chat export PDF, cooldown badge
== Z7a | regex=api[_ -]?key | paths=src | matches=0
== Z7b | regex=pdf | paths=src | matches=5
src/components/InterfaceCaptureScreen.tsx:171: const handleDownloadPDF = () => {
src/components/InterfaceCaptureScreen.tsx:282: <span>Download as PDF</span>
src/components/InterfaceCaptureScreen.tsx:407: onClick={handleDownloadPDF}
src/components/InterfaceCaptureScreen.tsx:414: ? `Combined PDF (${selectedInterfaceIds.size} selected)`
src/components/InterfaceCaptureScreen.tsx:415: : 'Combined Document (PDF)'}
== Z7c | regex=cooldown | paths=src | matches=0
-- Z8 collage, pinch-zoom, sub-tab history
== Z8a | regex=collage | paths=src | matches=0
== Z8b | regex=pinch|gesturestart|touchstart|touches | paths=src | matches=0
== Z8c | regex=sub-?tab|tabhistory | paths=src | matches=0
-- Z9 command parsing, image vs video wording
== Z9a | regex=parsecommand|command | paths=src | matches=0
== Z9b | regex=\bvideo\b | paths=src | matches=0
-- Z10 chess
== Z10a | regex=chess | paths=src | matches=0
-- Z11 Bible / Genesis
== Z11a | regex=bible|genesis | paths=src | matches=0
-- Z12 audio counter
== Z12a | regex=audio | paths=src | matches=3
src/components/Composer.tsx:117: setVoiceNotice('Spoken audio engine is staged. The AXON voice pipeline connects in Phase 2.');
src/services/axonBrainInterface.ts:50: content: `The AXON interface is built upon a calm, minimal foundation designed to eliminate scattered dashboar
src/services/axonBrainInterface.ts:55: 'Anchored Adaptive Composer: Persistent bottom bubble holding model selector, audio controls, and unified voic
== Z12b | regex=counter | paths=src | matches=23
src/background/types.ts:9: export type JobKind = 'counter' | 'steps';
src/background/types.ts:36: /** Counter value when jobKind is counter. */
src/background/types.ts:37: counterValue?: number;
src/background/types.ts:52: counterValue: number;
src/background/verdict.ts:222: jobKind: opts.jobKind ?? 'counter',
src/background/verdict.ts:226: counterValue: opts.counterValue ?? last?.counterValue ?? 0,
src/background/webFallbackAdapter.ts:23: 'Preparing counter state',
src/background/webFallbackAdapter.ts:35: counterValue: 0,
src/background/webFallbackAdapter.ts:78: counterValue: snap.counterValue,
src/background/webFallbackAdapter.ts:85: counterValue: rec.counterValue ?? snap.counterValue,
src/background/webFallbackAdapter.ts:97: if (snap.jobKind === 'counter') {
src/background/webFallbackAdapter.ts:100: counterValue: snap.counterValue + 1,
src/background/webFallbackAdapter.ts:101: stepLabel: `Counting · ${snap.counterValue + 1}`,
src/background/webFallbackAdapter.ts:103: pushHb({ eventType: 'HEARTBEAT', stepLabel: snap.stepLabel, counterValue: snap.counterValue });
src/background/webFallbackAdapter.ts:139: opts.kind === 'counter' ? 'Counting · 0' : steps[0] ?? 'Starting';
src/background/webFallbackAdapter.ts:146: counterValue: 0,
src/components/BackgroundProofScreen.tsx:42: 'Preparing counter state',
src/components/BackgroundProofScreen.tsx:93: const startCounter = useCallback(async () => {
src/components/BackgroundProofScreen.tsx:97: await adapter.startJob({ kind: 'counter' });
src/components/BackgroundProofScreen.tsx:251: onClick={startCounter}
src/components/BackgroundProofScreen.tsx:255: Start counter
src/components/BackgroundProofScreen.tsx:307: <div className="text-[11px] text-[#68696E]">Counter</div>
src/components/BackgroundProofScreen.tsx:309: {snap?.jobKind === 'counter' ? snap.counterValue : '—'}
END Z0 AUDIT

## 5. Scope gate before the report existed
exit=0

## 6. Item status
Stage Z0: AUDIT SCRIPT RUN=YES  OUTPUT HASH AND BYTE COUNT MATCHED=YES  INTERPRETATION=NOT DONE BY THE BUILDER

## 7. Still unproven
- The audit output shows where fixed text patterns occur in the files searched; it does not show whether any suspected bug exists or behaves as described.
- A pattern with no match does not prove that the suspected item does not exist under another name or in a place that was not searched.
- Only the files and folders named in the script were searched; android-overlay, scripts, the Markdown reports and node_modules were not.
- No file was compiled, type-checked, tested, built or run.
- The prompt required the builder not to interpret the audit output; no interpretation is included in this report.
- File permissions, timestamps and symlinks were not compared; only file paths and contents were.
- Files were read as UTF-8 text; bytes that are not valid UTF-8 were replaced while reading.

## 8. Package checks
Package checks (zip SHA-256, entry count, node_modules count, archive test, re-extract comparison, final scope gate, final hash) are not in this file, because this file is inside the zip. They appear in the delivery message under PACKAGE CHECKS.

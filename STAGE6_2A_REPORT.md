# STAGE 6.2A REPORT

Node: v24.15.0 (system; .nvmrc requests 20 — Node 20 not available in this environment)
npm: 11.12.1

## Item 1 — nativeBridge.ts registerPlugin

### Verification of plugin name (source)
From `android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java`:

```
@CapacitorPlugin(
        name = "BackgroundJobs",
        permissions = {
                @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
        }
)
```

Exact name value: `"BackgroundJobs"`.

### Before edit — getPlugin() and web-fallback path
```
function getPlugin(): BackgroundJobsPlugin | null {
  try {
    // Capacitor injects plugins on window.Capacitor.Plugins
    const Cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown>; isNativePlatform?: () => boolean } }).Capacitor;
    if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) {
      return null;
    }
    const plugin = Cap.Plugins?.BackgroundJobs as BackgroundJobsPlugin | undefined;
    return plugin ?? null;
  } catch {
    return null;
  }
}
```
Web-fallback path (unchanged): `createNativeBridgeAdapter()` calls `getPlugin()`; if null returns `createWebFallbackAdapter()`.

### After edit
- `import { Capacitor, registerPlugin } from '@capacitor/core';`
- Module-level: `const BackgroundJobs = registerPlugin<BackgroundJobsPlugin>('BackgroundJobs');`
- `getPlugin()` keeps native guard: `if (!Capacitor.isNativePlatform()) return null; return BackgroundJobs;`
- No `window.Capacitor` or `Capacitor.Plugins`.

### grep proof
```
9:import { Capacitor, registerPlugin } from '@capacitor/core';
33:const BackgroundJobs = registerPlugin<BackgroundJobsPlugin>('BackgroundJobs');
37:    if (!Capacitor.isNativePlatform()) {
```

### diff -u (nativeBridge.ts)
```
--- P/src/background/nativeBridge.ts
+++ D/src/background/nativeBridge.ts
@@ -6,6 +6,7 @@
  * Falls back to web adapter when the plugin is unavailable.
  */
 
+import { Capacitor, registerPlugin } from '@capacitor/core';
 import type {
   BackgroundCapabilities,
   BackgroundExecutionAdapter,
@@ -29,15 +30,14 @@
   ): Promise<{ remove: () => void }>;
 }
 
+const BackgroundJobs = registerPlugin<BackgroundJobsPlugin>('BackgroundJobs');
+
 function getPlugin(): BackgroundJobsPlugin | null {
   try {
-    // Capacitor injects plugins on window.Capacitor.Plugins
-    const Cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown>; isNativePlatform?: () => boolean } }).Capacitor;
-    if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) {
+    if (!Capacitor.isNativePlatform()) {
       return null;
     }
-    const plugin = Cap.Plugins?.BackgroundJobs as BackgroundJobsPlugin | undefined;
-    return plugin ?? null;
+    return BackgroundJobs;
   } catch {
     return null;
   }
```

### Live-like verification of web fallback
Verified by reading final `nativeBridge.ts`: `getPlugin()` returns `null` when `Capacitor.isNativePlatform()` is false. Therefore `createNativeBridgeAdapter()` still returns `createWebFallbackAdapter()`. This was verified by reading the code, not by running it in a browser.

| Item 1 | Status |
|--------|--------|
| IMPLEMENTED | YES |
| COMPILED | YES (build exit 0) |
| RUN | N/A (code change only) |

## Item 2 — package.json esbuild

### Step 1: plain npm install in B (reproduces ERESOLVE)
```
npm error code ERESOLVE
npm error ERESOLVE could not resolve
npm error
npm error While resolving: vite@8.3.1
npm error Found: esbuild@0.25.12
npm error node_modules/esbuild
npm error   dev esbuild@"^0.25.0" from the root project
npm error
npm error Could not resolve dependency:
npm error peerOptional esbuild@"^0.27.0 || ^0.28.0" from vite@8.3.1
npm error node_modules/vite
npm error   vite@"^8.3.0" from the root project
...
EXIT:1
```

### Step 2: npm install --legacy-peer-deps in B (baseline-only, not a fix)
Succeeded after retries (proxy E502 flakiness):
```
added 283 packages in 1m
EXIT:0
```

### Step 3: baseline lint / build in B
Lint:
```
> react-example@0.0.0 lint
> tsc --noEmit

src/background/webFallbackAdapter.ts(77,7): error TS2783: 'eventType' is specified more than once, so this usage will be overwritten.
EXIT:1
```
(PRE-EXISTING)

Build:
```
> react-example@0.0.0 build
> vite build
...
✓ built in 688ms
EXIT:0
```

### Step 4: metadata
Resolved vite version in B: 8.3.1

`npm view vite@8.3.1 peerDependencies peerDependenciesMeta --json`:
```json
{
  "peerDependencies": {
    "@types/node": "^20.19.0 || >=22.12.0",
    "@vitejs/devtools": "^0.7.1",
    "esbuild": "^0.27.0 || ^0.28.0",
    "jiti": ">=1.21.0",
    "less": "^4.0.0",
    "sass": "^1.70.0",
    "sass-embedded": "^1.70.0",
    "stylus": ">=0.54.8",
    "sugarss": "^5.0.0",
    "terser": "^5.16.0",
    "tsx": "^4.8.1",
    "yaml": "^2.4.2"
  },
  "peerDependenciesMeta": {
    ...
    "esbuild": { "optional": true },
    ...
  }
}
```

`npm ls esbuild` (B):
```
react-example@0.0.0 /home/workdir/B
+-- esbuild@0.25.12
+-- tsx@4.23.15
| `-- esbuild@0.28.2
`-- vite@8.3.1
  `-- esbuild@0.25.12 deduped invalid: "^0.27.0 || ^0.28.0" from node_modules/vite
```

Constraints on esbuild:
- package.json: `"esbuild": "^0.25.0"`
- vite peerOptional: `"^0.27.0 || ^0.28.0"`
- tsx (transitive): `~0.28.0` (own nested copy)
- No other esbuild references in vite.config.ts or package.json

### Step 5: chosen version
`"^0.28.0"`

Reasoning: vite requires peerOptional `^0.27.0 || ^0.28.0`. The original `^0.25.0` (semver: >=0.25.0 <0.26.0) cannot satisfy that. `^0.28.0` satisfies vite's range, is compatible with tsx's nested ~0.28, and is a single-line string change. No other constraints exist.

### Step 6–7: change in D + plain npm install
```
diff package.json (one line only):
-    "esbuild": "^0.25.0",
+    "esbuild": "^0.28.0",
```

Plain `npm install` in clean D:
```
added 281 packages in 1m
EXIT:0
```
(no override flags)

### Step 8: final validation in D (after Item 1 edit)
Lint:
```
> tsc --noEmit
src/background/webFallbackAdapter.ts(77,7): error TS2783: 'eventType' is specified more than once, so this usage will be overwritten.
EXIT:1
```
(same PRE-EXISTING)

Build:
```
✓ built in 618ms
EXIT:0
```

test:bg:
```
=== all elapsedFormat tests passed ===
=== all verdict tests passed ===
EXIT:0
```

### Baseline vs final (lint / build)

| Command | Baseline (B) | Final (D) |
|---------|--------------|-----------|
| lint    | EXIT 1 (webFallbackAdapter TS2783) | EXIT 1 (identical pre-existing) |
| build   | EXIT 0 | EXIT 0 |
| test:bg | (not required for baseline) | EXIT 0 |

| Item 2 | Status |
|--------|--------|
| IMPLEMENTED | YES |
| COMPILED | YES (build exit 0) |
| RUN | YES (install exit 0, test:bg exit 0) |

## SHA-256
- package.json: fc824fc57f9057e1dace161adace20a86b99c2d128c237e023d65294eaf64161
- src/background/nativeBridge.ts: c65f893fa8ba45f8f4d72c06018e6c96464b49f33671d84591417de3fe6ad79b

## Diff-generated changed-file list
Exactly:
- package.json
- src/background/nativeBridge.ts
- STAGE6_2A_REPORT.md (added)

## Zip comparison
Input file count (files only): 72
Output file count (files only): 73
Output: identical paths + STAGE6_2A_REPORT.md.

## What is still unproven
Nothing Android-side was touched or tested. Native plugin registration, foreground service, permissions, and device behaviour were not exercised. Web-fallback path confirmed only by static code inspection of `getPlugin()` / `Capacitor.isNativePlatform()`. Node version is 24, not the requested 20 from .nvmrc. Proxy flakiness required install retries but final plain install succeeded with exit 0.

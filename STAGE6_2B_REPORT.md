# STAGE 6.2B REPORT

## Environment
```
node: v24.15.0 (.nvmrc requests 20; Node 20 not available)
npm: 11.12.1
python3: Python 3.12.3
sed: sed (GNU sed) 4.9
xmllint: not found
XML backend used by test: python3 xml.dom.minidom
```

Input zip SHA-256: 2af3ae5da9ddc05a8c1f99bcba90a169291b4c9a62b14c074760b6f2853240e9 (matches expected)

## Item 1 — webFallbackAdapter.ts lint fix

### Before (lines 68-90 of P copy)
```
  function pushHb(partial: Partial<HeartbeatRecord> & { eventType: HeartbeatRecord['eventType'] }) {
    seq += 1;
    const rec: HeartbeatRecord = {
      jobId: snap.jobId ?? 'web',
      seq,
      wallClock: Date.now(),
      elapsedRealtime: snap.startWallClock != null ? Date.now() - snap.startWallClock : 0,
      batteryPercent: null,
      stepLabel: snap.stepLabel,
      eventType: partial.eventType,
      gapMs: partial.gapMs,
      counterValue: snap.counterValue,
      ...partial,
    };
    snap = {
      ...snap,
      heartbeats: [...snap.heartbeats, rec].slice(-500),
      stepLabel: rec.stepLabel,
      counterValue: rec.counterValue ?? snap.counterValue,
    };
    emit();
  }
```

### Baseline lint (B) diagnostic
```
src/background/webFallbackAdapter.ts(77,7): error TS2783: 'eventType' is specified more than once, so this usage will be overwritten.
```
EXIT:1

### diff -u
```
--- input/src/background/webFallbackAdapter.ts
+++ delivery/src/background/webFallbackAdapter.ts
@@ -74,7 +74,6 @@
       elapsedRealtime: snap.startWallClock != null ? Date.now() - snap.startWallClock : 0,
       batteryPercent: null,
       stepLabel: snap.stepLabel,
-      eventType: partial.eventType,
       gapMs: partial.gapMs,
       counterValue: snap.counterValue,
       ...partial,
```

The eventType value is unchanged. Removing the line changes the insertion order of that property in the constructed object, so the change is not strictly equivalent for code that observes property enumeration order.

### Search patterns and matches (src/ tests/)
Patterns: HeartbeatRecord, pushHb, JSON.stringify, Object.keys, Object.entries
Relevant matches:
- src/background/types.ts: HeartbeatRecord interface
- src/background/webFallbackAdapter.ts: pushHb definition and call sites; one JSON.stringify for diagnostics
- src/background/verdict.ts: HeartbeatRecord usage in expandBeatWallClocks / snapshotFromLog
- src/background/nativeBridge.ts: JSON.stringify for error
- tests/verdict.test.ts: HeartbeatRecord construction via helper
- src/services/sourceService.ts, src/state/storage.ts: Object.keys/entries and JSON.stringify on unrelated data
No deep-equality or property-order dependent comparison of HeartbeatRecord objects found.

### Final lint (D)
```
> react-example@0.0.0 lint
> tsc --noEmit

```
EXIT:0

No new diagnostics. TS2783 gone. Only permitted change.

| Item 1 | Status |
|--------|--------|
| IMPLEMENTED | YES |
| COMPILED | YES (lint exit 0) |
| RUN | N/A |

## Item 2 — scripts/test-apply-overlay.sh

### Overlay script facts confirmed
- Root from dirname "$0"/..
- Exits 1 with "ERROR: android/ not found. Run: npx cap add android" if android/app missing
- Copies BackgroundJobService.java, BackgroundJobsPlugin.java, MainActivity.java, ic_notification.xml
- Adds six uses-permission and one service before </application>

### F4 invocation 1 (cwd = D project root)
```
INFO: XML backend = python3 xml.dom.minidom (well-formedness only, not Android manifest validity)
PASS: 1 run 1 exit code is 0
PASS: 2 manifest is well-formed XML (backend=python3 xml.dom.minidom)
PASS: 3 exactly one <uses-permission> android:name=android.permission.POST_NOTIFICATIONS
PASS: 4 exactly one <uses-permission> android:name=android.permission.FOREGROUND_SERVICE
PASS: 5 exactly one <uses-permission> android:name=android.permission.FOREGROUND_SERVICE_SPECIAL_USE
PASS: 6 exactly one <uses-permission> android:name=android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
PASS: 7 exactly one <uses-permission> android:name=android.permission.WAKE_LOCK
PASS: 8 exactly one <uses-permission> android:name=android.permission.INTERNET
PASS: 9 exactly 6 <uses-permission> elements in total
PASS: 10 exactly one <application> element
PASS: 11 exactly one <service> android:name=.background.BackgroundJobService child of <application>
PASS: 12 service has android:foregroundServiceType=specialUse and android:exported=false
PASS: 13 service has exactly one <property> PROPERTY_SPECIAL_USE_FGS_SUBTYPE with non-empty value
PASS: 14 exactly one activity .MainActivity with intent-filter MAIN+LAUNCHER
PASS: 15 FileProvider still present with correct attributes
PASS: 16 java/com/axon/app/background/BackgroundJobService.java exists and cmp matches overlay source
PASS: 17 java/com/axon/app/background/BackgroundJobsPlugin.java exists and cmp matches overlay source
PASS: 18 java/com/axon/app/MainActivity.java exists and cmp matches overlay source
PASS: 19 res/drawable/ic_notification.xml exists and cmp matches overlay source
PASS: 20 run 2 exit code is 0
PASS: 21 manifest byte-identical to after run 1
PASS: 22 file-tree list identical to after run 1
PASS: 23 (deferred to caller) scripts/apply-android-overlay.sh and android-overlay/ SHA-256 unchanged in source tree
PASS: 24 negative: overlay exits non-zero
PASS: 25 negative: output contains 'android/ not found'
PASS: 26 negative: no android/ folder created in neg and no files outside T
INFO: all 26 assertions passed
```
EXIT:0

### F4 invocation 2 (cwd = unrelated mktemp -d)
```
INFO: XML backend = python3 xml.dom.minidom (well-formedness only, not Android manifest validity)
PASS: 1 run 1 exit code is 0
PASS: 2 manifest is well-formed XML (backend=python3 xml.dom.minidom)
PASS: 3 exactly one <uses-permission> android:name=android.permission.POST_NOTIFICATIONS
PASS: 4 exactly one <uses-permission> android:name=android.permission.FOREGROUND_SERVICE
PASS: 5 exactly one <uses-permission> android:name=android.permission.FOREGROUND_SERVICE_SPECIAL_USE
PASS: 6 exactly one <uses-permission> android:name=android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
PASS: 7 exactly one <uses-permission> android:name=android.permission.WAKE_LOCK
PASS: 8 exactly one <uses-permission> android:name=android.permission.INTERNET
PASS: 9 exactly 6 <uses-permission> elements in total
PASS: 10 exactly one <application> element
PASS: 11 exactly one <service> android:name=.background.BackgroundJobService child of <application>
PASS: 12 service has android:foregroundServiceType=specialUse and android:exported=false
PASS: 13 service has exactly one <property> PROPERTY_SPECIAL_USE_FGS_SUBTYPE with non-empty value
PASS: 14 exactly one activity .MainActivity with intent-filter MAIN+LAUNCHER
PASS: 15 FileProvider still present with correct attributes
PASS: 16 java/com/axon/app/background/BackgroundJobService.java exists and cmp matches overlay source
PASS: 17 java/com/axon/app/background/BackgroundJobsPlugin.java exists and cmp matches overlay source
PASS: 18 java/com/axon/app/MainActivity.java exists and cmp matches overlay source
PASS: 19 res/drawable/ic_notification.xml exists and cmp matches overlay source
PASS: 20 run 2 exit code is 0
PASS: 21 manifest byte-identical to after run 1
PASS: 22 file-tree list identical to after run 1
PASS: 23 (deferred to caller) scripts/apply-android-overlay.sh and android-overlay/ SHA-256 unchanged in source tree
PASS: 24 negative: overlay exits non-zero
PASS: 25 negative: output contains 'android/ not found'
PASS: 26 negative: no android/ folder created in neg and no files outside T
INFO: all 26 assertions passed
```
EXIT:0

### Before/after D source-tree hash list
HASHLIST_IDENTICAL (excluding node_modules/dist/package-lock.json)
IMMUT_OK (apply-android-overlay.sh + all android-overlay files unchanged)

| Item 2 | Status |
|--------|--------|
| IMPLEMENTED | YES |
| COMPILED | N/A |
| RUN | YES (both invocations exit 0; 52 PASS lines) |

## Baseline (B) vs Final (D)

| Command   | B exit | D exit |
|-----------|--------|--------|
| npm install | 0 (after proxy retries) | 0 |
| lint      | 1 (TS2783) | 0 |
| build     | 0 | 0 |
| test:bg   | 0 | 0 |

### Raw baseline lint (B)
```
> react-example@0.0.0 lint
> tsc --noEmit

src/background/webFallbackAdapter.ts(77,7): error TS2783: 'eventType' is specified more than once, so this usage will be overwritten.
```
EXIT:1

### Raw final lint (D)
```
> react-example@0.0.0 lint
> tsc --noEmit

```
EXIT:0

### TRIMMED install logs
B install (last 40 lines of successful attempt; original successful log short):
```
npm warn deprecated @types/jszip@3.4.1: This is a stub types definition. jszip provides its own type definitions, so you do not need this installed.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 281 packages in 21s

46 packages are looking for funding
  run `npm fund` for details
```
EXIT:0

D install:
```
npm warn deprecated @types/jszip@3.4.1: This is a stub types definition. jszip provides its own type definitions, so you do not need this installed.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead

added 281 packages in 19s

46 packages are looking for funding
  run `npm fund` for details
```
EXIT:0

package.json byte-identical to P after both installs.

## Final-gate results

### Changed/added paths (recursive comparison input extraction vs delivery)
Exactly:
- src/background/webFallbackAdapter.ts (modified)
- scripts/test-apply-overlay.sh (added)
- STAGE6_2B_REPORT.md (added)

### diff -u webFallbackAdapter (one removed line only)
Confirmed above.

### Path-list comparison (normalised relative, files only)
Input zip non-dir entries: 72
Output zip non-dir entries: 74
Output = input + scripts/test-apply-overlay.sh + STAGE6_2B_REPORT.md
No node_modules/, dist/, build/, .vite/, coverage/, package-lock.json, .npmrc in output.

### Counts (files only)
- Input extraction: 72
- Delivery extraction: 74
- Input zip file entries: 72
- Output zip file entries: 74

### SHA-256 table
| Path | Input extraction | Delivery extraction | Equal? |
|------|------------------|---------------------|--------|
| package.json | fc824fc57f9057e1dace161adace20a86b99c2d128c237e023d65294eaf64161 | fc824fc57f9057e1dace161adace20a86b99c2d128c237e023d65294eaf64161 | YES |
| src/background/nativeBridge.ts | c65f893fa8ba45f8f4d72c06018e6c96464b49f33671d84591417de3fe6ad79b | c65f893fa8ba45f8f4d72c06018e6c96464b49f33671d84591417de3fe6ad79b | YES |
| scripts/apply-android-overlay.sh | 0add689ff17214c441f60ff67ae303984b0aceca19253f6b62036247618f3469 | 0add689ff17214c441f60ff67ae303984b0aceca19253f6b62036247618f3469 | YES |
| src/background/webFallbackAdapter.ts | 4d3c613dd5423fef9ec108efca7644d02a763e9d24eac493db97985f57179190 | 90b71735fe5339cba52d0684aee90734778ae53e02861b9d6f9fcf6238346f50 | NO (expected) |
| scripts/test-apply-overlay.sh | (absent) | 6935d3741abb02672954f312224f25ea6e8658c6e2f49b16f596c3036c3b812a | output only |

Input zip SHA-256: 2af3ae5da9ddc05a8c1f99bcba90a169291b4c9a62b14c074760b6f2853240e9
Delivery zip SHA-256: fdae32044f889f381a8695b7e8891e9a5a7485b96b789ad9064e28d2f9ae2c5d

## What is still unproven
The Android side (Java service, plugin, real `npx cap add android` output, Gradle, APK, installation or device behaviour) was not touched or tested. The overlay test used a mock manifest. The overlay script has not been run against real Capacitor output. test-apply-overlay.sh proves only that the overlay behaves correctly against the exact mock fixture the test builds.

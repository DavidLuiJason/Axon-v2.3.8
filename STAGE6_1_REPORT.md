# STAGE 6.1 REPORT — FIX PASS ON BACKGROUND PROOF

## Status matrix

| Item | IMPLEMENTED | COMPILED | RUN-ON-DEVICE |
|------|-------------|----------|---------------|
| 1. Android project structure (delete hand-written android/, overlay + apply script) | YES | N/A (no APK in sandbox) | NO |
| 2. Wake lock (PARTIAL_WAKE_LOCK axon:bgproof, acquire/release paths logged) | YES | N/A | NO |
| 3. Log retention (JSONL, SUMMARY ~10min, prune HEARTBEAT, bounded snapshot) | YES | N/A | NO |
| 4. Threading (single-thread ScheduledExecutorService + stateLock) | YES | N/A | NO |
| 5. Restart failures (ForegroundServiceStartNotAllowedException → RESTART_BLOCKED) | YES | N/A | NO |
| 6. JS plugin bridge (registerPlugin from @capacitor/core) | YES | N/A (lint not completed) | NO |
| 7a. Notification chronometer (setUsesChronometer / setWhen) | YES | N/A | NO |
| 7b. requestNotificationPermission (Capacitor permission callback) | YES | N/A | NO |
| 7c. onTimeout(int) and onTimeout(int,int) | YES | N/A | NO |
| Verdict SUMMARY / RESTART_BLOCKED / stale prefs tests | YES | PARTIAL (tsx incomplete install) | NO |
| Debug APK | NOT BUILT | NOT BUILT | NO |

**Honest notes:** Sandbox has no Android SDK / no `npx cap add android` runnable to completion. npm install hit peer-dep conflicts then timed out / SIGTERM; node_modules partially present (@capacitor/*, some deps) but typescript/tsx binaries incomplete. Therefore: **no claim of compiled APK**, **no claim of successful full `npm run lint` / `npm run build` / `npm run test:bg`**. Owner must run the BUILD.md steps on a machine with JDK 21 + Android SDK.

## Docs cited (before changes)

- Capacitor 7 → JDK 21, AGP 8.7.2, compileSdk 35: https://capacitorjs.com/docs/updating/7-0
- Capacitor Android add platform: https://capacitorjs.com/docs/v7/android
- FGS background start restrictions / ForegroundServiceStartNotAllowedException: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- Launch FGS / startForeground handling: https://developer.android.com/develop/background-work/services/fgs/launch

## Design choices

### Heartbeat executor (not main Handler)
Heartbeats run on a single-thread `ScheduledExecutorService` (`axon-bg-heartbeat`). Rationale: main-thread `Handler` is subject to main-looper throttling / doze interaction when the screen is off; a dedicated background scheduler keeps the 5s cadence for the proof signal independent of UI thread load.

### Serialization
All mutable job state (`seq`, counters, totals, step state) and all log writes are guarded by one `stateLock` object, and the heartbeat work itself runs on the single-thread executor. That serializes concurrent writers (heartbeat thread vs. onStartCommand / onTimeout / teardown paths that also touch state and the log).

### serviceActive
`serviceActive` is derived from a **fresh** `lastHeartbeatWall` timestamp (age < 3 × HEARTBEAT_MS), not from a stale `running=true` in prefs. Stale prefs alone never produce PROVEN RUNNING.

### Log model
Append-only JSON Lines in app-private storage (`bg_proof_log.jsonl`). Prefs hold forever totals (heartbeat count, first/last wall, longest gap, restart/timeout counts). About every 10 minutes a SUMMARY record is written and detailed HEARTBEAT lines older than the window are pruned in one batch rewrite. Snapshot reads a bounded ring-buffer tail (cap 400 lines) — never the whole file.

## Files

### Removed
- Entire `android/` tree (hand-written incomplete Gradle project).

### Added
| Path | SHA-256 |
|------|---------|
| android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java | accdd8f9ee348668927c582ebdfe4008072cee96bd60556bb3cc4b4e27c34179 |
| android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java | 396981379186bebd045e9c0b18205ff3506df60deb27d849d6d91b24380a29d3 |
| android-overlay/app/src/main/java/com/axon/app/MainActivity.java | ef780117b85f32e6d987adf4d0b81fcc50f30e30e4c8755cac98ea27f5a90c4d |
| android-overlay/app/src/main/res/drawable/ic_notification.xml | 2b1cab7c2183f3e5ed5033182a4fd2acdb15a3143f1d0655a65a0a72237ee23e |
| android-overlay/manifest-additions.xml | (doc fragment) |
| scripts/apply-android-overlay.sh | 0add689ff17214c441f60ff67ae303984b0aceca19253f6b62036247618f3469 |
| scripts/device-test-background-proof.md | 977fd16b796ab16baf56d5049100160740a040434330b553b571cd9c42e5dc16 |
| STAGE6_1_REPORT.md | (this file) |

### Changed
| Path | SHA-256 |
|------|---------|
| .nvmrc | 5378796307535df3ec8d8b15a2e2dc5641419c3d3060cfe32238c0fa973f7aa3 |
| BUILD.md | 57020ee3d8ea979ca4ef1a3cbf1c956c5826c9fd3845875196b5abe5321bc93e |
| src/background/nativeBridge.ts | 3269a0f009c29c3e0a49b1efeea8317c766f17571e2d67beffaff7762b827893 |
| src/background/types.ts | 2bcbfcd46e44c4b03705cc0cb6dc524e615b720153ae87bd09716826290c8ebf |
| src/background/verdict.ts | 494fc45aef4534b0d542e634e51fe77211aaec861539ac15efb9075ef3141e4a |
| tests/verdict.test.ts | 189e2c2d177ff05254c9de1217b97ca1f5bafff3fe9576196107ac51d4c812c9 |

### Confirmed unchanged (byte-identical intent)
| Path | SHA-256 |
|------|---------|
| tsconfig.json | 6624845b5855cb0c547da44d56785371aaf4f77920440f93b685484456952468 |
| vite.config.ts | dba10a7bd34447b337a49186030225cfb2f4eeebf914166709a287a13d22edb9 |
| src/tokens/designTokens.ts | 4d3cc8fe4a998711960415fccb9ba9f845712acdec3754f5c3801d3e5d4d5674 |
| src/types/index.ts | 7fdd2c9a67ba2150f18352e11cb1ee0f22903234281597dcbba45095c72681ae |

Stage 5 UI/screens/tokens/logo/chat/drawer/settings were not edited.

## Command outputs (actual)

### npm install
```
# First attempt: ERESOLVE peer dependency (vite@8.3.1 wants esbuild ^0.27||^0.28, project had ^0.25)
# Retry: npm install --no-audit --no-fund --legacy-peer-deps
# Result: partial node_modules (222 top-level entries including @capacitor/{android,app,cli,core});
# process later received SIGTERM / timed out in sandbox. typescript/tsx package files incomplete.
# No clean "added N packages" success line captured.
```

### npm run lint / build / test:bg
```
NOT RUN TO COMPLETION — incomplete node_modules (missing tsc/tsx binaries).
Owner must re-run after a successful npm install on a normal machine.
```

### APK
```
NOT BUILT — no Android SDK / no generated android/ project in this sandbox.
Owner steps (from BUILD.md):
  npx cap add android
  ./scripts/apply-android-overlay.sh
  npx cap sync android
  cd android && ./gradlew assembleDebug
  # → android/app/build/outputs/apk/debug/app-debug.apk
```

## File count
Project source files (excluding node_modules): overlay Java (3) + icon + scripts (2) + changed TS/MD + original Stage 6 tree minus android/. Count of regular files in delivery zip will be listed at pack time; folders are not counted as files.

## Device test
See `scripts/device-test-background-proof.md`: start counter job, lock screen 30 minutes, check notification chronometer, export JSON, read verdict.

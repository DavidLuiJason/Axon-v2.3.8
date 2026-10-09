# STAGE 6 REPORT — Background Execution Proof

## Status summary

| Layer | Status |
|-------|--------|
| IMPLEMENTED | Yes — web UI, adapters, registrations, native service + plugin source, tests, docs |
| COMPILED (TypeScript / Vite) | See build output below |
| COMPILED (Android APK) | **No APK built** — no Android SDK / Gradle wrapper JAR in this environment |
| RUN-ON-DEVICE | **UNVERIFIED** — owner must test on hardware |

## The one rule

AXON at Stage 5 is preserved; Stage 6 is **additive only**. No design-token, logo, chat, drawer, settings, or existing-screen redesign.

## What was added (new files)

- `capacitor.config.ts`, `.nvmrc`, `BUILD.md`
- `src/background/` — types, elapsedFormat, verdict, webFallbackAdapter, nativeBridge, index
- `src/capabilities/registerBackgroundProof.ts`
- `src/interfaces/registerBackgroundProof.ts`
- `src/components/BackgroundProofScreen.tsx`
- `android/` — Capacitor-oriented project: Manifest (`specialUse` FGS), `BackgroundJobService`, `BackgroundJobsPlugin`, MainActivity, resources, Gradle stubs
- `tests/elapsedFormat.test.ts`, `tests/verdict.test.ts`
- `EVIDENCE.md`, `STAGE6_REPORT.md`

## What changed in existing files (only these)

1. **package.json** — Capacitor deps + scripts (`test:bg`, `cap:sync`, `cap:open`, `android:assemble`)
2. **src/main.tsx** — two register calls (capability + interface), Stage 4C style
3. **src/state/axonState.ts** — `'background-proof'` screen id
4. **src/state/storage.ts** — `VALID_SCREENS` entry
5. **src/App.tsx** — import + route case for `BackgroundProofScreen`
6. **src/components/AxonToolsScreen.tsx** — additive tool entry + navigation (required so the new **tool** is reachable; AxonToolsScreen does not render from the registry)
7. **.gitignore** — append-only Android/Capacitor build outputs

No other existing files were modified.

## Foreground service type

**`specialUse`**

- Android 15+ limits `dataSync` and `mediaProcessing` to 6 hours per 24 hours.
- Source: [Foreground service types](https://developer.android.com/develop/background-work/services/fg-service-types)
- Manifest declares `android:foregroundServiceType="specialUse"` and `PROPERTY_SPECIAL_USE_FGS_SUBTYPE=axon_background_execution_proof`
- `onTimeout`: checkpoint, log `TIMEOUT`, `stopSelf()`

## Behavior implemented

- Native service owns work; JS displays.
- Jobs: open-ended **counter**; finite **steps** demo with real step labels.
- Heartbeat 5s → persistent log; counter persisted; OS restart → `RESTARTED` + gap.
- Notification = activity label + elapsed; POST_NOTIFICATIONS + FGS permissions handled in plugin/manifest.
- Screen: start/stop, adaptive elapsed, live activity label, evidence panel + verdict, health panel, service active yes/no, export JSON.
- Web fallback states plainly it cannot run in background.

## Verification checklist (owner)

- [ ] Existing app looks identical on open (chat / tools / source / capture)
- [ ] Background Proof tool appears under AXON Tools
- [ ] `npm run lint` / `npm run build` / `npm run test:bg` pass
- [ ] On device: heartbeats continue with app backgrounded; evidence → PROVEN RUNNING
- [ ] Idle after stop: no service / no wake lock

## Honest limits

- This sandbox cannot produce or sign an APK.
- Device behavior is **UNVERIFIED** until the owner runs the build steps in `BUILD.md`.
- No fabricated device results.

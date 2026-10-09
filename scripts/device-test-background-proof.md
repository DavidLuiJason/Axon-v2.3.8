# Device test — Background Proof (Stage 6.1)

Owner script for a physical Android device (API 31+ recommended).

## Prerequisites

1. Build and install the debug APK:
   ```bash
   npm install --no-audit --no-fund
   npm run build
   npx cap add android   # if android/ missing
   ./scripts/apply-android-overlay.sh
   npx cap sync android
   cd android && ./gradlew assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
2. Grant notification permission when prompted.
3. Optionally exempt the app from battery optimization (Settings link in the Background Proof screen).

## Test procedure

1. Open AXON → Navigation drawer → **Background Proof**.
2. Tap **Start counter job**.
3. Confirm the notification appears with activity label and a ticking chronometer (elapsed time).
4. **Lock the screen** (power button). Leave locked for **30 minutes**.
5. Unlock. Open the app (or the notification).
6. Check:
   - Notification still present with updated elapsed time / label.
   - On-screen counter / step label advanced.
   - Verdict is **PROVEN RUNNING** (or GAPS DETECTED only if the OS truly paused the service).
7. Tap **Export diagnostics**. Save/share the JSON.
8. Inspect the export:
   - `totals.totalHeartbeats` should be ~360 for 30 min at 5s interval (minus any OS pause).
   - Log contains `STARTED`, `HEARTBEAT` / `SUMMARY`, `WAKELOCK_ACQUIRED`.
   - No unbounded growth of HEARTBEAT lines older than ~10 minutes (SUMMARY + prune).
9. Tap **Stop**. Confirm notification clears, wake lock released (`WAKELOCK_RELEASED` in a subsequent export if captured), idle = no service.

## Expected honest outcomes

| Situation | Verdict |
|-----------|---------|
| Steady 5s native heartbeats, service alive | PROVEN RUNNING |
| OS killed / long gap | GAPS DETECTED |
| User stopped / TIMEOUT | STOPPED |
| startForeground blocked (Android 12+ bg restart) | RESTART BLOCKED |
| Never started | NEVER STARTED |

UI timers and notification chronometers are **not** evidence — only native heartbeat records.

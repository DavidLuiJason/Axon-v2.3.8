# STAGE 6.2d REPORT

## 1. Input
b073809f978b570e7bd3190477bd70595fab297a3344032bf83e6667744cfbd2  /home/workdir/attachments/axon-stage6-2c-result (1).zip

## 2. Pre-check hash
da5aa1c6e74622a11553f1f6e52431863cf74678881272573328a4d4434b52e7  BackgroundJobService.java

## 3. Edit script
exit=0
ab6417fa602b39d2e04ccc2f9cf75a63e0a55a85419a92238140d5af082209de  /tmp/apply_6_2d.py
2613 /tmp/apply_6_2d.py
APPLIED Edit A1
APPLIED Edit A2
APPLIED Edit B
HASH OK 365dc4ca1f03058de8918fc6f5a73aa41168eee668387306c1e61aa0a82cca73  /tmp/work/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java
ALL OK
exit=0

## 4. Proof
### 4a. diff BackgroundJobService.java
--- /tmp/pristine/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java	2026-09-30 18:27:38.000000000 +0000
+++ /tmp/work/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java	2026-09-30 19:59:51.062016119 +0000
@@ -566,13 +566,18 @@
             if (wakeLock != null && wakeLock.isHeld()) return;
             try {
                 PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
-                if (pm == null) return;
+                if (pm == null) {
+                    writeEventLocked("WAKELOCK_ACQUIRE_FAILED", 0);
+                    Log.e(TAG, "WAKELOCK_ACQUIRE_FAILED tag=" + WAKE_LOCK_TAG + " reason=PowerManager unavailable");
+                    return;
+                }
                 wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG);
                 wakeLock.setReferenceCounted(false);
                 wakeLock.acquire(); // held until release; no timeout so job can run long
                 writeEventLocked("WAKELOCK_ACQUIRED", 0);
                 Log.i(TAG, "WAKELOCK_ACQUIRED tag=" + WAKE_LOCK_TAG);
             } catch (Exception e) {
+                writeEventLocked("WAKELOCK_ACQUIRE_FAILED", 0);
                 Log.e(TAG, "acquireWakeLock failed", e);
             }
         }
@@ -586,8 +591,12 @@
                         wakeLock.release();
                         writeEventLocked("WAKELOCK_RELEASED", 0);
                         Log.i(TAG, "WAKELOCK_RELEASED tag=" + WAKE_LOCK_TAG);
+                    } else {
+                        writeEventLocked("WAKELOCK_NOT_HELD_AT_RELEASE", 0);
+                        Log.w(TAG, "WAKELOCK_NOT_HELD_AT_RELEASE tag=" + WAKE_LOCK_TAG);
                     }
                 } catch (Exception e) {
+                    writeEventLocked("WAKELOCK_RELEASE_FAILED", 0);
                     Log.e(TAG, "releaseWakeLock failed", e);
                 }
                 wakeLock = null;
### 4b. event-name counts
3
2
1
6
### 4c. overlay test
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

exit=0
26
0
INFO: all 26 assertions passed

## 5. Pre-package scope gate
Files /tmp/pristine/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java and /tmp/work/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java differ

## 6. Item status
Item 1: IMPLEMENTED=YES  COMPILED=NOT RUN  RUN=NOT RUN

## 7. Still unproven
- Compilation was not run in this stage; compile commands are prohibited by this task.
- No APK was built or run in this stage; the edited service was not run on any device or emulator.
- The three new event names are not yet in the TypeScript type HeartbeatEventType; that is a separate later stage.
- Whether the log records the new events correctly at runtime is untested.
- In the release exception path the wake lock field is still set to null, so a lock that failed to release may remain held; this stage records evidence only and does not change that.
- The new events also advance seq, lastHeartbeatWall and lastWallClockForever through writeEventLocked, like the existing wake-lock events; the effect on gap computation is untested.
- The bash overlay test was run by this stage; it is not an Android build and not a device or emulator runtime test.

## 8. Package checks
Package checks (zip SHA-256, entry count, node_modules count, archive test, re-extract comparison, final scope gate, final Java hash) are not in this file, because this file is inside the zip. They appear in the delivery message under PACKAGE CHECKS.

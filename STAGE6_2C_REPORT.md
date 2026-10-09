# STAGE 6.2c REPORT

## 1. Input
e29c1e74589488858e1565b94c6126080f615a79a18e640b90aa7446d3fa343d  /home/workdir/attachments/axon-stage6-2b-result.zip

## 2. Pre-check hashes
accdd8f9ee348668927c582ebdfe4008072cee96bd60556bb3cc4b4e27c34179  BackgroundJobService.java
396981379186bebd045e9c0b18205ff3506df60deb27d849d6d91b24380a29d3  BackgroundJobsPlugin.java

## 3. Edit script
APPLIED Edit 2A
APPLIED Edit 1A
APPLIED Edit 1B
HASH OK da5aa1c6e74622a11553f1f6e52431863cf74678881272573328a4d4434b52e7  /tmp/work/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java
HASH OK d3b245e9f52c9584a8ab058a5b8676fc12763c369f9ec163c7db6d0f4848fec2  /tmp/work/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java
ALL OK
exit=0

## 4. Proof
### 4a. grep isBlocked
exit=1
### 4b. diff BackgroundJobService.java
--- /tmp/pristine/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java	2026-09-30 11:24:00.000000000 +0000
+++ /tmp/work/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobService.java	2026-09-30 18:27:38.820521497 +0000
@@ -267,29 +267,28 @@
         } catch (Exception e) {
             String msg = e.getClass().getSimpleName() + ": " + e.getMessage();
             Log.e(TAG, "startForeground failed (" + reason + "): " + msg, e);
-            boolean isBlocked = false;
-            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
-                // ForegroundServiceStartNotAllowedException is API 31+
-                if (e.getClass().getSimpleName().equals("ForegroundServiceStartNotAllowedException")
-                        || (e.getCause() != null && e.getCause().getClass().getSimpleName()
-                        .equals("ForegroundServiceStartNotAllowedException"))) {
-                    isBlocked = true;
+            try {
+                synchronized (stateLock) {
+                    writeEventLocked("RESTART_BLOCKED", 0);
+                    // Attach reason into last record via a follow-up if needed; reason stored in stepLabel
+                    stepLabel = "Blocked: " + msg;
+                    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
+                    prefs.edit()
+                            .putBoolean("running", false)
+                            .putString("stepLabel", stepLabel)
+                            .putString("blockReason", msg)
+                            .apply();
                 }
-            }
-            synchronized (stateLock) {
-                writeEventLocked("RESTART_BLOCKED", 0);
-                // Attach reason into last record via a follow-up if needed; reason stored in stepLabel
-                stepLabel = "Blocked: " + msg;
-                SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
-                prefs.edit()
-                        .putBoolean("running", false)
-                        .putString("stepLabel", stepLabel)
-                        .putString("blockReason", msg)
-                        .apply();
+            } catch (Exception recordEx) {
+                Log.e(TAG, "startForeground failure record failed (" + reason + ")", recordEx);
             }
             running.set(false);
             releaseWakeLock();
-            stopSelf();
+            try {
+                stopSelf();
+            } catch (Exception stopEx) {
+                Log.e(TAG, "stopSelf failed after startForeground failure (" + reason + ")", stopEx);
+            }
             return false;
         }
     }
### 4c. diff BackgroundJobsPlugin.java
--- /tmp/pristine/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java	2026-09-30 11:24:25.000000000 +0000
+++ /tmp/work/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java	2026-09-30 18:27:38.820521497 +0000
@@ -85,10 +85,15 @@
         intent.putExtra(BackgroundJobService.EXTRA_JOB_ID, jobId);
         if (stepsCsv != null) intent.putExtra(BackgroundJobService.EXTRA_STEPS, stepsCsv);
 
-        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
-            getContext().startForegroundService(intent);
-        } else {
-            getContext().startService(intent);
+        try {
+            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
+                getContext().startForegroundService(intent);
+            } else {
+                getContext().startService(intent);
+            }
+        } catch (Exception e) {
+            call.reject("startJob failed: " + e.getClass().getSimpleName() + ": " + e.getMessage());
+            return;
         }
 
         JSObject ret = new JSObject();
### 4d. overlay test
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
Files /tmp/pristine/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java and /tmp/work/axon-stage6/android-overlay/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java differ

## 6. Item status
Item 1: IMPLEMENTED=YES  COMPILED=NOT RUN  RUN=NOT RUN
Item 2: IMPLEMENTED=YES  COMPILED=NOT RUN  RUN=NOT RUN

## 7. Still unproven
- Compilation was not run in this stage; compile commands are prohibited by this task.
- No APK was built or run in this stage; the edited service and plugin were not run on any device or emulator.
- The runtime and operating-system behaviour of a synchronous failure from startForegroundService/startService, and of a later failure from startForeground, remains untested.
- What the rejected PluginCall looks like to the JavaScript side is untested.
- The bash overlay test was run by this stage; it is not an Android build and not a device or emulator runtime test.

## 8. Package checks
Package checks (zip SHA-256, entry count, node_modules count, archive test, re-extract comparison, final scope gate, final Java hashes) are not in this file, because this file is inside the zip. They appear in the delivery message under PACKAGE CHECKS.

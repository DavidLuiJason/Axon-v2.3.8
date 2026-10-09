package com.axon.app.background;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import com.axon.app.MainActivity;
import com.axon.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Stage 6.1 — Native foreground service that owns background work.
 *
 * - Started only when a job starts; stopped when the job ends or user stops it.
 * - Idle = no service, no wake lock, no timer.
 * - Heartbeats every 5s on a background ScheduledExecutorService (not main Handler).
 * - PARTIAL_WAKE_LOCK (tag "axon:bgproof") held only while a job is active.
 * - Log: append-only JSON Lines in app-private storage; prefs hold totals.
 * - SUMMARY every ~10 min, then prune detailed HEARTBEAT lines for that window.
 * - All state + log writes serialized via single-thread executor lock.
 * - FGS type: specialUse. onTimeout(int) and onTimeout(int,int) both implemented.
 * - Catch ForegroundServiceStartNotAllowedException → RESTART_BLOCKED.
 */
public class BackgroundJobService extends Service {

    public static final String TAG = "AxonBgJob";
    public static final String CHANNEL_ID = "axon_background_proof";
    public static final int NOTIF_ID = 6001;

    public static final String ACTION_START = "com.axon.app.bg.START";
    public static final String ACTION_STOP = "com.axon.app.bg.STOP";
    public static final String EXTRA_KIND = "kind";
    public static final String EXTRA_STEPS = "steps";
    public static final String EXTRA_JOB_ID = "jobId";

    public static final String PREFS = "axon_bg_proof";
    public static final long HEARTBEAT_MS = 5000L;
    public static final long SUMMARY_WINDOW_MS = 10 * 60 * 1000L; // 10 minutes
    public static final String LOG_FILENAME = "bg_proof_log.jsonl";
    public static final String WAKE_LOCK_TAG = "axon:bgproof";
    /** Max lines returned in a snapshot over the bridge. */
    public static final int SNAPSHOT_LINE_CAP = 400;

    private final Object stateLock = new Object();
    private ScheduledExecutorService scheduler;
    private ScheduledFuture<?> heartbeatFuture;
    private PowerManager.WakeLock wakeLock;

    private final AtomicBoolean running = new AtomicBoolean(false);

    private String jobId;
    private String jobKind; // counter | steps
    private String[] steps;
    private int stepIndex;
    private String stepLabel = "Idle";
    private long startWallClock;
    private int seq;
    private int counterValue;
    private long lastHeartbeatWall;
    private long windowStartWall;
    private int windowHeartbeatCount;
    private long windowFirstWall;
    private long windowLastWall;

    // Per-job totals in prefs (reset when a new job starts; also mirrored in memory while running)
    private int totalHeartbeats;
    private long firstWallClock;
    private long lastWallClockForever;
    private long longestGapMs;
    private int restartCount;
    private int timeoutCount;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "axon-bg-heartbeat");
            t.setDaemon(true);
            return t;
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            // System restart with null intent — try resume from prefs
            if (resumeFromPrefs()) {
                if (!tryBeginForeground("system-restart")) {
                    return START_NOT_STICKY;
                }
                scheduleHeartbeat();
                writeEvent("RESTARTED", gapFromLast());
                return START_STICKY;
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            writeEvent("STOPPED", 0);
            teardown();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_START.equals(action)) {
            jobKind = intent.getStringExtra(EXTRA_KIND);
            if (jobKind == null) jobKind = "counter";
            jobId = intent.getStringExtra(EXTRA_JOB_ID);
            if (jobId == null) jobId = "job-" + System.currentTimeMillis();
            String stepsCsv = intent.getStringExtra(EXTRA_STEPS);
            if (stepsCsv != null && stepsCsv.length() > 0) {
                steps = stepsCsv.split("\\|");
            } else {
                steps = new String[]{
                        "Initializing workspace",
                        "Loading configuration",
                        "Validating permissions",
                        "Preparing counter state",
                        "Writing first checkpoint",
                        "Finalizing demo"
                };
            }
            stepIndex = 0;
            seq = 0;
            counterValue = 0;
            startWallClock = System.currentTimeMillis();
            lastHeartbeatWall = startWallClock;
            windowStartWall = startWallClock;
            windowHeartbeatCount = 0;
            windowFirstWall = 0;
            windowLastWall = 0;
            firstWallClock = startWallClock;
            lastWallClockForever = startWallClock;
            totalHeartbeats = 0;
            longestGapMs = 0;
            restartCount = 0;
            timeoutCount = 0;
            if ("steps".equals(jobKind)) {
                stepLabel = steps[0];
            } else {
                stepLabel = "Counting · 0";
            }
            persistState();
            if (!tryBeginForeground("start")) {
                return START_NOT_STICKY;
            }
            running.set(true);
            acquireWakeLock();
            writeEvent("STARTED", 0);
            scheduleHeartbeat();
            return START_STICKY;
        }

        // Unexpected — try resume
        if (resumeFromPrefs()) {
            if (!tryBeginForeground("resume")) {
                return START_NOT_STICKY;
            }
            scheduleHeartbeat();
            writeEvent("RESTARTED", gapFromLast());
            return START_STICKY;
        }
        stopSelf();
        return START_NOT_STICKY;
    }

    /**
     * Android 15+ timeout for specialUse / other types (single-arg).
     * Checkpoint, log TIMEOUT, release wake lock, stopSelf.
     */
    @Override
    public void onTimeout(int startId) {
        Log.w(TAG, "onTimeout(startId=" + startId + ")");
        handleTimeout();
    }

    /**
     * Android 15+ / compileSdk 35 dual-arg onTimeout (fgsType).
     * Checkpoint, log TIMEOUT, release wake lock, stopSelf.
     */
    @Override
    public void onTimeout(int startId, int fgsType) {
        Log.w(TAG, "onTimeout(startId=" + startId + ", fgsType=" + fgsType + ")");
        handleTimeout();
    }

    private void handleTimeout() {
        synchronized (stateLock) {
            stepLabel = "Timed out by OS";
            timeoutCount += 1;
            writeEventLocked("TIMEOUT", 0);
            persistStateLocked();
        }
        teardown();
        stopSelf();
    }

    @Override
    public void onDestroy() {
        teardown();
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /**
     * Attempt startForeground. On Android 12+ catch ForegroundServiceStartNotAllowedException,
     * write RESTART_BLOCKED, clear running flag, stop cleanly so the app does not crash
     * (Android requires startForeground soon after startForegroundService).
     */
    private boolean tryBeginForeground(String reason) {
        try {
            Notification notification = buildNotification();
            if (Build.VERSION.SDK_INT >= 34) {
                ServiceCompat.startForeground(
                        this,
                        NOTIF_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                );
            } else {
                startForeground(NOTIF_ID, notification);
            }
            running.set(true);
            return true;
        } catch (Exception e) {
            String msg = e.getClass().getSimpleName() + ": " + e.getMessage();
            Log.e(TAG, "startForeground failed (" + reason + "): " + msg, e);
            try {
                synchronized (stateLock) {
                    writeEventLocked("RESTART_BLOCKED", 0);
                    // Attach reason into last record via a follow-up if needed; reason stored in stepLabel
                    stepLabel = "Blocked: " + msg;
                    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
                    prefs.edit()
                            .putBoolean("running", false)
                            .putString("stepLabel", stepLabel)
                            .putString("blockReason", msg)
                            .apply();
                }
            } catch (Exception recordEx) {
                Log.e(TAG, "startForeground failure record failed (" + reason + ")", recordEx);
            }
            running.set(false);
            releaseWakeLock();
            try {
                stopSelf();
            } catch (Exception stopEx) {
                Log.e(TAG, "stopSelf failed after startForeground failure (" + reason + ")", stopEx);
            }
            return false;
        }
    }

    private void beginForeground() {
        tryBeginForeground("legacy");
    }

    private Notification buildNotification() {
        long when = startWallClock > 0 ? startWallClock : System.currentTimeMillis();
        String content = stepLabel != null ? stepLabel : "Working";

        Intent launch = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("AXON Background Proof")
                .setContentText(content)
                .setSmallIcon(R.drawable.ic_notification)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pi)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setWhen(when)
                .setUsesChronometer(true)
                .setShowWhen(true);
        return b.build();
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIF_ID, buildNotification());
        }
    }

    private void scheduleHeartbeat() {
        cancelHeartbeat();
        if (scheduler == null || scheduler.isShutdown()) {
            scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "axon-bg-heartbeat");
                t.setDaemon(true);
                return t;
            });
        }
        // Heartbeats on background scheduled executor, not main-thread Handler,
        // so screen-off / main-thread throttling cannot stall the proof signal.
        heartbeatFuture = scheduler.scheduleAtFixedRate(() -> {
            try {
                onHeartbeatTick();
            } catch (Exception e) {
                Log.e(TAG, "heartbeat tick failed", e);
            }
        }, HEARTBEAT_MS, HEARTBEAT_MS, TimeUnit.MILLISECONDS);
    }

    private void cancelHeartbeat() {
        if (heartbeatFuture != null) {
            heartbeatFuture.cancel(false);
            heartbeatFuture = null;
        }
    }

    private void onHeartbeatTick() {
        if (!running.get()) return;
        synchronized (stateLock) {
            if ("counter".equals(jobKind)) {
                counterValue += 1;
                stepLabel = "Counting · " + counterValue;
                writeEventLocked("HEARTBEAT", 0);
            } else if ("steps".equals(jobKind)) {
                if (stepIndex < steps.length) {
                    stepLabel = steps[stepIndex];
                    writeEventLocked("STEP", 0);
                    writeEventLocked("HEARTBEAT", 0);
                    stepIndex += 1;
                    if (stepIndex >= steps.length) {
                        writeEventLocked("STOPPED", 0);
                        persistStateLocked();
                        // stop outside lock
                        scheduler.execute(() -> {
                            teardown();
                            stopSelf();
                        });
                        return;
                    }
                }
            } else {
                writeEventLocked("HEARTBEAT", 0);
            }
            maybeSummarizeAndPruneLocked();
            persistStateLocked();
        }
        updateNotification();
        BackgroundJobsPlugin.emitSnapshot(this);
    }

    private void writeEvent(String eventType, long gapMs) {
        synchronized (stateLock) {
            writeEventLocked(eventType, gapMs);
        }
    }

    private void writeEventLocked(String eventType, long gapMs) {
        seq += 1;
        long now = System.currentTimeMillis();
        lastWallClockForever = now;
        if ("HEARTBEAT".equals(eventType)) {
            // Longest silent gap between two real heartbeats (the job start counts as the first beat).
            long sinceLastBeat = now - lastHeartbeatWall;
            if (lastHeartbeatWall > 0 && sinceLastBeat > longestGapMs) longestGapMs = sinceLastBeat;
            lastHeartbeatWall = now;
            totalHeartbeats += 1;
            windowHeartbeatCount += 1;
            if (windowFirstWall == 0) windowFirstWall = now;
            windowLastWall = now;
        }
        if ("RESTARTED".equals(eventType)) {
            restartCount += 1;
            if (gapMs > longestGapMs) longestGapMs = gapMs;
        }
        try {
            JSONObject rec = new JSONObject();
            rec.put("jobId", jobId != null ? jobId : "");
            rec.put("seq", seq);
            rec.put("wallClock", now);
            rec.put("elapsedRealtime", SystemClock.elapsedRealtime());
            rec.put("batteryPercent", readBatteryPercent());
            rec.put("stepLabel", stepLabel);
            rec.put("eventType", eventType);
            rec.put("counterValue", counterValue);
            if (("RESTARTED".equals(eventType) || "RESTART_BLOCKED".equals(eventType)) && gapMs > 0) {
                rec.put("gapMs", gapMs);
            }
            appendLogLine(rec.toString());
        } catch (Exception e) {
            Log.e(TAG, "writeEvent failed", e);
        }
    }

    /** Append one JSON line to the private JSONL log file. */
    private void appendLogLine(String line) {
        try {
            File f = logFile();
            try (FileOutputStream fos = new FileOutputStream(f, true);
                 OutputStreamWriter osw = new OutputStreamWriter(fos, StandardCharsets.UTF_8);
                 BufferedWriter bw = new BufferedWriter(osw)) {
                bw.write(line);
                bw.newLine();
            }
        } catch (Exception e) {
            Log.e(TAG, "appendLogLine failed", e);
        }
    }

    private File logFile() {
        return new File(getFilesDir(), LOG_FILENAME);
    }

    /**
     * About every 10 minutes, roll heartbeats into a SUMMARY and prune detailed
     * HEARTBEAT lines for that window. Compact in one batch rewrite.
     */
    private void maybeSummarizeAndPruneLocked() {
        long now = System.currentTimeMillis();
        if (windowStartWall == 0) {
            windowStartWall = now;
            return;
        }
        if (now - windowStartWall < SUMMARY_WINDOW_MS) return;
        if (windowHeartbeatCount == 0) {
            windowStartWall = now;
            return;
        }
        try {
            JSONObject summary = new JSONObject();
            summary.put("jobId", jobId != null ? jobId : "");
            summary.put("seq", seq); // keep current seq; summary is not a heartbeat seq bump beyond last
            summary.put("wallClock", now);
            summary.put("elapsedRealtime", SystemClock.elapsedRealtime());
            summary.put("batteryPercent", readBatteryPercent());
            summary.put("stepLabel", stepLabel);
            summary.put("eventType", "SUMMARY");
            summary.put("counterValue", counterValue);
            summary.put("windowStartWall", windowStartWall);
            summary.put("windowEndWall", windowLastWall > 0 ? windowLastWall : now);
            summary.put("heartbeatCount", windowHeartbeatCount);
            summary.put("firstWall", windowFirstWall);
            summary.put("lastWall", windowLastWall);
            appendLogLine(summary.toString());

            // Prune: keep STARTED, non-HEARTBEAT events, SUMMARY records,
            // and only the last ~10 minutes of HEARTBEAT detail.
            pruneLogLocked(now - SUMMARY_WINDOW_MS);

            windowStartWall = now;
            windowHeartbeatCount = 0;
            windowFirstWall = 0;
            windowLastWall = 0;
        } catch (Exception e) {
            Log.e(TAG, "summarize/prune failed", e);
        }
    }

    private void pruneLogLocked(long keepHeartbeatAfterWall) {
        try {
            File f = logFile();
            if (!f.exists()) return;
            List<String> kept = new ArrayList<>();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(new FileInputStream(f), StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty()) continue;
                    try {
                        JSONObject o = new JSONObject(line);
                        String et = o.optString("eventType", "");
                        long wc = o.optLong("wallClock", 0);
                        if ("HEARTBEAT".equals(et)) {
                            if (wc >= keepHeartbeatAfterWall) {
                                kept.add(line);
                            }
                            // else drop detailed heartbeat older than window
                        } else {
                            // Keep STARTED, STOPPED, RESTARTED, TIMEOUT, RESTART_BLOCKED,
                            // STEP, SUMMARY, WAKELOCK_*, etc.
                            kept.add(line);
                        }
                    } catch (Exception parseEx) {
                        kept.add(line); // keep unparseable rather than drop
                    }
                }
            }
            // Batch rewrite
            File tmp = new File(getFilesDir(), LOG_FILENAME + ".tmp");
            try (FileOutputStream fos = new FileOutputStream(tmp, false);
                 OutputStreamWriter osw = new OutputStreamWriter(fos, StandardCharsets.UTF_8);
                 BufferedWriter bw = new BufferedWriter(osw)) {
                for (String s : kept) {
                    bw.write(s);
                    bw.newLine();
                }
            }
            if (!tmp.renameTo(f)) {
                // fallback copy
                try (FileInputStream in = new FileInputStream(tmp);
                     FileOutputStream out = new FileOutputStream(f, false)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
            }
        } catch (Exception e) {
            Log.e(TAG, "pruneLog failed", e);
        }
    }

    private int readBatteryPercent() {
        try {
            BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE);
            if (bm != null) {
                int pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                if (pct >= 0 && pct <= 100) return pct;
            }
        } catch (Exception ignored) {}
        return -1;
    }

    private void acquireWakeLock() {
        synchronized (stateLock) {
            if (wakeLock != null && wakeLock.isHeld()) return;
            try {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                if (pm == null) {
                    writeEventLocked("WAKELOCK_ACQUIRE_FAILED", 0);
                    Log.e(TAG, "WAKELOCK_ACQUIRE_FAILED tag=" + WAKE_LOCK_TAG + " reason=PowerManager unavailable");
                    return;
                }
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG);
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(); // held until release; no timeout so job can run long
                writeEventLocked("WAKELOCK_ACQUIRED", 0);
                Log.i(TAG, "WAKELOCK_ACQUIRED tag=" + WAKE_LOCK_TAG);
            } catch (Exception e) {
                writeEventLocked("WAKELOCK_ACQUIRE_FAILED", 0);
                Log.e(TAG, "acquireWakeLock failed", e);
            }
        }
    }

    private void releaseWakeLock() {
        synchronized (stateLock) {
            if (wakeLock != null) {
                try {
                    if (wakeLock.isHeld()) {
                        wakeLock.release();
                        writeEventLocked("WAKELOCK_RELEASED", 0);
                        Log.i(TAG, "WAKELOCK_RELEASED tag=" + WAKE_LOCK_TAG);
                    } else {
                        writeEventLocked("WAKELOCK_NOT_HELD_AT_RELEASE", 0);
                        Log.w(TAG, "WAKELOCK_NOT_HELD_AT_RELEASE tag=" + WAKE_LOCK_TAG);
                    }
                } catch (Exception e) {
                    writeEventLocked("WAKELOCK_RELEASE_FAILED", 0);
                    Log.e(TAG, "releaseWakeLock failed", e);
                }
                wakeLock = null;
            }
        }
    }

    private void teardown() {
        cancelHeartbeat();
        releaseWakeLock();
        running.set(false);
        synchronized (stateLock) {
            persistStateLocked();
        }
        try {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } catch (Exception ignored) {}
    }

    private boolean resumeFromPrefs() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        boolean wasRunning = prefs.getBoolean("running", false);
        if (!wasRunning) return false;
        jobId = prefs.getString("jobId", null);
        jobKind = prefs.getString("jobKind", "counter");
        stepLabel = prefs.getString("stepLabel", "Resumed");
        startWallClock = prefs.getLong("startWallClock", System.currentTimeMillis());
        seq = prefs.getInt("seq", 0);
        counterValue = prefs.getInt("counterValue", 0);
        lastHeartbeatWall = prefs.getLong("lastHeartbeatWall", startWallClock);
        stepIndex = prefs.getInt("stepIndex", 0);
        totalHeartbeats = prefs.getInt("totalHeartbeats", 0);
        firstWallClock = prefs.getLong("firstWallClock", startWallClock);
        lastWallClockForever = prefs.getLong("lastWallClock", lastHeartbeatWall);
        longestGapMs = prefs.getLong("longestGapMs", 0);
        restartCount = prefs.getInt("restartCount", 0);
        timeoutCount = prefs.getInt("timeoutCount", 0);
        windowStartWall = System.currentTimeMillis();
        windowHeartbeatCount = 0;
        windowFirstWall = 0;
        windowLastWall = 0;
        String stepsCsv = prefs.getString("stepsCsv", null);
        if (stepsCsv != null && stepsCsv.length() > 0) {
            steps = stepsCsv.split("\\|");
        } else {
            steps = new String[]{"Resumed"};
        }
        running.set(true);
        acquireWakeLock();
        return true;
    }

    private long gapFromLast() {
        long now = System.currentTimeMillis();
        if (lastHeartbeatWall <= 0) return 0;
        return Math.max(0, now - lastHeartbeatWall);
    }

    private void persistState() {
        synchronized (stateLock) {
            persistStateLocked();
        }
    }

    private void persistStateLocked() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        SharedPreferences.Editor ed = prefs.edit();
        ed.putBoolean("running", running.get());
        ed.putString("jobId", jobId);
        ed.putString("jobKind", jobKind);
        ed.putString("stepLabel", stepLabel);
        ed.putLong("startWallClock", startWallClock);
        ed.putInt("seq", seq);
        ed.putInt("counterValue", counterValue);
        ed.putLong("lastHeartbeatWall", lastHeartbeatWall);
        ed.putInt("stepIndex", stepIndex);
        ed.putInt("totalHeartbeats", totalHeartbeats);
        ed.putLong("firstWallClock", firstWallClock);
        ed.putLong("lastWallClock", lastWallClockForever);
        ed.putLong("longestGapMs", longestGapMs);
        ed.putInt("restartCount", restartCount);
        ed.putInt("timeoutCount", timeoutCount);
        if (steps != null) {
            ed.putString("stepsCsv", String.join("|", steps));
        }
        ed.apply();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID,
                    "AXON Background Proof",
                    NotificationManager.IMPORTANCE_LOW
            );
            ch.setDescription("Foreground service for background execution proof");
            ch.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    /**
     * Build a bounded snapshot for the JS bridge: prefs totals + tail of JSONL
     * (never load the whole file into memory unbounded).
     */
    public static JSONObject readSnapshot(Context ctx) {
        JSONObject snap = new JSONObject();
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            boolean prefsRunning = prefs.getBoolean("running", false);
            long lastHb = prefs.getLong("lastHeartbeatWall", 0);
            long now = System.currentTimeMillis();
            // serviceActive from fresh native heartbeat timestamp — NOT stale prefs running flag
            boolean serviceActive = prefsRunning && lastHb > 0
                    && (now - lastHb) < (HEARTBEAT_MS * 3);

            snap.put("jobId", prefs.getString("jobId", null));
            snap.put("jobKind", prefs.getString("jobKind", "counter"));
            snap.put("running", prefsRunning);
            snap.put("serviceActive", serviceActive);
            snap.put("startWallClock", prefs.getLong("startWallClock", 0) > 0
                    ? prefs.getLong("startWallClock", 0) : JSONObject.NULL);
            snap.put("stepLabel", prefs.getString("stepLabel", "Idle"));
            snap.put("counterValue", prefs.getInt("counterValue", 0));
            snap.put("seq", prefs.getInt("seq", 0));
            snap.put("lastHeartbeatWall", lastHb > 0 ? lastHb : JSONObject.NULL);
            snap.put("totalHeartbeats", prefs.getInt("totalHeartbeats", 0));
            snap.put("firstWallClock", prefs.getLong("firstWallClock", 0) > 0
                    ? prefs.getLong("firstWallClock", 0) : JSONObject.NULL);
            snap.put("lastWallClock", prefs.getLong("lastWallClock", 0) > 0
                    ? prefs.getLong("lastWallClock", 0) : JSONObject.NULL);
            snap.put("longestGapMs", prefs.getLong("longestGapMs", 0));
            snap.put("restartCount", prefs.getInt("restartCount", 0));
            snap.put("timeoutCount", prefs.getInt("timeoutCount", 0));
            String blockReason = prefs.getString("blockReason", null);
            if (blockReason != null) snap.put("blockReason", blockReason);

            JSONArray heartbeats = readLogTail(ctx, SNAPSHOT_LINE_CAP);
            snap.put("heartbeats", heartbeats);
        } catch (Exception e) {
            Log.e(TAG, "readSnapshot failed", e);
        }
        return snap;
    }

    /**
     * Read a bounded tail of the JSONL log (last maxLines lines) without loading
     * the entire file into memory at once beyond a modest buffer.
     */
    private static JSONArray readLogTail(Context ctx, int maxLines) {
        JSONArray arr = new JSONArray();
        File f = new File(ctx.getFilesDir(), LOG_FILENAME);
        if (!f.exists()) return arr;
        try {
            // For moderate files, ring-buffer the last maxLines lines
            List<String> ring = new ArrayList<>(maxLines + 1);
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(new FileInputStream(f), StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty()) continue;
                    ring.add(line);
                    if (ring.size() > maxLines) {
                        ring.remove(0);
                    }
                }
            }
            for (String s : ring) {
                try {
                    arr.put(new JSONObject(s));
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            Log.e(TAG, "readLogTail failed", e);
        }
        return arr;
    }

    /**
     * Full export: totals from prefs + all kept log lines (summaries, events, recent detail).
     */
    public static String exportDiagnostics(Context ctx) {
        try {
            JSONObject root = new JSONObject();
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONObject totals = new JSONObject();
            totals.put("totalHeartbeats", prefs.getInt("totalHeartbeats", 0));
            totals.put("firstWallClock", prefs.getLong("firstWallClock", 0));
            totals.put("lastWallClock", prefs.getLong("lastWallClock", 0));
            totals.put("longestGapMs", prefs.getLong("longestGapMs", 0));
            totals.put("restartCount", prefs.getInt("restartCount", 0));
            totals.put("timeoutCount", prefs.getInt("timeoutCount", 0));
            totals.put("running", prefs.getBoolean("running", false));
            totals.put("jobId", prefs.getString("jobId", null));
            totals.put("blockReason", prefs.getString("blockReason", null));
            root.put("totals", totals);

            // Export a larger tail for diagnostics (still bounded)
            JSONArray log = readLogTail(ctx, 2000);
            root.put("log", log);
            root.put("exportedAt", System.currentTimeMillis());
            return root.toString(2);
        } catch (Exception e) {
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }
}

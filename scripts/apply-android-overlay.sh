#!/usr/bin/env bash
# Apply AXON Stage 6.1 android-overlay after `npx cap add android`.
# Safe to run twice (idempotent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OVERLAY="$ROOT/android-overlay"
ANDROID="$ROOT/android"

if [[ ! -d "$ANDROID/app" ]]; then
  echo "ERROR: android/ not found. Run: npx cap add android"
  exit 1
fi

echo "==> Copying Java sources (BackgroundJobService, BackgroundJobsPlugin, FileSaverPlugin, MainActivity)"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/background"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/filesaver"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/background/BackgroundJobService.java" \
      "$ANDROID/app/src/main/java/com/axon/app/background/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/background/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/filesaver/FileSaverPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/filesaver/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/MainActivity.java" \
      "$ANDROID/app/src/main/java/com/axon/app/"

echo "==> Copying notification icon"
mkdir -p "$ANDROID/app/src/main/res/drawable"
cp -f "$OVERLAY/app/src/main/res/drawable/ic_notification.xml" \
      "$ANDROID/app/src/main/res/drawable/"

MANIFEST="$ANDROID/app/src/main/AndroidManifest.xml"
if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: AndroidManifest.xml missing"
  exit 1
fi

echo "==> Patching AndroidManifest.xml permissions (exact set)"
# Ensure each required permission is present exactly once
ensure_perm() {
  local perm="$1"
  if ! grep -q "android.permission.${perm}" "$MANIFEST"; then
    # Insert after <manifest ...> opening tag
    sed -i "s|<manifest \(.*\)>|<manifest \1>\n    <uses-permission android:name=\"android.permission.${perm}\" />|" "$MANIFEST"
    echo "    + added permission $perm"
  else
    echo "    = permission $perm already present"
  fi
}

ensure_perm "POST_NOTIFICATIONS"
ensure_perm "FOREGROUND_SERVICE"
ensure_perm "FOREGROUND_SERVICE_SPECIAL_USE"
ensure_perm "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
ensure_perm "WAKE_LOCK"
ensure_perm "INTERNET"

if ! grep -q "WRITE_EXTERNAL_STORAGE" "$MANIFEST"; then
  sed -i "s|<manifest \(.*\)>|<manifest \1>\n    <uses-permission android:name=\"android.permission.WRITE_EXTERNAL_STORAGE\" android:maxSdkVersion=\"28\" />|" "$MANIFEST"
  echo "    + added permission WRITE_EXTERNAL_STORAGE"
else
  echo "    = permission WRITE_EXTERNAL_STORAGE already present"
fi

echo "==> Ensuring BackgroundJobService declaration"
if ! grep -q "BackgroundJobService" "$MANIFEST"; then
  # Insert service before closing </application>
  SERVICE_XML='        <service
            android:name=".background.BackgroundJobService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Background execution proof: continuous native heartbeat and activity label for reliability measurement. Not media, not data sync." />
        </service>'
  # Use a temp file to insert before </application>
  awk -v svc="$SERVICE_XML" '
    /<\/application>/ { print svc }
    { print }
  ' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  echo "    + added BackgroundJobService"
else
  echo "    = BackgroundJobService already present"
fi

echo "==> Overlay applied successfully."
echo "Next: npx cap sync android && cd android && ./gradlew assembleDebug"

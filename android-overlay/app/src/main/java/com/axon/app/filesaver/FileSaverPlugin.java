package com.axon.app.filesaver;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "FileSaver",
    permissions = {
        @Permission(
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE },
            alias = "storage"
        )
    }
)
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String base64Data = call.getString("base64Data");

        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("fileName is required");
            return;
        }
        if (base64Data == null) {
            call.reject("base64Data is required");
            return;
        }

        byte[] data;
        try {
            data = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid base64Data: " + e.getMessage());
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveUsingMediaStore(call, fileName.trim(), mimeType, data);
        } else {
            if (getPermissionState("storage") != PermissionState.GRANTED) {
                requestPermissionForAlias("storage", call, "storageCallback");
            } else {
                saveLegacy(call, fileName.trim(), mimeType, data);
            }
        }
    }

    @PermissionCallback
    private void storageCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            String fileName = call.getString("fileName");
            String mimeType = call.getString("mimeType", "application/octet-stream");
            String base64Data = call.getString("base64Data");
            if (fileName == null || base64Data == null) {
                call.reject("Missing required parameters after permission grant");
                return;
            }
            try {
                byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                saveLegacy(call, fileName.trim(), mimeType, data);
            } catch (Exception e) {
                call.reject("Failed to process data: " + e.getMessage());
            }
        } else {
            call.reject("Storage permission is required to save to Downloads on Android 9 and below");
        }
    }

    private void saveUsingMediaStore(PluginCall call, String fileName, String mimeType, byte[] data) {
        try {
            ContentResolver resolver = getContext().getContentResolver();
            String finalName = resolveAvailableMediaStoreName(resolver, fileName);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, finalName);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, "Download/Axon");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("Failed to create MediaStore entry in Download/Axon");
                return;
            }

            try (OutputStream os = resolver.openOutputStream(uri)) {
                if (os == null) {
                    call.reject("Failed to open output stream for MediaStore entry");
                    return;
                }
                os.write(data);
                os.flush();
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("fileName", finalName);
            ret.put("path", uri.toString());
            ret.put("location", "Downloads/Axon/" + finalName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save to MediaStore: " + e.getMessage(), e);
        }
    }

    private void saveLegacy(PluginCall call, String fileName, String mimeType, byte[] data) {
        try {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File axonDir = new File(downloadsDir, "Axon");
            if (!axonDir.exists()) {
                boolean created = axonDir.mkdirs();
                if (!created && !axonDir.exists()) {
                    call.reject("Failed to create directory: " + axonDir.getAbsolutePath());
                    return;
                }
            }

            String[] parts = splitBaseAndExt(fileName);
            String base = parts[0];
            String ext = parts[1];
            String finalName = fileName;
            File targetFile = new File(axonDir, finalName);
            int counter = 1;
            while (targetFile.exists()) {
                finalName = base + " (" + counter + ")" + ext;
                targetFile = new File(axonDir, finalName);
                counter++;
            }

            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(data);
                fos.flush();
            }

            MediaScannerConnection.scanFile(
                getContext(),
                new String[] { targetFile.getAbsolutePath() },
                new String[] { mimeType },
                null
            );

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("fileName", finalName);
            ret.put("path", targetFile.getAbsolutePath());
            ret.put("location", "Downloads/Axon/" + finalName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save to Downloads directory: " + e.getMessage(), e);
        }
    }

    private String resolveAvailableMediaStoreName(ContentResolver resolver, String fileName) {
        String[] parts = splitBaseAndExt(fileName);
        String base = parts[0];
        String ext = parts[1];
        String targetName = fileName;
        int counter = 1;

        while (fileExistsInMediaStore(resolver, targetName)) {
            targetName = base + " (" + counter + ")" + ext;
            counter++;
        }
        return targetName;
    }

    private boolean fileExistsInMediaStore(ContentResolver resolver, String displayName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return false;
        }
        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        String selection = MediaStore.Downloads.DISPLAY_NAME + " = ? AND (" +
                           MediaStore.Downloads.RELATIVE_PATH + " = ? OR " +
                           MediaStore.Downloads.RELATIVE_PATH + " = ?)";
        String[] selectionArgs = new String[] { displayName, "Download/Axon/", "Download/Axon" };
        try (Cursor cursor = resolver.query(collection, new String[] { MediaStore.Downloads._ID }, selection, selectionArgs, null)) {
            return cursor != null && cursor.moveToFirst();
        } catch (Exception e) {
            return false;
        }
    }

    private String[] splitBaseAndExt(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > 0) {
            return new String[] { fileName.substring(0, dotIndex), fileName.substring(dotIndex) };
        }
        return new String[] { fileName, "" };
    }
}

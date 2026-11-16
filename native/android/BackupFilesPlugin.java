package com.fitlog.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;
import org.json.JSONObject;

@CapacitorPlugin(name = "BackupFiles")
public class BackupFilesPlugin extends Plugin {
    private boolean validFilename(String name) {
        return name != null && name.matches("FitLog_backup_[A-Za-z0-9_-]+\\.json");
    }

    // Capacitor persists call.getData() twice when an external activity opens.
    // Keep JSON on disk so large backups never enter the saved-state Bundle.
    File stageBackup(PluginCall call) throws Exception {
        String name = call.getString("filename");
        String json = call.getString("data");
        if (!validFilename(name) || json == null) throw new IOException("备份文件名或内容无效");
        new JSONObject(json);
        File root = new File(getContext().getFilesDir(), "fitlog-backups");
        File session = new File(root, UUID.randomUUID().toString());
        if (!session.mkdirs()) throw new IOException("无法创建备份暂存文件");
        File file = new File(session, name);
        try (FileOutputStream stream = new FileOutputStream(file)) {
            stream.write(json.getBytes(StandardCharsets.UTF_8));
            stream.getFD().sync();
        } catch (Exception e) {
            discard(file);
            throw e;
        }
        call.getData().remove("data");
        call.getData().put("backupToken", session.getName());
        return file;
    }

    File stagedBackup(PluginCall call) throws IOException {
        String token = call.getString("backupToken");
        String name = call.getString("filename");
        if (token == null || !token.matches("[0-9a-fA-F-]{36}") || !validFilename(name)) {
            throw new IOException("备份暂存标识无效，请重新导出");
        }
        File file = new File(new File(new File(getContext().getFilesDir(), "fitlog-backups"), token), name);
        if (!file.isFile() || file.length() == 0) throw new IOException("备份暂存文件不存在，请重新导出");
        return file;
    }

    private void discard(File file) {
        if (file != null) {
            file.delete();
            file.getParentFile().delete(); // Only succeeds when this export's directory is empty.
        }
    }

    @PluginMethod
    public void save(PluginCall call) {
        final File file;
        try { file = stageBackup(call); }
        catch (Exception e) { call.reject("无法准备备份文件", e); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, file.getName());
        getActivity().runOnUiThread(() -> {
            try { startActivityForResult(call, intent, "saveResult"); }
            catch (Exception e) { discard(file); call.reject("无法打开系统保存窗口", e); }
        });
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        // Document providers may be slow or remote. Keep their I/O off the UI thread.
        execute(() -> {
            File file = null;
            Uri uri = result.getData() == null ? null : result.getData().getData();
            try {
                if (result.getResultCode() != Activity.RESULT_OK) {
                    try { discard(stagedBackup(call)); } catch (IOException ignored) { }
                    JSObject cancelled = new JSObject(); cancelled.put("cancelled", true); call.resolve(cancelled); return;
                }
                file = stagedBackup(call);
                if (uri == null) throw new IOException("没有获得保存位置");
                long size = copyAndVerify(file, uri);
                String name = file.getName();
                try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst() && cursor.getString(0) != null) name = cursor.getString(0);
                } catch (Exception ignored) { /* Content was verified; display name is optional. */ }
                JSObject saved = new JSObject();
                saved.put("cancelled", false); saved.put("filename", name); saved.put("uri", uri.toString());
                saved.put("bytes", size); saved.put("verified", true);
                call.resolve(saved);
            } catch (Exception e) {
                boolean removed = uri != null && deleteFailedDocument(uri);
                call.reject(removed ? "备份未能完整保存，已清理不完整文件，请重新导出" : "备份未能完整保存，请删除目标位置的不完整文件后重试", e);
            } finally { discard(file); }
        });
    }

    long copyAndVerify(File file, Uri uri) throws IOException {
        try (InputStream input = new FileInputStream(file);
             OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
            if (output == null) throw new IOException("无法打开目标文件");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            output.flush();
        }
        return verifyFile(file, uri);
    }

    private MessageDigest digest() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    private long verifyFile(File file, Uri uri) throws IOException {
        MessageDigest source = digest(), target = digest();
        long count = 0;
        byte[] buffer = new byte[8192];
        int size;
        try (InputStream input = new FileInputStream(file)) {
            while ((size = input.read(buffer)) != -1) source.update(buffer, 0, size);
        }
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IOException("无法读取已保存的文件进行校验");
            while ((size = input.read(buffer)) != -1) { target.update(buffer, 0, size); count += size; }
        }
        if (count == 0 || count != file.length() || !MessageDigest.isEqual(source.digest(), target.digest())) {
            throw new IOException("文件内容校验失败");
        }
        return count;
    }

    boolean deleteFailedDocument(Uri uri) {
        try {
            if (DocumentsContract.isDocumentUri(getContext(), uri)) {
                return DocumentsContract.deleteDocument(getContext().getContentResolver(), uri);
            }
            return getContext().getContentResolver().delete(uri, null, null) > 0;
        } catch (Exception ignored) { return false; }
    }

    @PluginMethod
    public void share(PluginCall call) {
        File staged = null;
        try {
            File file = stageBackup(call);
            staged = file;
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fitlog.backups", file);
            // Read through the actual provider before handing the URI to another app.
            verifyFile(file, uri);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.putExtra(Intent.EXTRA_TITLE, file.getName());
            intent.setClipData(new ClipData(file.getName(), new String[]{"application/json"}, new ClipData.Item(uri)));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(intent, "分享 FitLog 备份文件");
            chooser.setClipData(intent.getClipData());
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            // Recipients may read asynchronously after the chooser closes; retain this file.
            getActivity().runOnUiThread(() -> {
                try { getActivity().startActivity(chooser); call.resolve(); }
                catch (Exception e) { discard(file); call.reject("无法打开系统分享窗口", e); }
            });
        } catch (Exception e) { discard(staged); call.reject("无法生成可读取的分享文件", e); }
    }
}

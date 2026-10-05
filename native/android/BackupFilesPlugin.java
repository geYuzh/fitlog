package com.fitlog.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
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
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

@CapacitorPlugin(name = "BackupFiles")
public class BackupFilesPlugin extends Plugin {
    private boolean valid(PluginCall call) {
        String name = call.getString("filename");
        String json = call.getString("data");
        if (name == null || !name.matches("FitLog_backup_[A-Za-z0-9_-]+\\.json") || json == null) {
            call.reject("备份文件名或内容无效");
            return false;
        }
        try { new JSONObject(json); }
        catch (Exception e) { call.reject("备份 JSON 内容无效", e); return false; }
        return true;
    }

    @PluginMethod
    public void save(PluginCall call) {
        if (!valid(call)) return;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename"));
        try { startActivityForResult(call, intent, "saveResult"); }
        catch (Exception e) { call.reject("无法打开系统保存窗口", e); }
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            JSObject cancelled = new JSObject(); cancelled.put("cancelled", true); call.resolve(cancelled); return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null) { call.reject("没有获得保存位置"); return; }
        try {
            byte[] bytes = call.getString("data").getBytes(StandardCharsets.UTF_8);
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new IOException("无法打开文件");
                stream.write(bytes);
                stream.flush();
            }
            String name = call.getString("filename");
            try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) name = cursor.getString(0);
            } catch (Exception ignored) { /* Writing succeeded; metadata is optional. */ }
            JSObject saved = new JSObject(); saved.put("cancelled", false); saved.put("filename", name); saved.put("uri", uri.toString()); saved.put("bytes", bytes.length);
            call.resolve(saved);
        } catch (Exception e) { call.reject("备份未能完整保存，请重新导出", e); }
    }

    @PluginMethod
    public void share(PluginCall call) {
        if (!valid(call)) return;
        try {
            File directory = new File(getContext().getCacheDir(), "fitlog-backups");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("无法创建备份文件");
            // Each share gets its own directory so earlier recipients can still read their file.
            File session = new File(directory, java.util.UUID.randomUUID().toString());
            if (!session.mkdirs()) throw new IOException("无法创建备份文件");
            File file = new File(session, call.getString("filename"));
            try (FileOutputStream stream = new FileOutputStream(file)) {
                stream.write(call.getString("data").getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fitlog.backups", file);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.setClipData(ClipData.newRawUri("FitLog backup", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(Intent.createChooser(intent, "分享 FitLog 备份文件"));
                    call.resolve();
                } catch (Exception e) { call.reject("无法打开系统分享窗口", e); }
            });
        } catch (Exception e) { call.reject("无法生成分享文件", e); }
    }
}

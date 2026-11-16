package com.fitlog.app;

import android.net.Uri;
import androidx.core.content.FileProvider;

// Android identifies provider instances by class, not just authority.
// Keep this separate from Capacitor's default provider and path configuration.
public class BackupFileProvider extends FileProvider {
    @Override
    public String getType(Uri uri) {
        String name = uri.getLastPathSegment();
        return name != null && name.endsWith(".json") ? "application/json" : super.getType(uri);
    }
}

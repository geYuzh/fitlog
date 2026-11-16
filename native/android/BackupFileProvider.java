package com.fitlog.app;

import androidx.core.content.FileProvider;

// Android identifies provider instances by class, not just authority.
// Keep this separate from Capacitor's default provider and path configuration.
public class BackupFileProvider extends FileProvider {}

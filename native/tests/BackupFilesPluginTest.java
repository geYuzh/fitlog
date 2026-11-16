package com.fitlog.app;

import static org.junit.Assert.*;

import android.app.Activity;
import android.app.Application;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Looper;
import android.os.Parcel;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.shadows.ShadowContentResolver;

/** Tests Android file and lifecycle behavior with synthetic data, never personal backups. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = {28, 36})
@LooperMode(LooperMode.Mode.PAUSED)
public class BackupFilesPluginTest {
    private static final String FILENAME = "FitLog_backup_20261114_test.json";
    private static final String JSON = "{\"version\":1,\"workouts\":[{\"exercise\":\"坐姿哑铃推肩\",\"sets\":[{\"weight\":10,\"reps\":8}]}]}";
    private Application application;
    private CaptureActivity activity;
    private TestPlugin plugin;

    @Before
    public void setUp() {
        application = RuntimeEnvironment.getApplication();
        activity = Robolectric.buildActivity(CaptureActivity.class).setup().get();
        plugin = new TestPlugin(application, activity);
    }

    @Test
    public void largeBackupNeverCrossesActivityBoundaryAndCanBeRecovered() throws Exception {
        StringBuilder text = new StringBuilder("{\"workouts\":[],\"notes\":\"");
        for (int i = 0; i < 150000; i++) text.append("训练记录🚴");
        text.append("\"}");
        byte[] expected = text.toString().getBytes(StandardCharsets.UTF_8);
        assertTrue("Use a backup larger than the Binder limit", expected.length > 2 * 1024 * 1024);
        CapturingCall call = call(text.toString());
        assertTrue("The old double-payload state must exceed Binder capacity", doubleOptionsParcelSize(call.getData()) > 1024 * 1024);

        startSave(call);

        assertNull(call.rejection);
        assertNotNull(plugin.activityIntent);
        assertEquals(Intent.ACTION_CREATE_DOCUMENT, plugin.activityIntent.getAction());
        assertTrue(plugin.activityIntent.hasCategory(Intent.CATEGORY_OPENABLE));
        assertEquals("application/json", plugin.activityIntent.getType());
        assertEquals(FILENAME, plugin.activityIntent.getStringExtra(Intent.EXTRA_TITLE));
        assertFalse("Payload must be removed before Capacitor saves call options", plugin.activityCall.getData().has("data"));
        assertNotNull(call.getString("backupToken"));
        assertTrue("Both copies of saved options must remain small", doubleOptionsParcelSize(call.getData()) < 16 * 1024);
        File staged = plugin.stagedBackup(call);
        assertArrayEquals(expected, Files.readAllBytes(staged.toPath()));

        // An Android process recreation only restores the small serialized call options.
        TestPlugin recreated = new TestPlugin(application, activity);
        CapturingCall restored = new CapturingCall(new JSObject(call.getData().toString()));
        assertEquals(staged.getCanonicalPath(), recreated.stagedBackup(restored).getCanonicalPath());
        assertArrayEquals(expected, Files.readAllBytes(recreated.stagedBackup(restored).toPath()));
    }

    @Test
    public void backupProviderIsDistinctAndContentResolverReadsTheWholeFile() throws Exception {
        installBackupProvider();
        CapturingCall call = call(JSON);
        File staged = plugin.stageBackup(call);
        Uri uri = FileProvider.getUriForFile(application, backupAuthority(), staged);

        assertEquals("content", uri.getScheme());
        assertEquals("application/json", application.getContentResolver().getType(uri));
        try (InputStream input = application.getContentResolver().openInputStream(uri)) {
            assertNotNull(input);
            assertArrayEquals(JSON.getBytes(StandardCharsets.UTF_8), readAll(input));
        }
        try (Cursor cursor = application.getContentResolver().query(uri,
                new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
            assertNotNull(cursor);
            assertTrue(cursor.moveToFirst());
            assertEquals(FILENAME, cursor.getString(0));
            assertEquals(staged.length(), cursor.getLong(1));
        }
    }

    @Test
    public void sharingProvidesReadableUriAndReadGrantsToChooserAndReceiver() throws Exception {
        installBackupProvider();
        CapturingCall call = call(JSON);
        plugin.share(call);
        Shadows.shadowOf(Looper.getMainLooper()).idle();

        assertNull(call.rejection);
        assertNotNull(activity.startedIntent);
        Intent chooser = activity.startedIntent;
        assertEquals(Intent.ACTION_CHOOSER, chooser.getAction());
        Intent send = chooser.getParcelableExtra(Intent.EXTRA_INTENT);
        assertNotNull(send);
        assertEquals(Intent.ACTION_SEND, send.getAction());
        assertEquals("application/json", send.getType());
        Uri uri = send.getParcelableExtra(Intent.EXTRA_STREAM);
        assertNotNull(uri);
        assertReadGrant(send, uri);
        assertReadGrant(chooser, uri);
        try (InputStream input = application.getContentResolver().openInputStream(uri)) {
            assertArrayEquals(JSON.getBytes(StandardCharsets.UTF_8), readAll(input));
        }
    }

    @Test
    public void saveCallbackReportsSuccessOnlyAfterVerifiedNonemptyOutput() throws Exception {
        CapturingCall call = call(JSON);
        startSave(call);
        File staged = plugin.stagedBackup(call);
        TestDocumentProvider target = documentProvider();

        deliverResult(plugin, call, new ActivityResult(Activity.RESULT_OK, new Intent().setData(target.uri)));

        assertNull(call.rejection);
        assertNotNull(call.resolved);
        assertFalse(call.resolved.getBoolean("cancelled"));
        assertTrue(call.resolved.getBoolean("verified"));
        assertEquals(JSON.getBytes(StandardCharsets.UTF_8).length, call.resolved.getLong("bytes"));
        assertArrayEquals(JSON.getBytes(StandardCharsets.UTF_8), Files.readAllBytes(target.file.toPath()));
        assertFalse(target.deleted);
        assertFalse("Verified saves should release their private staging file", staged.exists());
    }

    @Test
    public void cancelledPickerDoesNotWriteOrReportSaved() throws Exception {
        CapturingCall call = call(JSON);
        startSave(call);
        File staged = plugin.stagedBackup(call);
        TestDocumentProvider target = documentProvider();

        deliverResult(plugin, call, new ActivityResult(Activity.RESULT_CANCELED, new Intent().setData(target.uri)));

        assertNull(call.rejection);
        assertNotNull(call.resolved);
        assertTrue(call.resolved.getBoolean("cancelled"));
        assertEquals(0, target.file.length());
        assertEquals(0, target.openCount);
        assertFalse(target.deleted);
        assertFalse("Cancelling should discard the private staging file", staged.exists());
    }

    @Test
    public void failedWriteDeletesTheNewEmptyDocumentAndRejects() throws Exception {
        CapturingCall call = call(JSON);
        startSave(call);
        TestDocumentProvider target = documentProvider();
        Shadows.shadowOf(application.getContentResolver()).registerOutputStreamSupplier(target.uri, () -> new OutputStream() {
            @Override public void write(int value) throws IOException { throw new IOException("simulated disk full"); }
        });

        deliverResult(plugin, call, new ActivityResult(Activity.RESULT_OK, new Intent().setData(target.uri)));

        assertNull(call.resolved);
        assertNotNull(call.rejection);
        assertTrue("A failed new export must not leave a 0 B document", target.deleted);
        assertFalse(target.file.exists());
    }

    @Test
    public void failedSafWriteDeletesThroughDocumentsContract() throws Exception {
        CapturingCall call = call(JSON);
        startSave(call);
        TestDocumentProvider target = documentProvider(true);
        assertTrue(DocumentsContract.isDocumentUri(application, target.uri));
        Shadows.shadowOf(application.getContentResolver()).registerOutputStreamSupplier(target.uri, () -> new OutputStream() {
            @Override public void write(int value) throws IOException { throw new IOException("simulated SAF write failure"); }
        });

        deliverResult(plugin, call, new ActivityResult(Activity.RESULT_OK, new Intent().setData(target.uri)));

        assertNull(call.resolved);
        assertNotNull(call.rejection);
        assertTrue("SAF documents must use the document-provider delete contract", target.documentDeleteCalled);
        assertFalse(target.file.exists());
    }

    @Test
    public void failedCloseDoesNotReportSuccessAndDeletesIncompleteOutput() throws Exception {
        CapturingCall call = call(JSON);
        startSave(call);
        TestDocumentProvider target = documentProvider();
        Shadows.shadowOf(application.getContentResolver()).registerOutputStreamSupplier(target.uri, () -> new OutputStream() {
            @Override public void write(int value) { }
            @Override public void close() throws IOException { throw new IOException("provider failed while closing"); }
        });

        deliverResult(plugin, call, new ActivityResult(Activity.RESULT_OK, new Intent().setData(target.uri)));

        assertNull(call.resolved);
        assertNotNull(call.rejection);
        assertTrue(target.deleted);
    }

    @Test
    public void readbackMismatchIsRejectedAndIncompleteOutputIsDeleted() throws Exception {
        CapturingCall call = call(JSON);
        startSave(call);
        TestDocumentProvider target = documentProvider();
        byte[] corrupted = JSON.getBytes(StandardCharsets.UTF_8);
        corrupted[0] = '['; // Same length: this regression requires hashing, not just a byte count.
        Shadows.shadowOf(application.getContentResolver()).registerInputStreamSupplier(target.uri,
            () -> new ByteArrayInputStream(corrupted));

        deliverResult(plugin, call, new ActivityResult(Activity.RESULT_OK, new Intent().setData(target.uri)));

        assertNull(call.resolved);
        assertNotNull(call.rejection);
        assertTrue(target.deleted);
        assertFalse(target.file.exists());
    }

    private String backupAuthority() { return application.getPackageName() + ".fitlog.backups"; }

    private void installBackupProvider() {
        PackageManager packages = application.getPackageManager();
        ProviderInfo backup = packages.resolveContentProvider(backupAuthority(), PackageManager.GET_META_DATA);
        ProviderInfo capacitor = packages.resolveContentProvider(application.getPackageName() + ".fileprovider", PackageManager.GET_META_DATA);
        assertNotNull("The merged manifest must declare the backup provider", backup);
        assertNotNull(capacitor);
        assertEquals(BackupFileProvider.class.getName(), backup.name);
        assertNotEquals("Android identifies providers by component class, not only authority", capacitor.name, backup.name);
        assertFalse(backup.exported);
        assertTrue(backup.grantUriPermissions);
        // Use the actual merged manifest metadata and actual FileProvider, not a mocked stream.
        Robolectric.buildContentProvider(FileProvider.class).create(capacitor);
        Robolectric.buildContentProvider(BackupFileProvider.class).create(backup);
    }

    private TestDocumentProvider documentProvider() throws Exception {
        return documentProvider(false);
    }

    private TestDocumentProvider documentProvider(boolean saf) throws Exception {
        TestDocumentProvider provider = new TestDocumentProvider();
        provider.file = File.createTempFile("fitlog-export-test", ".json", application.getCacheDir());
        ProviderInfo info = new ProviderInfo();
        info.authority = application.getPackageName() + ".test.documents";
        info.name = TestDocumentProvider.class.getName();
        info.packageName = application.getPackageName();
        info.applicationInfo = application.getApplicationInfo();
        info.exported = false;
        info.grantUriPermissions = true;
        if (saf) {
            Shadows.shadowOf(application.getPackageManager()).addOrUpdateProvider(info);
            Shadows.shadowOf(application.getPackageManager()).addIntentFilterForProvider(
                new ComponentName(info.packageName, info.name),
                new IntentFilter(DocumentsContract.PROVIDER_INTERFACE));
        }
        provider.attachInfo(application, info);
        provider.uri = Uri.parse("content://" + info.authority + "/document/new-backup");
        ShadowContentResolver.registerProviderInternal(info.authority, provider);
        return provider;
    }

    private void startSave(CapturingCall call) {
        plugin.save(call);
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        assertNull("Preparing a valid backup should succeed", call.rejection);
        assertNotNull("Saving must launch the system document picker", plugin.activityIntent);
    }

    private static CapturingCall call(String json) {
        JSObject options = new JSObject();
        options.put("filename", FILENAME);
        options.put("data", json);
        return new CapturingCall(options);
    }

    private static void assertReadGrant(Intent intent, Uri uri) {
        assertEquals(Intent.FLAG_GRANT_READ_URI_PERMISSION, intent.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION);
        ClipData clip = intent.getClipData();
        assertNotNull(clip);
        assertEquals(uri, clip.getItemAt(0).getUri());
    }

    private static int doubleOptionsParcelSize(JSObject data) {
        // Capacitor stores call options both directly and in the plugin's nested state Bundle.
        Bundle nested = new Bundle(); nested.putString("options", data.toString());
        Bundle state = new Bundle(); state.putString("options", data.toString()); state.putBundle("plugin", nested);
        Parcel parcel = Parcel.obtain();
        try { state.writeToParcel(parcel, 0); return parcel.dataSize(); }
        finally { parcel.recycle(); }
    }

    private static void deliverResult(TestPlugin plugin, CapturingCall call, ActivityResult result) throws Exception {
        Method callback = BackupFilesPlugin.class.getDeclaredMethod("saveResult", PluginCall.class, ActivityResult.class);
        callback.setAccessible(true); // Capacitor's dispatcher also makes @ActivityCallback methods accessible.
        callback.invoke(plugin, call, result);
        Shadows.shadowOf(Looper.getMainLooper()).idle();
    }

    private static byte[] readAll(InputStream input) throws IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        return output.toByteArray();
    }

    public static class CaptureActivity extends AppCompatActivity {
        Intent startedIntent;
        @Override protected void onCreate(Bundle state) {
            setTheme(androidx.appcompat.R.style.Theme_AppCompat);
            super.onCreate(state);
        }
        @Override public void startActivity(Intent intent) { startedIntent = intent; }
    }

    private static class TestPlugin extends BackupFilesPlugin {
        private final Context context;
        private final CaptureActivity activity;
        Intent activityIntent;
        PluginCall activityCall;
        TestPlugin(Context context, CaptureActivity activity) { this.context = context; this.activity = activity; }
        @Override public Context getContext() { return context; }
        @Override public AppCompatActivity getActivity() { return activity; }
        @Override public void execute(Runnable work) { work.run(); }
        @Override public void startActivityForResult(PluginCall call, Intent intent, String callbackName) {
            activityCall = call;
            activityIntent = intent;
        }
    }

    private static class CapturingCall extends PluginCall {
        JSObject resolved;
        String rejection;
        CapturingCall(JSObject options) { super(null, "BackupFiles", "test-call", "save", options); }
        @Override public void resolve(JSObject data) { resolved = data; }
        @Override public void resolve() { resolved = new JSObject(); }
        @Override public void reject(String message, String code, Exception exception, JSObject data) { rejection = message; }
    }

    public static class TestDocumentProvider extends ContentProvider {
        File file;
        Uri uri;
        boolean deleted;
        boolean documentDeleteCalled;
        int openCount;
        @Override public boolean onCreate() { return true; }
        @Override public String getType(Uri uri) { return "application/json"; }
        @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
            openCount++;
            return ParcelFileDescriptor.open(file, ParcelFileDescriptor.parseMode(mode));
        }
        @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
            String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
            MatrixCursor cursor = new MatrixCursor(columns);
            MatrixCursor.RowBuilder row = cursor.newRow();
            for (String column : columns) row.add(OpenableColumns.DISPLAY_NAME.equals(column) ? FILENAME : file.length());
            return cursor;
        }
        @Override public int delete(Uri uri, String selection, String[] args) { deleted = true; return file.delete() ? 1 : 0; }
        @Override public Bundle call(String method, String arg, Bundle extras) {
            if ("android:deleteDocument".equals(method)) {
                documentDeleteCalled = true;
                if (delete(uri, null, null) == 0) throw new IllegalStateException("Unable to delete test document");
                return new Bundle();
            }
            return super.call(method, arg, extras);
        }
        @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
        @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    }
}

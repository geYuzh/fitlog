const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'android/app/src/main');
const java = path.join(app, 'java/com/fitlog/app');
if (!fs.existsSync(path.join(java, 'MainActivity.java'))) throw new Error('Run npx cap add android first');
for (const name of ['MainActivity.java', 'BackupFilesPlugin.java']) fs.copyFileSync(path.join(root, 'native/android', name), path.join(java, name));
fs.mkdirSync(path.join(app, 'res/xml'), {recursive: true});
fs.copyFileSync(path.join(root, 'native/android/fitlog_backup_paths.xml'), path.join(app, 'res/xml/fitlog_backup_paths.xml'));
const manifestPath = path.join(app, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('${applicationId}.fitlog.backups')) {
  manifest = manifest.replace('</application>', `    <provider android:name="androidx.core.content.FileProvider" android:authorities="\${applicationId}.fitlog.backups" android:exported="false" android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/fitlog_backup_paths" />
        </provider>
    </application>`);
}
fs.writeFileSync(manifestPath, manifest);
console.log('Prepared native backup save and share support');

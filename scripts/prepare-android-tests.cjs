const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'android/app');
const gradlePath = path.join(app, 'build.gradle');
if (!fs.existsSync(gradlePath)) throw new Error('Run npx cap add android and prepare-android.cjs first');
const destination = path.join(app, 'src/test/java/com/fitlog/app');
fs.mkdirSync(destination, {recursive: true});
fs.copyFileSync(path.join(root, 'native/tests/BackupFilesPluginTest.java'), path.join(destination, 'BackupFilesPluginTest.java'));
const marker = '// FitLog native backup regression tests';
const config = `${marker}
android {
    testOptions {
        unitTests.includeAndroidResources = true
        unitTests.all {
            maxHeapSize = '2g'
            jvmArgs += [
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '--add-opens=java.base/java.util=ALL-UNNAMED',
                '--add-opens=java.base/java.io=ALL-UNNAMED',
                '--add-opens=java.base/java.net=ALL-UNNAMED',
                '--add-opens=java.base/java.security=ALL-UNNAMED',
                '--add-opens=java.base/java.text=ALL-UNNAMED',
                '--add-opens=java.base/jdk.internal.access=ALL-UNNAMED',
                '--add-opens=java.desktop/java.awt.font=ALL-UNNAMED',
                '--add-opens=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED'
            ]
            testLogging { events 'passed', 'skipped', 'failed'; exceptionFormat 'full' }
        }
    }
}
dependencies {
    testImplementation 'org.robolectric:robolectric:4.17'
}
`;
const gradle = fs.readFileSync(gradlePath, 'utf8');
const start = gradle.indexOf(marker);
fs.writeFileSync(gradlePath, (start === -1 ? gradle : gradle.slice(0, start)).trimEnd() + '\n\n' + config);
console.log('Prepared native backup tests for Android 9 and Android 16');

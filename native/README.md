# Android 原生备份

导出先把 UTF-8 JSON 暂存在应用私有文件中，打开系统“另存为”窗口时仅传递文件标识，避免大量记录占满 Android 的页面恢复状态。用户选择保存位置后，在后台通过 ContentResolver 写入，再重新读取并比对长度和 SHA-256。只有完整校验通过才返回成功；取消另存为不产生成功提示。写入或校验失败时尝试删除系统已创建的不完整文件。正式文件保存在用户选择的位置。

分享通过 ACTION_SEND 发送 JSON 文件，暂存文件在应用私有目录的 fitlog-backups 子目录。独立的 BackupFileProvider 仅开放这个子目录，分享前通过该 Provider 回读文件，并只授予接收方临时读取权限。暂存文件保留以便接收方稍后读取。打开分享面板不等于文件已发送，界面不会报告“发送成功”。

Android 目录由 Capacitor 生成且不提交。Java 与资源模板保存在 native/android；生成 Android 项目后运行 scripts/prepare-android.cjs 注入插件、Activity 注册和 FileProvider。scripts/prepare-android-tests.cjs 注入原生文件回归测试。GitHub APK 工作流会先运行网页测试和 Android 原生测试，再生成 APK。

本地准备：npm ci → npm run build → npx cap add android（首次）→ node scripts/prepare-android.cjs → npx cap sync android。编译需要 Java 21 和 Android SDK，亦可使用仓库的 GitHub Actions。

手机验收：保存至 Download 后在文件管理中找到 JSON；取消另存为不显示成功；同一天多次导出不覆盖旧备份；分享文件可被接收；导入文件后训练记录、快捷重量和单位恢复。文件写入失败应显示失败提示。

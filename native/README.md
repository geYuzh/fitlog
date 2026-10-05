# Android 原生备份

导出通过 Android 的 ACTION_CREATE_DOCUMENT 打开系统“另存为”窗口，用户选择保存位置后，使用 ContentResolver 写入 UTF-8 JSON。流写入并关闭成功后才返回成功；取消另存为不产生成功提示。文件保存在用户选择的位置，不在应用私有目录。

分享通过 ACTION_SEND 发送 JSON 文件，临时文件在应用缓存的 fitlog-backups 子目录。专用 FileProvider 仅开放这个子目录，并只授予接收方临时读取权限。打开分享面板不等于文件已发送，界面不会报告“发送成功”。

Android 目录由 Capacitor 生成且不提交。Java 与资源模板保存在 native/android；生成 Android 项目后运行 scripts/prepare-android.cjs 注入插件、Activity 注册和 FileProvider。GitHub APK 工作流已经包含这一步。

本地准备：npm ci → npm run build → npx cap add android（首次）→ node scripts/prepare-android.cjs → npx cap sync android。编译需要 Java 21 和 Android SDK，亦可使用仓库的 GitHub Actions。

手机验收：保存至 Download 后在文件管理中找到 JSON；取消另存为不显示成功；同一天多次导出不覆盖旧备份；分享文件可被接收；导入文件后训练记录、快捷重量和单位恢复。文件写入失败应显示失败提示。

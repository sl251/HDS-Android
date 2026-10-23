# HDS-Android 0.1.0-preview.9.6.1

9.6 的签名修复版，功能与 9.6 完全一致，仅调整 APK 签名方案。

## 修复

- `android/app/build.gradle` 的 `signingConfigs.preview` 显式开启 `enableV1Signing`、`enableV2Signing`、`enableV3Signing`。
- 9.6 及更早版本的构建产物只带 v2 签名（v3 为 false）。部分国产 ROM 的安装器（vivo 安全安装检测）在签名方案不完整时读不到证书信息，安装时报「应用未安装：软件包似乎无效 / 安装包缺乏开发者证书」。
- 本版 v3 签名已生效，签名方案为 v2 + v3。v1（JAR signing）未生成：AGP 8 在 `minSdkVersion 26` 下不再产出 v1，Android 7.0 以下才需要它，当前 minSdk 不涉及。

## 验证方式

```bash
apksigner verify --verbose --print-certs HDS-Android-0.1.0-preview.9.6.1-arm64.apk
```

预期输出：

```
Verifies
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
```

证书与历史版本一致：`CN=HDS Android Preview, OU=Development, O=sl251`，可覆盖安装，无需卸载。

## 版本

- versionCode 33（9.6 为 32）
- versionName `0.1.0-preview.9.6.1`
- 功能内容与 9.6 相同，无代码改动

## 安装提示

如果安装仍失败，先确认下载是否完整（对比 SHA256），并改用系统「文件管理」打开 APK，而不是从浏览器下载通知直接安装——部分浏览器转交安装器时会传递不完整的文件。

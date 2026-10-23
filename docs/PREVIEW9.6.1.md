# HDS-Android 0.1.0-preview.9.6.1

9.6 的签名修复版，功能与 9.6 完全一致，仅调整 APK 签名方案。

## 修复

- `android/app/build.gradle` 的 `signingConfigs.preview` 显式开启 `enableV1Signing`、`enableV2Signing`、`enableV3Signing`。
- 此前构建产物只带 v2 签名（v1/v3 均为 false）。部分国产 ROM 的安装器（vivo 安全安装检测）在只有 v2 时读不到证书信息，安装时报「应用未安装：软件包似乎无效 / 安装包缺乏开发者证书」。
- 9.5.3 及更早版本同样是 v2-only，因此本修复对历史版本一并生效；后续构建均签全三种方案。

## 验证方式

```bash
apksigner verify --verbose --print-certs HDS-Android-0.1.0-preview.9.6.1-arm64.apk
```

预期输出包含：

```
Verifies
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
```

证书与历史版本一致：`CN=HDS Android Preview, OU=Development, O=sl251`，可覆盖安装，无需卸载。

## 版本

- versionCode 33（9.6 为 32）
- versionName `0.1.0-preview.9.6.1`
- 功能内容与 9.6 相同，无代码改动

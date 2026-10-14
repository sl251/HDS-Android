# third_party/

本目录存放**构建期**需要的第三方文件副本，不参与运行时分发。它们本来是在
CI 里用 `curl` 从 `raw.githubusercontent.com` 拉的，但那个域名按客户端 IP
限流（HTTP 429），2026-10-14 让 `qq-linux-arm64` job 在编译 PRoot 前白丢一次。
所以改成把文件入库，CI 直接读仓库副本，不再依赖 CDN 可用性。

所有副本都**钉死在固定提交/标签**上，并且校验过内容哈希，改动前先重新核对来源。

## linux-uapi/ashmem.h

- 来源：`https://raw.githubusercontent.com/torvalds/linux/v5.10/drivers/staging/android/uapi/ashmem.h`
- 固定引用：tag `v5.10`
- 大小：1393 字节
- 用途：PRoot 的 `src/extension/ashmem_memfd/` 需要这个 UAPI 头；Android 12+ 用
  ashmem memfd，PRoot fork 靠它做共享内存翻译
- 许可：GPL-2.0 WITH Linux-syscall-note（Linux 内核 UAPI 头标准许可）
- 更新方式：从 `vX.Y` tag 重新取，重跑 `qq-linux-arm64` 确认 PRoot 仍能编译

## proot-patches/termux-proot-operit-android.patch

- 来源：`https://raw.githubusercontent.com/AAswordman/Operit2/dc4c3a9405dc7ed3ef69b2ac9a6ace65374d77cf/tools/android-runtime/patches/termux-proot-operit-android.patch`
- 固定引用：commit `dc4c3a94`（"Improve Flutter package and runtime flows"）
- 大小：1394 字节，40 行
- 用途：给 termux/proot `a7147b50` 打 Android 侧补丁，修 execve/enter.c、
  ashmem_memfd、sysvipc_shm 三个文件，让 PRoot 在 Android 上能正确处理
  child execution 和共享内存
- 许可：跟随 Operit2 仓库
- 更新方式：上游 Operit2 若更新补丁，需同步此副本并重跑 `probe-linux-proot.py`

## 校验

CI 会直接 patch 这两个副本，patch 失败会让 job 立刻失败，所以内容漂移不会
静默通过。若怀疑副本被污染，重新从上面的固定引用拉取并比对
`sha256`：

```bash
# ashmem.h
curl -sSL https://raw.githubusercontent.com/torvalds/linux/v5.10/drivers/staging/android/uapi/ashmem.h | sha256sum
# termux-proot-operit-android.patch
curl -sSL https://raw.githubusercontent.com/AAswordman/Operit2/dc4c3a9405dc7ed3ef69b2ac9a6ace65374d77cf/tools/android-runtime/patches/termux-proot-operit-android.patch | sha256sum
```

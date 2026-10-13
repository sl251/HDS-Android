package io.hdsinterlude.android

import android.content.Context
import android.net.ConnectivityManager
import android.os.Build
import android.os.StatFs
import android.system.Os
import android.system.OsConstants
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.ServerSocket
import java.net.InetAddress
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class HdsRuntime private constructor(private val context: Context) {
    val store = HdsStore(context)
    private val environment = File(store.base, "runtime").apply { mkdirs() }
    private val rootfs = File(environment, "rootfs")
    private val marker = File(environment, "installed.json")
    private val executor = Executors.newSingleThreadExecutor()
    private val output = ArrayDeque<String>()
    @Volatile private var state = "stopped"
    @Volatile private var progress = "等待准备本机运行环境"
    @Volatile private var error = ""
    @Volatile private var process: Process? = null
    @Volatile private var token = ""
    @Volatile private var secret = ""
    @Volatile private var port = 0
    @Volatile private var cancelRequested = false

    private fun installed() = marker.isFile && File(rootfs, "opt/node/bin/node").isFile && File(rootfs, "opt/hds/host.cjs").isFile
    @Synchronized private fun log(line: String) {
        var safe = line.replace(Regex("\\u001B\\[[;\\d]*m"), "")
        if (secret.isNotEmpty()) safe = safe.replace(secret, "[REDACTED]")
        if (token.isNotEmpty()) safe = safe.replace(token, "[REDACTED]")
        output.addLast(safe.take(1500)); while (output.size > 200) output.removeFirst()
    }
    @Synchronized fun status(): JSONObject {
        val device = JSONObject().put("model", "${Build.MANUFACTURER} ${Build.MODEL}").put("android", Build.VERSION.RELEASE)
            .put("sdk", Build.VERSION.SDK_INT).put("abi", Build.SUPPORTED_ABIS.joinToString(","))
            .put("pageSize", Os.sysconf(OsConstants._SC_PAGESIZE)).put("availableBytes", StatFs(store.base.absolutePath).availableBytes)
        return JSONObject().put("state", state).put("installed", installed()).put("progress", progress).put("error", error)
            .put("logs", JSONArray(output.toList())).put("device", device).put("version", "0.1.0-preview.1").put("hds", "1.0.1-rc51")
    }
    @Synchronized fun installAsync() {
        require(state !in listOf("installing", "starting", "healthy", "stopping")) { "运行任务忙，请等待或停止后再安装" }
        state = "installing"; error = ""; progress = "验证 APK 内置环境"
        executor.execute { try { installNow(); state = "stopped"; progress = "本机环境已准备，可以启动 HDS" } catch (failure: Throwable) { fail("环境安装失败", failure) } }
    }
    private fun ownedDelete(file: File) {
        require(file.canonicalPath.startsWith(environment.canonicalPath + File.separator)) { "拒绝清理运行目录之外的路径" }
        require(file.name in listOf("staging", "previous")) { "只允许清理托管临时目录" }
        if (file.exists()) require(file.deleteRecursively()) { "无法清理旧安装临时文件" }
    }
    private fun installNow() {
        require(Build.SUPPORTED_ABIS.contains("arm64-v8a")) { "当前预览版只支持 ARM64 手机" }
        val manifest = context.assets.open("runtime/manifest.json").bufferedReader().use { JSONObject(it.readText()) }
        val needed = manifest.getLong("expandedBytes") * 2 + 128L * 1024 * 1024
        require(StatFs(store.base.absolutePath).availableBytes >= needed) { "空间不足，安装需要至少 ${needed / 1024 / 1024} MiB 可用空间" }
        val hash = MessageDigest.getInstance("SHA-256")
        var compressed = 0L
        context.assets.open("runtime/rootfs.bundle").use { input ->
            val buffer = ByteArray(131072)
            while (true) { val size = input.read(buffer); if (size < 0) break; compressed += size; hash.update(buffer, 0, size) }
        }
        require(hash.digest().joinToString("") { "%02x".format(it) } == manifest.getString("sha256") && compressed == manifest.getLong("compressedBytes")) { "运行环境校验失败，请重新安装 APK" }
        for ((name, field) in listOf("libhds_proot.so" to "prootSha256", "libhds_loader.so" to "loaderSha256")) {
            val binary = File(context.applicationInfo.nativeLibraryDir, name)
            require(binary.isFile) { "APK 缺少 ARM64 运行器 $name" }
            val digest = MessageDigest.getInstance("SHA-256")
            binary.inputStream().use { stream -> val buffer = ByteArray(65536); while (true) { val size = stream.read(buffer); if (size < 0) break; digest.update(buffer, 0, size) } }
            require(digest.digest().joinToString("") { "%02x".format(it) } == manifest.getString(field)) { "运行器哈希不匹配" }
        }
        val staging = File(environment, "staging")
        ownedDelete(staging); require(staging.mkdirs()) { "无法创建安装目录" }
        progress = "解包 Ubuntu / Node / HDS，请保持应用打开"
        val root = staging.canonicalPath + File.separator
        val links = mutableListOf<Triple<File, String, Boolean>>()
        var total = 0L; var count = 0
        context.assets.open("runtime/rootfs.bundle").use { asset -> GzipCompressorInputStream(asset).use { gzip -> TarArchiveInputStream(gzip).use { tar ->
            while (true) {
                val entry = tar.nextTarEntry ?: break
                val name = entry.name.removePrefix("./").trimEnd('/')
                if (name.isEmpty() || name == ".") continue
                require(!name.startsWith('/') && !name.split('/').contains("..") && !name.contains('\u0000')) { "解包条目路径越界" }
                require(++count <= 80000) { "解包条目过多" }
                val destination = File(staging, name)
                require(destination.canonicalPath.startsWith(root)) { "解包路径越界" }
                when {
                    entry.isDirectory -> { require(destination.isDirectory || destination.mkdirs()) { "无法创建目录" }; Os.chmod(destination.absolutePath, entry.mode and 511) }
                    entry.isSymbolicLink || entry.isLink -> links.add(Triple(destination, entry.linkName, entry.isLink))
                    entry.isFile -> {
                        require(entry.size in 0..512L * 1024 * 1024) { "解包文件超限" }
                        total += entry.size; require(total <= manifest.getLong("expandedBytes") + 1024 * 1024) { "解包总大小超限" }
                        destination.parentFile?.mkdirs()
                        destination.outputStream().use { file -> tar.copyTo(file, 131072) }
                        Os.chmod(destination.absolutePath, entry.mode and 511)
                        if (count % 700 == 0) progress = "已解包 ${total / 1024 / 1024} MiB · $count 个文件"
                    }
                    else -> throw IllegalArgumentException("运行包含不支持的特殊条目")
                }
            }
        } } }
        for ((destination, target, hard) in links) {
            require(!target.startsWith('/') && !target.contains('\u0000')) { "运行包链接目标无效" }
            val resolved = if (hard) File(staging, target) else File(destination.parentFile, target)
            require(resolved.canonicalPath.startsWith(root)) { "运行包链接目标越界" }
            destination.parentFile?.mkdirs()
            if (hard) Os.link(resolved.absolutePath, destination.absolutePath) else Os.symlink(target, destination.absolutePath)
        }
        require(File(staging, "opt/node/bin/node").isFile && File(staging, "opt/hds/host.cjs").isFile) { "解包缺少 Node 或 HDS" }
        val previous = File(environment, "previous")
        ownedDelete(previous)
        if (rootfs.exists()) require(rootfs.renameTo(previous)) { "无法保留旧运行环境" }
        if (!staging.renameTo(rootfs)) { if (previous.exists()) previous.renameTo(rootfs); throw IllegalStateException("无法切换运行环境") }
        val atomic = android.util.AtomicFile(marker)
        val stream = atomic.startWrite()
        try { stream.write(manifest.toString().toByteArray()); atomic.finishWrite(stream) } catch (failure: Throwable) { atomic.failWrite(stream); throw failure }
        ownedDelete(previous)
        log("环境验证与安装完成；数据目录与环境目录独立")
    }
    @Synchronized fun startAsync() {
        require(state !in listOf("installing", "starting", "healthy", "stopping")) { "HDS 已运行或正在操作" }
        require(installed()) { "请先准备本机环境" }
        store.selectedCard()
        val prefs = store.publicSettings()
        require(prefs.optString("endpoint").isNotBlank() && prefs.optString("model").isNotBlank()) { "请先保存模型设置" }
        cancelRequested = false; state = "starting"; error = ""; progress = "启动手机内的 HDS 核心"
        executor.execute { try { startNow() } catch (failure: Throwable) { process?.destroy(); process = null; fail("HDS 启动失败", failure); context.stopService(android.content.Intent(context, HdsService::class.java)) } }
    }
    private fun startNow() {
        val profile = store.profile()
        val nativeDir = context.applicationInfo.nativeLibraryDir
        val temporary = File(context.cacheDir, "hds-proot").apply { mkdirs() }
        File(rootfs, "tmp").mkdirs()
        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val dns = connectivity.activeNetwork?.let { connectivity.getLinkProperties(it)?.dnsServers }?.mapNotNull { it.hostAddress }?.filter { !it.contains('%') }.orEmpty()
        File(rootfs, "etc/resolv.conf").writeText((if (dns.isEmpty()) listOf("1.1.1.1", "8.8.8.8") else dns).joinToString("\n") { "nameserver $it" } + "\n")
        port = ServerSocket(0, 0, InetAddress.getByName("127.0.0.1")).use { it.localPort }
        token = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32).also { SecureRandom().nextBytes(it) })
        secret = store.apiKey()
        val args = mutableListOf("$nativeDir/libhds_proot.so", "--kill-on-exit", "-0", "-r", rootfs.absolutePath, "-b", "/dev", "-b", "/proc", "-b", "$nativeDir:$nativeDir", "-b", "${profile.absolutePath}:/hds-data")
        for (path in listOf("/system", "/apex", "/linkerconfig")) if (File(path).exists()) args.addAll(listOf("-b", path))
        args.addAll(listOf("-w", "/opt/hds", "/usr/bin/env", "-i", "HOME=/root", "PATH=/opt/node/bin:/usr/bin:/bin", "LANG=C.UTF-8", "TMPDIR=/tmp", "HDS_MOBILE_MAIN=1", "/opt/node/bin/node", "/opt/hds/host.cjs"))
        val builder = ProcessBuilder(args).directory(rootfs).redirectErrorStream(true)
        builder.environment().apply { put("PROOT_LOADER", "$nativeDir/libhds_loader.so"); put("PROOT_TMP_DIR", temporary.absolutePath); put("TMPDIR", temporary.absolutePath); put("PROOT_NO_SECCOMP", "1"); put("LD_LIBRARY_PATH", "") }
        val child = builder.start(); process = child
        val configuration = store.publicSettings().put("card", store.selectedCard()).put("apiKey", secret).put("token", token).put("port", port).put("dataDir", "/hds-data")
        child.outputStream.write((configuration.toString() + "\n").toByteArray(Charsets.UTF_8)); child.outputStream.flush()
        Thread({ child.inputStream.bufferedReader().useLines { lines -> lines.forEach { log(it) } } }, "hds-output").start()
        val deadline = System.currentTimeMillis() + 90000
        var lastFailure = ""
        while (System.currentTimeMillis() < deadline && child.isAlive && !cancelRequested) {
            try { val health = rpc("health", JSONObject()); if (health.getJSONObject("data").optBoolean("sqlite")) { state = "healthy"; progress = "HDS rc51 与 SQLite 已响应 · 本机端口 $port"; error = ""; break } }
            catch (failure: Throwable) { lastFailure = failure.javaClass.simpleName }
            Thread.sleep(500)
        }
        if (state != "healthy") { child.destroy(); throw IllegalStateException("本机核心未在 90 秒内就绪（$lastFailure）；请查看下方日志") }
        Thread({
            val code = child.waitFor()
            if (process === child && state != "stopping") { process = null; state = "failed"; error = "核心进程退出，退出码 $code"; progress = "请查看诊断后重新启动"; log(error); context.stopService(android.content.Intent(context, HdsService::class.java)) }
        }, "hds-exit").start()
    }
    fun stopAsync() { cancelRequested = true; executor.execute { stopNow() } }
    fun stopBlocking() { cancelRequested = true; executor.submit { stopNow() }.get(45, TimeUnit.SECONDS) }
    private fun stopNow() {
        val child = process
        if (child == null) { if (state !in listOf("installing", "failed")) state = "stopped"; return }
        state = "stopping"; progress = "等待 HDS 停止并保存数据库"
        try { child.outputStream.write("STOP\n".toByteArray()); child.outputStream.flush() } catch (_: java.io.IOException) { }
        if (!child.waitFor(15, TimeUnit.SECONDS)) { child.destroy(); if (!child.waitFor(5, TimeUnit.SECONDS)) child.destroyForcibly() }
        require(child.waitFor(5, TimeUnit.SECONDS)) { "核心未能停止；请暂勿切换角色" }
        process = null; token = ""; secret = ""; port = 0; state = "stopped"; progress = "HDS 已停止，剧情保留在本机"; error = ""
    }
    fun rpc(method: String, payload: JSONObject): JSONObject {
        require(method in listOf("health", "messages.history", "messages.sendLocal", "story.snapshot", "story.pause", "story.resume")) { "不允许的本机 API 方法" }
        require(port > 0 && token.isNotEmpty()) { "请先启动 HDS" }
        val connection = URL("http://127.0.0.1:$port/rpc").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"; connection.connectTimeout = 3000; connection.readTimeout = 20000; connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $token"); connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(JSONObject().put("method", method).put("payload", payload).toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.let { String(readLimited(it, 4 * 1024 * 1024), Charsets.UTF_8) } ?: "{}"
            val result = JSONObject(body)
            require(status in 200..299) { result.optString("error", "本机请求失败：$status") }
            return result
        } finally { connection.disconnect() }
    }
    fun testModel(): JSONObject {
        val prefs = store.publicSettings()
        require(prefs.optString("endpoint").isNotEmpty() && prefs.optString("model").isNotEmpty()) { "请先保存模型设置" }
        val connection = URL(prefs.getString("endpoint")).openConnection() as HttpURLConnection
        try {
            connection.instanceFollowRedirects = false; connection.requestMethod = "POST"; connection.connectTimeout = 15000; connection.readTimeout = 60000; connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            val apiKey = store.apiKey(); if (apiKey.isNotEmpty()) connection.setRequestProperty("Authorization", "Bearer $apiKey")
            val body = JSONObject().put("model", prefs.getString("model")).put("max_tokens", 32).put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", "Reply with OK.")))
            connection.outputStream.use { it.write(body.toString().toByteArray()) }
            val status = connection.responseCode
            require(status in 200..299) { "模型连接失败：HTTP $status。请检查完整请求地址、模型与密钥。" }
            val stream = connection.inputStream
            val bytes = readLimited(stream, 1024 * 1024)
            require(bytes.size <= 1024 * 1024 && (JSONObject(String(bytes, Charsets.UTF_8)).optJSONArray("choices")?.length() ?: 0) > 0) { "模型响应没有有效 choices" }
            return JSONObject().put("data", JSONObject().put("message", "模型连接成功（真实 API 请求，可能产生少量费用）。"))
        } finally { connection.disconnect() }
    }
    private fun readLimited(input: InputStream, limit: Int): ByteArray = input.use { stream ->
        val result = ByteArrayOutputStream(); val buffer = ByteArray(8192)
        while (true) { val count = stream.read(buffer); if (count < 0) break; require(result.size() + count <= limit) { "响应超过大小上限" }; result.write(buffer, 0, count) }
        result.toByteArray()
    }
    private fun fail(stage: String, failure: Throwable) { state = "failed"; error = "$stage：${failure.message ?: failure.javaClass.simpleName}"; progress = "可重试；角色与剧情目录保持独立"; log(error) }
    companion object {
        @Volatile private var instance: HdsRuntime? = null
        @JvmStatic fun get(context: Context): HdsRuntime = instance ?: synchronized(this) { instance ?: HdsRuntime(context.applicationContext).also { instance = it } }
    }
}

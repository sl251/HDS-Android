package io.hdsinterlude.android

import android.content.Context
import android.net.ConnectivityManager
import android.os.Build
import android.os.StatFs
import android.system.Os
import android.system.OsConstants
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

    private val transaction = RuntimeTransaction(environment)
    private val diagnosticFile = File(environment, "install-diagnostic.json")
    private val bundled by lazy { context.assets.open("runtime/manifest.json").bufferedReader().use { JSONObject(it.readText()) } }
    @Volatile private var stage = "idle"
    @Volatile private var operation = "idle"
    @Volatile private var attemptId = ""
    @Volatile private var bytesWritten = 0L
    @Volatile private var lastDiagnostic = JSONObject()
    @Volatile private var recoveryError = ""
    @Volatile private var cleanupPending = false
    @Volatile private var layoutDiagnostic = JSONObject()
    fun recordInsets(value: JSONObject) { layoutDiagnostic = value }
    init {
        try {
            transaction.recover()
            if (diagnosticFile.isFile) lastDiagnostic = JSONObject(android.util.AtomicFile(diagnosticFile).openRead().bufferedReader().use { it.readText() })
            if (lastDiagnostic.optString("result") == "in-progress") lastDiagnostic.put("result", "interrupted").put("recovery", "generation-restored")
            cleanupPending = transaction.previous.exists()
        } catch (failure: Exception) { recoveryError = failure.javaClass.simpleName }
    }
    private fun installedManifest(): JSONObject? = try {
        val current = File(rootfs, ".hds-installed.json").takeIf { it.isFile } ?: marker
        if (!current.isFile) null else JSONObject(android.util.AtomicFile(current).openRead().bufferedReader().use { it.readText() })
    } catch (_: Exception) { null }
    private fun environmentState(): String {
        if (recoveryError.isNotEmpty()) return "repair-required"
        val current = installedManifest() ?: return if (rootfs.exists()) "repair-required" else "missing"
        if (!File(rootfs, "opt/node/bin/node").isFile || !File(rootfs, "opt/hds/host.cjs").isFile) return "repair-required"
        return if (listOf("version", "abi", "sha256", "prootSha256", "loaderSha256").all { current.optString(it).isNotEmpty() && current.optString(it) == bundled.optString(it) }) "ready" else "update-required"
    }
    private fun installed() = environmentState() == "ready"
    private fun writeAtomic(file: File, value: JSONObject) {
        val atomic = android.util.AtomicFile(file)
        val stream = atomic.startWrite()
        try { stream.write(value.toString().toByteArray(Charsets.UTF_8)); atomic.finishWrite(stream) }
        catch (failure: Throwable) { atomic.failWrite(stream); throw failure }
    }
    private fun manifestSummary(value: JSONObject?): JSONObject {
        val summary = JSONObject()
        if (value != null) for (key in listOf("version", "abi", "sha256", "compressedBytes", "expandedBytes", "prootSha256", "loaderSha256")) summary.put(key, value.opt(key))
        return summary
    }
    private fun device(): JSONObject {
        val webview = android.webkit.WebView.getCurrentWebViewPackage()
        return JSONObject().put("model", "${Build.MANUFACTURER} ${Build.MODEL}").put("android", Build.VERSION.RELEASE)
            .put("sdk", Build.VERSION.SDK_INT).put("build", Build.DISPLAY).put("abi", Build.SUPPORTED_ABIS.joinToString(","))
            .put("webview", webview?.let { "${it.packageName} ${it.versionName}" } ?: "unavailable")
            .put("pageSize", Os.sysconf(OsConstants._SC_PAGESIZE)).put("availableBytes", StatFs(store.base.absolutePath).availableBytes)
    }
    @Suppress("DEPRECATION")
    private fun appVersion() = context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown"
    @Synchronized private fun log(line: String) {
        var safe = line.replace(Regex("\\u001B\\[[;\\d]*m"), "")
        if (secret.isNotEmpty()) safe = safe.replace(secret, "[REDACTED]")
        if (token.isNotEmpty()) safe = safe.replace(token, "[REDACTED]")
        output.addLast(safe.take(1500)); while (output.size > 200) output.removeFirst()
    }
    @Synchronized fun status(): JSONObject = JSONObject().put("state", state).put("installed", installed())
        .put("environmentState", environmentState()).put("running", process?.isAlive == true).put("cleanupPending", cleanupPending)
        .put("progress", progress).put("error", error).put("logs", JSONArray(output.toList())).put("device", device())
        .put("version", appVersion()).put("hds", "1.0.1-rc51").put("diagnostic", lastDiagnostic)
    fun diagnosticReport(probe: Boolean = false): JSONObject {
        val report = JSONObject().put("schema", 1).put("device", device()).put("appVersion", appVersion())
            .put("environmentState", environmentState()).put("bundled", manifestSummary(bundled))
            .put("installed", manifestSummary(installedManifest())).put("installation", lastDiagnostic)
            .put("cleanupPending", cleanupPending).put("recoveryError", recoveryError).put("avc", "unavailable").put("layout", layoutDiagnostic)
        if (probe) report.put("fileCapabilities", probeFiles())
        // Deliberately excludes runtime output, settings, cards, credentials and chat.
        return report
    }
    private fun errno(failure: Throwable): android.system.ErrnoException? {
        var current: Throwable? = failure
        repeat(16) { if (current is android.system.ErrnoException) return current as android.system.ErrnoException; current = current?.cause }
        return null
    }
    private fun probeFiles(): JSONObject {
        val directory = File(environment, "probe-${java.util.UUID.randomUUID()}")
        val result = JSONObject()
        fun record(name: String, action: () -> Unit) {
            try { action(); result.put(name, JSONObject().put("success", true)) }
            catch (failure: Exception) { val err = errno(failure); result.put(name, JSONObject().put("success", false).put("exception", failure.javaClass.simpleName).put("errno", err?.errno).put("errnoName", err?.let { android.system.OsConstants.errnoName(it.errno) })) }
        }
        try {
            require(directory.mkdir())
            val file = File(directory, "file")
            record("regular") { file.writeText("HDS probe"); require(file.readText() == "HDS probe") }
            record("hardlink") { Os.link(file.absolutePath, File(directory, "hard").absolutePath); require(File(directory, "hard").readText() == "HDS probe") }
            record("symlink") { Os.symlink("file", File(directory, "symbolic").absolutePath); require(File(directory, "symbolic").readText() == "HDS probe") }
        } finally {
            record("cleanup") {
                for (name in listOf("symbolic", "hard", "file")) java.nio.file.Files.deleteIfExists(File(directory, name).toPath())
                java.nio.file.Files.deleteIfExists(directory.toPath())
            }
        }
        return result
    }
    private fun checkpoint(nextStage: String, nextOperation: String = nextStage) {
        stage = nextStage; operation = nextOperation
        lastDiagnostic = JSONObject().put("attemptId", attemptId).put("stage", stage).put("operation", operation)
            .put("bytesWritten", bytesWritten).put("result", "in-progress").put("runtime", manifestSummary(bundled))
        writeAtomic(diagnosticFile, lastDiagnostic)
    }
    private fun checkCancellation() { if (cancelRequested) throw java.util.concurrent.CancellationException("安装已取消") }
    @Synchronized fun cancelInstall() { require(state == "installing") { "没有正在进行的安装" }; cancelRequested = true }
    @Synchronized fun installAsync() {
        require(state !in listOf("installing", "starting", "healthy", "stopping") && process?.isAlive != true) { "运行任务忙，请等待或停止后再安装" }
        cancelRequested = false; attemptId = java.util.UUID.randomUUID().toString(); bytesWritten = 0
        state = "installing"; error = ""; progress = "验证 APK 内置环境"
        executor.execute {
            try { installNow(); state = "stopped"; progress = "环境文件已准备，可以启动 HDS 验证健康状态" }
            catch (failure: Throwable) {
                val entryFailure = failure as? RootfsExtractor.Failure
                val err = errno(failure)
                val cancelled = generateSequence(failure) { it.cause }.any { it is java.util.concurrent.CancellationException }
                lastDiagnostic = JSONObject().put("attemptId", attemptId).put("stage", stage).put("operation", entryFailure?.operation ?: operation)
                    .put("entry", entryFailure?.entry ?: "").put("target", entryFailure?.target ?: "").put("bytesWritten", entryFailure?.bytesWritten ?: bytesWritten)
                    .put("errno", err?.errno).put("errnoName", err?.let { android.system.OsConstants.errnoName(it.errno) })
                    .put("exception", (err ?: failure).javaClass.simpleName).put("result", if (cancelled) "cancelled" else "failed").put("runtime", manifestSummary(bundled))
                try { writeAtomic(diagnosticFile, lastDiagnostic) } catch (_: Exception) { log("安装诊断无法保存") }
                if (cancelled) { state = "stopped"; error = ""; progress = "安装已取消，可重新准备；原环境与剧情保留" }
                else fail("环境安装失败（$stage / ${entryFailure?.entry ?: operation}）", failure)
            }
        }
    }
    private fun installNow() {
        checkpoint("verify")
        require(Build.SUPPORTED_ABIS.contains("arm64-v8a")) { "当前预览版只支持 ARM64 手机" }
        val manifest = bundled
        val expanded = manifest.getLong("expandedBytes")
        require(expanded in 1..(4L * 1024 * 1024 * 1024)) { "运行环境清单大小无效" }
        checkpoint("staging")
        transaction.prepare(); recoveryError = ""
        checkpoint("verify")
        val needed = expanded + 128L * 1024 * 1024
        require(StatFs(store.base.absolutePath).availableBytes >= needed) { "空间不足，安装需要至少 ${needed / 1024 / 1024} MiB 可用空间" }
        val hash = MessageDigest.getInstance("SHA-256")
        var compressed = 0L
        context.assets.open("runtime/rootfs.bundle").use { input ->
            val buffer = ByteArray(131072)
            while (true) { checkCancellation(); val size = input.read(buffer); if (size < 0) break; compressed += size; hash.update(buffer, 0, size) }
        }
        require(hash.digest().joinToString("") { "%02x".format(it) } == manifest.getString("sha256") && compressed == manifest.getLong("compressedBytes")) { "运行环境校验失败，请重新安装 APK" }
        for ((name, field) in listOf("libhds_proot.so" to "prootSha256", "libhds_loader.so" to "loaderSha256")) {
            val binary = File(context.applicationInfo.nativeLibraryDir, name)
            require(binary.isFile) { "APK 缺少 ARM64 运行器 $name" }
            val digest = MessageDigest.getInstance("SHA-256")
            binary.inputStream().use { stream -> val buffer = ByteArray(65536); while (true) { checkCancellation(); val size = stream.read(buffer); if (size < 0) break; digest.update(buffer, 0, size) } }
            require(digest.digest().joinToString("") { "%02x".format(it) } == manifest.getString(field)) { "运行器哈希不匹配" }
        }
        progress = "解包 Ubuntu / Node / HDS，请保持应用打开"
        checkpoint("extract")
        bytesWritten = RootfsExtractor(
            { context.assets.open("runtime/rootfs.bundle") },
            { file, mode -> Os.chmod(file.absolutePath, mode) },
            { target, file -> Os.symlink(target, file.absolutePath) },
            { cancelRequested },
            { bytes, count -> bytesWritten = bytes; progress = "已解包 ${bytes / 1024 / 1024} MiB · $count 个条目" }
        ).extract(transaction.staging, expanded)
        checkpoint("validate")
        require(File(transaction.staging, "opt/node/bin/node").isFile && File(transaction.staging, "opt/hds/host.cjs").isFile) { "解包缺少 Node 或 HDS" }
        writeAtomic(File(transaction.staging, ".hds-installed.json"), manifest)
        checkCancellation()
        checkpoint("activate")
        cleanupPending = !transaction.activate()
        // After activation, diagnostics are best effort; never report a committed install as failed.
        lastDiagnostic = JSONObject().put("attemptId", attemptId).put("stage", "commit").put("operation", "activate")
            .put("result", "success").put("bytesWritten", bytesWritten).put("cleanupPending", cleanupPending).put("runtime", manifestSummary(manifest))
        try { writeAtomic(diagnosticFile, lastDiagnostic) } catch (_: Exception) { log("环境已提交；诊断保存失败") }
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
        args.addAll(listOf("-w", "/opt/hds", "/usr/bin/env", "-i", "HOME=/root", "PATH=/opt/node/bin:/usr/bin:/bin", "LANG=C.UTF-8", "TMPDIR=/tmp",
            // Ubuntu base rootfs ships no /etc/ssl/openssl.cnf and PRoot cannot emulate the open, so pin a real in-guest file and module dir.
            "OPENSSL_CONF=/etc/ssl/openssl.cnf", "OPENSSL_MODULES=/usr/lib/aarch64-linux-gnu/ossl-modules", "HDS_MOBILE_MAIN=1", "/opt/node/bin/node", "/opt/hds/host.cjs"))
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
    private fun fail(stage: String, failure: Throwable) { state = "failed"; error = "$stage：${failure.message ?: failure.javaClass.simpleName}".replace(store.base.absolutePath, "[app-data]"); progress = "可重试；角色与剧情目录保持独立"; log(error) }
    companion object {
        @Volatile private var instance: HdsRuntime? = null
        @JvmStatic fun get(context: Context): HdsRuntime = instance ?: synchronized(this) { instance ?: HdsRuntime(context.applicationContext).also { instance = it } }
    }
}

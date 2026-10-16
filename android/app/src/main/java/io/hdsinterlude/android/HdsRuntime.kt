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

/** Kept pure so device tests can exercise redaction with synthetic placeholders only. */
internal fun sanitizedRuntimeLog(line: String, secrets: List<String>, token: String): String {
    var safe = line.replace(Regex("\\u001B\\[[;\\d]*m"), "")
    for (secret in secrets) if (secret.isNotEmpty()) safe = safe.replace(secret, "[REDACTED]")
    if (token.isNotEmpty()) safe = safe.replace(token, "[REDACTED]")
    return safe.take(1500)
}

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
    @Volatile private var secrets: List<String> = emptyList()
    @Volatile private var port = 0
    @Volatile private var cancelRequested = false
    @Volatile private var startupFailure = ""
    @Volatile private var profileMaintenance = false
    @Volatile private var cleanStop = false
    @Volatile private var backgroundBudget = JSONObject()
    @Volatile private var serviceHealthFailed = false

    fun notificationText(): String = when {
        state == "healthy" && serviceHealthFailed -> "本机健康检查暂未响应，请打开应用查看诊断"
        state == "healthy" && backgroundBudget.optBoolean("exhausted") -> "后台模型预算已用完；直接聊天仍可用，详情见空间"
        state == "healthy" -> "HDS 核心运行中；QQ 连接状态见信箱"
        state == "failed" -> "核心运行失败，请打开应用查看诊断"
        else -> progress
    }
    @Volatile var messagePush: ((String, String, CharacterMessage, Boolean) -> Unit)? = null
    @Volatile var runningCardId = ""
        private set
    @Volatile var runningCardName = ""
        private set
    fun refreshServiceHealth(done: () -> Unit) {
        executor.execute {
            if (state == "healthy" && !profileMaintenance) {
                try { backgroundBudget = rpc("health", JSONObject()).getJSONObject("data").optJSONObject("budget") ?: JSONObject(); serviceHealthFailed = false }
                catch (_: Exception) { serviceHealthFailed = true; log("前台健康检查暂未响应；未重放消息或重启业务") }
            }
            done()
        }
    }

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
    @Volatile private var launchDiagnostic = JSONObject()
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
        val safe = sanitizedRuntimeLog(line, secrets, token)
        if (safe.startsWith("HDS startup failed:")) startupFailure = safe.take(1500)
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
            .put("cleanupPending", cleanupPending).put("recoveryError", recoveryError).put("avc", "unavailable").put("layout", layoutDiagnostic).put("launch", launchDiagnostic)
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
    @Synchronized fun installAsync(startAfterInstall: Boolean = false) {
        require(state !in listOf("installing", "starting", "healthy", "stopping") && process?.isAlive != true) { "运行任务忙，请等待或停止后再安装" }
        cancelRequested = false; attemptId = java.util.UUID.randomUUID().toString(); bytesWritten = 0
        state = "installing"; error = ""; progress = "验证 APK 内置环境"
        executor.execute {
            try {
                installNow()
                if (startAfterInstall) {
                    checkCancellation()
                    state = "starting"; progress = "正在唤醒故事"
                    try { startNow() } catch (failure: Throwable) {
                        process?.destroy(); process = null
                        fail("故事暂时未能醒来", failure)
                        HdsService.stop(context)
                    }
                } else { state = "stopped"; progress = "核心组件已准备好" }
            }
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
                if (startAfterInstall) HdsService.stop(context)
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
        log("环境文件校验与解包完成；Node / HDS 运行状态将在启动时验证")
    }
    @Synchronized fun startAsync() {
        require(!profileMaintenance) { "故事正在备份或维护" }
        require(state !in listOf("installing", "starting", "healthy", "stopping")) { "HDS 已运行或正在操作" }
        store.selectedCard()
        val prefs = store.publicSettings()
        require(prefs.optString("endpoint").isNotBlank() && prefs.optString("model").isNotBlank()) { "请先保存模型设置" }
        if (!installed()) { startupFailure = ""; installAsync(startAfterInstall = true); return }
        cancelRequested = false; startupFailure = ""; state = "starting"; error = ""; progress = "启动手机内的 HDS 核心"
        executor.execute { try { startNow() } catch (failure: Throwable) { process?.destroy(); process = null; fail("HDS 启动失败", failure); HdsService.stop(context) } }
    }
    private fun startNow() {
        cleanStop = false
        backgroundBudget = JSONObject(); serviceHealthFailed = false
        val profile = store.profile()
        val stickerCount = StickerStore(context).exportTo(profile)
        log("表情包启动同步：$stickerCount 张")
        val qqData = File(store.base, "qq").apply { mkdirs() }
        File(rootfs, "qq-data").mkdirs()
        val nativeDir = context.applicationInfo.nativeLibraryDir
        val temporary = File(context.cacheDir, "hds-proot").apply { mkdirs() }
        File(rootfs, "tmp").mkdirs()
        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val dns = connectivity.activeNetwork?.let { connectivity.getLinkProperties(it)?.dnsServers }?.mapNotNull { it.hostAddress }?.filter { !it.contains('%') }.orEmpty()
        File(rootfs, "etc/resolv.conf").writeText((if (dns.isEmpty()) listOf("1.1.1.1", "8.8.8.8") else dns).joinToString("\n") { "nameserver $it" } + "\n")
        port = ServerSocket(0, 0, InetAddress.getByName("127.0.0.1")).use { it.localPort }
        token = Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32).also { SecureRandom().nextBytes(it) })
        val args = listOf("$nativeDir/libhds_proot.so", "--kill-on-exit", "-0", "-r", rootfs.absolutePath,
            "-b", "/dev", "-b", "/dev/pts", "-b", "/proc", "-b", "/sys",
            "-b", "$nativeDir:$nativeDir", "-b", "${profile.absolutePath}:/hds-data", "-b", "${qqData.absolutePath}:/qq-data")
        val attempts = JSONArray()
        launchDiagnostic = JSONObject().put("attempts", attempts)
        val disableSeccomp = ProotLaunch.selectProfile { disabled ->
            checkCancellation()
            val label = if (disabled) "完整追踪" else "seccomp 加速追踪"
            progress = "检查本机 Node / 文件读写（$label）"
            log("PRoot 启动探测：$label")
            val result = probeGuest(args, nativeDir, temporary, disabled)
            attempts.put(JSONObject().put("disableSeccomp", disabled).put("exitCode", result.exitCode ?: JSONObject.NULL)
                .put("timedOut", result.timedOut).put("passed", result.passed).put("output", result.output))
            log("PRoot 探测${if (result.passed) "通过" else "失败"}：$label，退出码 ${result.exitCode}，超时 ${result.timedOut}")
            result.output.lineSequence().filter { it.isNotBlank() }.forEach { log(it) }
            result
        }
        checkCancellation()
        launchDiagnostic.put("selectedDisableSeccomp", disableSeccomp)
        val providers = store.runtimeProviders()
        secrets = (0 until providers.length()).map { providers.getJSONObject(it).optString("apiKey") }
        val builder = ProcessBuilder(args + ProotLaunch.guestArgs()).directory(context.filesDir).redirectErrorStream(true)
        ProotLaunch.configure(builder.environment(), nativeDir, temporary.absolutePath, disableSeccomp)
        log("启动 PRoot：采用已通过探测的${if (disableSeccomp) "完整追踪" else "seccomp 加速追踪"}，直接启动 Node，访客目录 /opt/hds")
        progress = "本机 Node 检查已通过，正在验证 HDS / SQLite"
        val child = builder.start(); process = child
        val prefs = store.publicSettings()
        val configuration = prefs.put("providers", providers).put("card", store.selectedCard()).put("token", token).put("port", port).put("dataDir", "/hds-data").put("qqDir", "/qq-data")
        val cardId = prefs.getString("activeCard")
        val cardName = configuration.getJSONObject("card").getString("name")
        runningCardId = cardId; runningCardName = cardName
        val outputReader = Thread({ child.inputStream.bufferedReader().useLines { lines -> lines.forEach {
            if (it.startsWith("HDS_MSG_PUSH ")) {
                val message = parseMessagePush(it)
                if (message != null) messagePush?.invoke(cardId, cardName, message, AppVisibility.visible)
                else log("忽略无效角色消息标记")
            } else {
                if (it == "HDS_MOBILE_CLEAN_STOP") cleanStop = true
                log(it)
            }
        } } }, "hds-output").apply { start() }
        child.outputStream.write((configuration.toString() + "\n").toByteArray(Charsets.UTF_8)); child.outputStream.flush()
        val deadline = System.currentTimeMillis() + 90000
        var lastFailure = ""
        while (System.currentTimeMillis() < deadline && child.isAlive && !cancelRequested) {
            try { val health = rpc("health", JSONObject()); if (health.getJSONObject("data").optBoolean("sqlite")) { state = "healthy"; progress = "HDS rc51 与 SQLite 已响应 · 本机端口 $port"; error = ""; break } }
            catch (failure: Throwable) { lastFailure = failure.javaClass.simpleName }
            Thread.sleep(500)
        }
        if (state != "healthy") {
            if (cancelRequested) throw IllegalStateException("启动已取消")
            if (!child.isAlive) {
                outputReader.join(1000)
                throw IllegalStateException("本机核心提前退出（退出码 ${child.exitValue()}）${if (startupFailure.isNotEmpty()) "：$startupFailure" else "；请查看下方日志"}")
            }
            child.destroy()
            throw IllegalStateException("本机核心未在 90 秒内就绪（$lastFailure）；请查看下方日志")
        }
        Thread({
            val code = child.waitFor()
            if (process === child && state != "stopping") { process = null; state = "failed"; error = "核心进程退出，退出码 $code"; progress = "请查看诊断后重新启动"; log(error); HdsService.stop(context) }
        }, "hds-exit").start()
    }
    private fun probeGuest(args: List<String>, nativeDir: String, temporary: File, disableSeccomp: Boolean): ProotLaunch.ProbeResult {
        val builder = ProcessBuilder(args + ProotLaunch.guestArgs(true)).directory(context.filesDir).redirectErrorStream(true)
        ProotLaunch.configure(builder.environment(), nativeDir, temporary.absolutePath, disableSeccomp)
        builder.environment()["HDS_MOBILE_MAIN"] = "0"
        val child = try { builder.start() } catch (failure: Exception) {
            return ProotLaunch.ProbeResult(null, false, "HDS_GUEST_PROBE_FAILED stage=spawn code=${failure.javaClass.simpleName}")
        }
        val tail = StringBuilder()
        val reader = Thread({
            try {
                child.inputStream.reader().use { input ->
                    val buffer = CharArray(1024)
                    while (true) {
                        val count = input.read(buffer); if (count < 0) break
                        synchronized(tail) { tail.append(buffer, 0, count); if (tail.length > 4096) tail.delete(0, tail.length - 4096) }
                    }
                }
            } catch (_: java.io.IOException) { }
        }, "hds-probe").apply { isDaemon = true; start() }
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(25)
        var timedOut = false
        try {
            child.outputStream.close()
            while (!child.waitFor(250, TimeUnit.MILLISECONDS)) {
                checkCancellation()
                if (System.nanoTime() >= deadline) { timedOut = true; break }
            }
        } finally {
            if (child.isAlive) { child.destroy(); if (!child.waitFor(1, TimeUnit.SECONDS)) child.destroyForcibly() }
            require(child.waitFor(2, TimeUnit.SECONDS)) { "本机探测进程无法停止，已取消继续启动" }
            reader.join(1000)
            child.inputStream.close()
        }
        val output = synchronized(tail) { tail.toString().replace(store.base.absolutePath, "[app-data]").replace(nativeDir, "[native]") }
        return ProotLaunch.ProbeResult(child.exitValue(), timedOut, output)
    }
    fun stopAsync() { cancelRequested = true; executor.execute { stopNow() } }
    fun stopBlocking() { cancelRequested = true; executor.submit { stopNow(true) }.get(345, TimeUnit.SECONDS) }
    private fun stopNow(preserveStory: Boolean = false) {
        val child = process
        if (child == null) { if (state !in listOf("installing", "failed")) state = "stopped"; return }
        state = "stopping"; progress = "等待 HDS 停止并保存数据库"
        try { child.outputStream.write("STOP\n".toByteArray()); child.outputStream.flush() } catch (_: java.io.IOException) { }
        if (preserveStory) {
            require(child.waitFor(330, TimeUnit.SECONDS)) { "故事还在保存，请稍后重试；尚未切换角色或重启" }
            repeat(20) { if (!cleanStop) Thread.sleep(50) }
            require(cleanStop && child.exitValue() == 0) { "未确认故事保存完成，请重新唤醒后再试" }
        }
        if (!child.waitFor(15, TimeUnit.SECONDS)) { child.destroy(); if (!child.waitFor(5, TimeUnit.SECONDS)) child.destroyForcibly() }
        require(child.waitFor(5, TimeUnit.SECONDS)) { "核心未能停止；请暂勿切换角色" }
        process = null; token = ""; secrets = emptyList(); port = 0; state = "stopped"; progress = "HDS 已停止，剧情保留在本机"; error = ""
    }
    fun rpc(method: String, payload: JSONObject): JSONObject {
        require(!profileMaintenance || method == "health") { "故事正在备份或维护" }
        require(method in listOf("config.status", "preset.sync", "preset.syncStatus", "images.upload", "images.get", "memory.facts", "memory.factSources", "maintenance.start", "maintenance.status", "health", "messages.history", "messages.since", "messages.sendLocal", "story.snapshot", "story.pause", "story.resume", "qq.status", "qq.install", "qq.start", "qq.stop", "qq.refreshQr", "qq.accounts", "qq.quickLogin", "qq.policy", "qq.conversations", "qq.history", "qq.send")) { "不允许的本机 API 方法" }
        require(port > 0 && token.isNotEmpty()) { "请先启动 HDS" }
        val connection = URL("http://127.0.0.1:$port/rpc").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"; connection.connectTimeout = 3000; connection.readTimeout = 20000; connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $token"); connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(JSONObject().put("method", method).put("payload", payload).toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.let { String(readLimited(it, if (method == "images.get") 14 * 1024 * 1024 else 4 * 1024 * 1024), Charsets.UTF_8) } ?: "{}"
            val result = JSONObject(body)
            require(status in 200..299) { result.optString("error", "本机请求失败：$status") }
            return result
        } finally { connection.disconnect() }
    }
    fun testModel(input: JSONObject): JSONObject = JSONObject().put("data", ModelClient().test(store.modelRequest(input, true)))
    fun <T> maintainStory(cardId: String, operation: () -> T): T {
        synchronized(this) { require(!profileMaintenance); profileMaintenance = true }
        return try { executor.submit<T> {
            require(store.publicSettings().optString("activeCard") == cardId) { "当前角色已改变，请重新操作" }
            val child = process
            if (child != null && !child.isAlive) require(cleanStop) { "核心异常退出，尚未确认存档完整性；请重新唤醒并正常保存后操作" }
            if (child != null && child.isAlive) {
                state = "stopping"; progress = "正在保存故事，请稍候"; cleanStop = false
                child.outputStream.write("STOP\n".toByteArray()); child.outputStream.flush()
                require(child.waitFor(330, TimeUnit.SECONDS)) { "故事未能正常停止，操作已取消；请等待模型请求结束" }
                // The output-reader drains the confirmation line before archive access.
                repeat(20) { if (!cleanStop) Thread.sleep(50) }
                require(cleanStop && child.exitValue() == 0) { "未确认数据库保存完成，操作已取消" }
                process = null; token = ""; port = 0; secrets = emptyList()
            }
            state = "stopped"; progress = "故事已保存"; HdsService.stop(context)
            operation()
        }.get() } finally { profileMaintenance = false }
    }
    fun listModels(input: JSONObject): JSONObject = JSONObject().put("data", ModelClient().list(store.modelRequest(input, false)))
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

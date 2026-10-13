package io.hdsinterlude.android

import android.app.Activity
import android.content.Intent
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

@CapacitorPlugin(name = "HdsRuntime")
class HdsRuntimePlugin : Plugin() {
    private val io = Executors.newSingleThreadExecutor()
    private fun runtime() = HdsRuntime.get(context)
    private fun resolve(call: PluginCall, result: JSONObject = JSONObject()) { call.resolve(JSObject.fromJSONObject(result)) }
    private fun run(call: PluginCall, operation: () -> JSONObject) { io.execute { try { resolve(call, operation()) } catch (failure: Throwable) { call.reject(failure.message ?: "原生操作失败", failure.javaClass.simpleName) } } }
    @PluginMethod fun status(call: PluginCall) { resolve(call, runtime().status()) }
    @PluginMethod fun settings(call: PluginCall) { run(call) { runtime().store.publicSettings() } }
    @PluginMethod fun saveSettings(call: PluginCall) { run(call) { runtime().store.saveSettings(call.data); JSONObject() } }
    @PluginMethod fun install(call: PluginCall) { run(call) { runtime().installAsync(); JSONObject() } }
    @PluginMethod fun cancelInstall(call: PluginCall) { run(call) { runtime().cancelInstall(); JSONObject() } }
    @PluginMethod fun diagnostics(call: PluginCall) { run(call) { runtime().diagnosticReport(call.getBoolean("probe", false) == true) } }
    @PluginMethod fun copyDiagnostics(call: PluginCall) { run(call) {
        val text = runtime().diagnosticReport(true).toString(2)
        val clipboard = context.getSystemService(android.content.ClipboardManager::class.java)
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("HDS 安装诊断", text))
        JSONObject()
    } }
    @PluginMethod fun saveDiagnostics(call: PluginCall) {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE)
        intent.putExtra(Intent.EXTRA_TITLE, "HDS-install-diagnostic.json")
        startActivityForResult(call, intent, "diagnosticDestination")
    }
    @ActivityCallback private fun diagnosticDestination(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) { resolve(call, JSONObject().put("cancelled", true)); return }
        val uri = result.data!!.data!!
        run(call) {
            val bytes = runtime().diagnosticReport(true).toString(2).toByteArray(Charsets.UTF_8)
            context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes); it.flush() }
                ?: throw IllegalArgumentException("无法写入所选文档")
            JSONObject().put("cancelled", false)
        }
    }
    @PluginMethod fun start(call: PluginCall) { run(call) {
        // Validate configuration before creating a foreground notification.
        require(runtime().status().getBoolean("installed")) { "请先准备本机环境" }
        runtime().store.selectedCard()
        val settings = runtime().store.publicSettings()
        require(settings.optString("endpoint").isNotEmpty() && settings.optString("model").isNotEmpty()) { "请先保存模型配置" }
        ContextCompat.startForegroundService(context, Intent(context, HdsService::class.java))
        try { runtime().startAsync() } catch (failure: Throwable) { context.stopService(Intent(context, HdsService::class.java)); throw failure }
        JSONObject()
    } }
    @PluginMethod fun stop(call: PluginCall) { run(call) { runtime().stopBlocking(); context.stopService(Intent(context, HdsService::class.java)); JSONObject() } }
    @PluginMethod fun cards(call: PluginCall) { run(call) { JSONObject().put("cards", runtime().store.listCards()) } }
    @PluginMethod fun saveCard(call: PluginCall) { run(call) {
        val text = call.getString("base64") ?: throw IllegalArgumentException("缺少原始卡文件")
        require(text.length <= 45 * 1024 * 1024) { "文件超过大小限制" }
        val card = call.getObject("card") ?: throw IllegalArgumentException("缺少角色卡预览")
        runtime().store.saveCard(card, Base64.decode(text, Base64.NO_WRAP))
    } }
    @PluginMethod fun selectCard(call: PluginCall) { run(call) {
        val id = call.getString("id") ?: throw IllegalArgumentException("缺少角色 ID")
        runtime().stopBlocking(); context.stopService(Intent(context, HdsService::class.java)); runtime().store.select(id); JSONObject()
    } }
    @PluginMethod fun rpc(call: PluginCall) { run(call) {
        val method = call.getString("method") ?: throw IllegalArgumentException("缺少方法")
        if (method == "models.test") runtime().testModel() else runtime().rpc(method, call.getObject("payload") ?: JSONObject())
    } }
    @PluginMethod fun pickCard(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE)
        intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "image/png", "application/octet-stream", "text/plain"))
        startActivityForResult(call, intent, "cardPicked")
    }
    @ActivityCallback private fun cardPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) { call.reject("已取消文件选择"); return }
        val uri = result.data!!.data!!
        run(call) {
            val buffer = ByteArrayOutputStream()
            context.contentResolver.openInputStream(uri)?.use { input ->
                val block = ByteArray(65536)
                while (true) { val count = input.read(block); if (count < 0) break; require(buffer.size() + count <= 32 * 1024 * 1024) { "角色卡超过 32 MiB" }; buffer.write(block, 0, count) }
            } ?: throw IllegalArgumentException("无法读取所选文档")
            JSONObject().put("base64", Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP)).put("name", "所选文档")
        }
    }
}

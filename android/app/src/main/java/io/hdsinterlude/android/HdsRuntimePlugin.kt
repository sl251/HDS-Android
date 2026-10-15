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
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/** Only URI identities cross this boundary; decoding stays sequential on the plugin IO executor. */
internal fun pickedImageUris(result: ActivityResult): List<android.net.Uri> {
    if (result.resultCode != Activity.RESULT_OK) return emptyList()
    val uris = linkedSetOf<android.net.Uri>()
    result.data?.clipData?.let { clip -> for (i in 0 until clip.itemCount) clip.getItemAt(i).uri?.let { uris.add(it) } }
    result.data?.data?.let { uris.add(it) }
    return uris.toList()
}

@CapacitorPlugin(name = "HdsRuntime")
class HdsRuntimePlugin : Plugin() {
    private val io = Executors.newSingleThreadExecutor()
    private fun runtime() = HdsRuntime.get(context)
    private fun resolve(call: PluginCall, result: JSONObject = JSONObject()) { call.resolve(JSObject.fromJSONObject(result)) }
    private fun run(call: PluginCall, operation: () -> JSONObject) { io.execute { try { resolve(call, operation()) } catch (failure: Throwable) { call.reject(failure.message ?: "原生操作失败", failure.javaClass.simpleName) } } }
    @PluginMethod fun status(call: PluginCall) { resolve(call, runtime().status()) }
    @PluginMethod fun settings(call: PluginCall) { run(call) { runtime().store.publicSettings() } }
    @PluginMethod fun appearance(call: PluginCall) { run(call) { AppearanceStore(context).read() } }
    @PluginMethod fun saveAppearance(call: PluginCall) { run(call) { AppearanceStore(context).save(call.data); JSONObject() } }
    @PluginMethod fun pickAppearanceAsset(call: PluginCall) {
        val kind = call.getString("kind")
        if (kind !in listOf("background", "font")) { call.reject("无效界面资源"); return }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).setType(if (kind == "font") "*/*" else "image/*").addCategory(Intent.CATEGORY_OPENABLE)
        startActivityForResult(call, intent, "appearancePicked")
    }
    @ActivityCallback private fun appearancePicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) { resolve(call, JSONObject().put("cancelled", true)); return }
        run(call) { AppearanceStore(context).import(call.getString("kind")!!, result.data!!.data!!) }
    }
    @PluginMethod fun pickImage(call: PluginCall) {
        startActivityForResult(call, Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true), "imagePicked")
    }
    @ActivityCallback private fun imagePicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) { resolve(call, JSONObject().put("cancelled", true)); return }
        val uris = pickedImageUris(result)
        if (uris.isEmpty()) { call.reject("图库未返回可读取的图片"); return }
        val limit = (call.getInt("limit", 3) ?: 3).coerceIn(1, 3)
        run(call) {
            val images = JSONArray(); val errors = JSONArray()
            uris.take(limit).forEachIndexed { index, uri ->
                try { images.put(JSONObject().put("dataUri", AppearanceStore(context).image(uri))) }
                catch (failure: Exception) {
                    val message = failure.message?.takeIf { value -> listOf("文件过大", "图片尺寸", "无法读取所选文件", "无法解码图片", "图片解码失败", "图片压缩后仍过大").any { prefix -> value.startsWith(prefix) } } ?: "图片读取失败，请重新选择"
                    errors.put(JSONObject().put("index", index).put("message", message.take(160)))
                }
            }
            JSONObject().put("cancelled", false).put("images", images).put("errors", errors).put("truncated", uris.size > limit)
        }
    }
    @PluginMethod fun exportStory(call: PluginCall) {
        startActivityForResult(call, Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/zip").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "HDS-story-${java.time.LocalDate.now()}.zip"), "storyDestination")
    }
    @ActivityCallback private fun storyDestination(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) { resolve(call, JSONObject().put("cancelled", true)); return }
        run(call) {
            val id = runtime().store.publicSettings().getString("activeCard")
            runtime().maintainStory(id) {
                context.contentResolver.openOutputStream(result.data!!.data!!, "wt")?.use { StoryArchive(runtime().store.base).export(id, it) } ?: throw IllegalArgumentException("无法写入存档")
            }
            JSONObject().put("cancelled", false)
        }
    }
    @PluginMethod fun restoreStory(call: PluginCall) {
        startActivityForResult(call, Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/zip").addCategory(Intent.CATEGORY_OPENABLE), "storySource")
    }
    @ActivityCallback private fun storySource(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) { resolve(call, JSONObject().put("cancelled", true)); return }
        run(call) {
            val id = call.getString("cardId") ?: throw IllegalArgumentException("缺少角色编号")
            val archive = StoryArchive(runtime().store.base)
            val stage = context.contentResolver.openInputStream(result.data!!.data!!)?.use { archive.stage(id, it) } ?: throw IllegalArgumentException("无法读取存档")
            try { runtime().maintainStory(id) {
                try {
                    archive.replace(id, stage)
                    java.io.File(runtime().store.profile(), "restore-held.json").writeText("{}")
                    archive.commit()
                } catch (error: Throwable) { archive.recover(); throw error }
            } } finally { stage.deleteRecursively() }
            JSONObject().put("cancelled", false)
        }
    }
    @PluginMethod fun resetStory(call: PluginCall) { run(call) {
        val id = call.getString("cardId") ?: throw IllegalArgumentException("缺少角色编号")
        val archive = StoryArchive(runtime().store.base)
        val backup = runtime().maintainStory(id) { try { val backup = archive.replace(id); archive.commit(); backup } catch (error: Throwable) { archive.recover(); throw error } }
        JSONObject().put("backup", backup)
    } }
    @PluginMethod fun restorePreviousStory(call: PluginCall) { run(call) {
        val id = call.getString("cardId") ?: throw IllegalArgumentException("缺少角色编号")
        val archive = StoryArchive(runtime().store.base)
        runtime().maintainStory(id) {
            val stage = archive.stagePrevious(id)
            try { archive.replace(id, stage); java.io.File(runtime().store.profile(), "restore-held.json").writeText("{}"); archive.commit() }
            catch (error: Throwable) { archive.recover(); throw error }
            finally { stage.deleteRecursively() }
        }
        JSONObject()
    } }
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
        runtime().store.selectedCard()
        val settings = runtime().store.publicSettings()
        require(settings.optString("endpoint").isNotEmpty() && settings.optString("model").isNotEmpty()) { "请先保存模型配置" }
        ContextCompat.startForegroundService(context, Intent(context, HdsService::class.java))
        try { runtime().startAsync() } catch (failure: Throwable) { HdsService.stop(context); throw failure }
        JSONObject()
    } }
    @PluginMethod fun saveQQQr(call: PluginCall) {
        val data = call.getString("base64")
        if (data == null || data.length > 256 * 1024 || !data.startsWith("iVBORw0KGgo")) { call.reject("无效二维码 PNG"); return }
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).setType("image/png").addCategory(Intent.CATEGORY_OPENABLE)
        intent.putExtra(Intent.EXTRA_TITLE, "HDS-QQ-login.png")
        startActivityForResult(call, intent, "qqQrDestination")
    }
    @ActivityCallback private fun qqQrDestination(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) { resolve(call, JSONObject().put("cancelled", true)); return }
        val uri = result.data!!.data!!
        run(call) {
            val bytes = Base64.decode(call.getString("base64"), Base64.NO_WRAP)
            context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes) } ?: throw IllegalArgumentException("无法保存二维码")
            JSONObject().put("cancelled", false)
        }
    }
    @PluginMethod fun stop(call: PluginCall) { run(call) { runtime().stopBlocking(); HdsService.stop(context); JSONObject() } }
    @PluginMethod fun cards(call: PluginCall) { run(call) { JSONObject().put("cards", runtime().store.listCards()) } }
    @PluginMethod fun saveCard(call: PluginCall) { run(call) {
        val text = call.getString("base64") ?: throw IllegalArgumentException("缺少原始卡文件")
        require(text.length <= 45 * 1024 * 1024) { "文件超过大小限制" }
        val card = call.getObject("card") ?: throw IllegalArgumentException("缺少角色卡预览")
        runtime().store.saveCard(card, Base64.decode(text, Base64.NO_WRAP))
    } }
    @PluginMethod fun selectCard(call: PluginCall) { run(call) {
        val id = call.getString("id") ?: throw IllegalArgumentException("缺少角色 ID")
        runtime().stopBlocking(); HdsService.stop(context); runtime().store.select(id); JSONObject()
    } }
    @PluginMethod fun updateCard(call: PluginCall) { run(call) {
        val id = call.getString("id") ?: throw IllegalArgumentException("缺少角色 ID")
        val card = call.getObject("card") ?: throw IllegalArgumentException("缺少人设内容")
        if (runtime().store.publicSettings().optString("activeCard") == id) {
            runtime().stopBlocking(); HdsService.stop(context)
        }
        runtime().store.updateCard(id, card)
    } }
    @PluginMethod fun deleteCard(call: PluginCall) { run(call) {
        val id = call.getString("id") ?: throw IllegalArgumentException("缺少角色 ID")
        if (runtime().store.publicSettings().optString("activeCard") == id) {
            runtime().stopBlocking(); HdsService.stop(context)
        }
        runtime().store.deleteCard(id); JSONObject()
    } }
    @PluginMethod fun rpc(call: PluginCall) { run(call) {
        val method = call.getString("method") ?: throw IllegalArgumentException("缺少方法")
        val payload = call.getObject("payload") ?: JSONObject()
        when (method) {
            "models.test" -> runtime().testModel(payload)
            "models.list" -> runtime().listModels(payload)
            else -> runtime().rpc(method, payload)
        }
    } }
    @PluginMethod fun pickCard(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE)
        intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "application/x-json", "text/json", "image/png", "application/octet-stream", "text/plain", "text/yaml", "application/yaml", "application/x-yaml", "application/zip", "application/x-zip-compressed"))
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

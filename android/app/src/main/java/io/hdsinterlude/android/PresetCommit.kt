package io.hdsinterlude.android

import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

internal fun canonicalJson(value: Any?): String = when (value) {
    is JSONObject -> value.keys().asSequence().sorted().joinToString(",", "{", "}") { JSONObject.quote(it) + ":" + canonicalJson(value.opt(it)) }
    is JSONArray -> (0 until value.length()).joinToString(",", "[", "]") { canonicalJson(value.opt(it)) }
    null, JSONObject.NULL -> "null"
    is String -> JSONObject.quote(value)
    else -> value.toString()
}

/** Durable roll-forward. A lost host receipt is retried with the same operationId.
 * Only this selected card can finish its journal, including after process death. */
class PresetCommit(private val store: HdsStore, private val rpc: (String, JSONObject) -> JSONObject, private val validate: (String) -> Unit) {
    private fun file(cardId: String): File {
        require(cardId.matches(Regex("[a-f0-9]{64}"))) { "角色编号无效" }
        return File(store.base, "profiles/$cardId/preset-commit.json")
    }
    private fun read(cardId: String): JSONObject? = file(cardId).takeIf { it.exists() }?.let { JSONObject(AtomicFile(it).openRead().bufferedReader().use { r -> r.readText() }) }
    private fun write(cardId: String, record: JSONObject) {
        val target = file(cardId); target.parentFile?.mkdirs(); val atomic = AtomicFile(target); val out = atomic.startWrite()
        try { out.write(record.toString().toByteArray()); atomic.finishWrite(out) } catch (e: Throwable) { atomic.failWrite(out); throw e }
    }
    fun status(): JSONObject {
        val id = store.publicSettings().optString("activeCard")
        if (!id.matches(Regex("[a-f0-9]{64}"))) return JSONObject().put("state", "none")
        val r = read(id) ?: return JSONObject().put("state", "none")
        return JSONObject().put("state", r.optString("state")).put("operationId", r.optString("operationId")).put("cardId", id)
    }
    fun apply(input: JSONObject): JSONObject = synchronized(store) {
        val cardId = input.getString("cardId"); validate(cardId)
        require(store.publicSettings().optString("activeCard") == cardId) { "当前角色已改变" }
        val operationId = input.getString("operationId")
        require(operationId.matches(Regex("[a-zA-Z0-9-]{8,64}"))) { "导入操作编号无效" }
        var record = read(cardId)
        if (record?.optString("operationId") != operationId) {
            require(record == null || record.optString("state") == "committed") { "上次导入尚未完成，请先恢复该操作" }
            val before = store.publicSettings().getJSONObject("mobileConfig")
            val expected = input.getJSONObject("current")
            require(canonicalJson(before) == canonicalJson(expected)) { "生活设置尚未保存或已改变，请保存并重新检查" }
            val preview = rpc("preset.sync", JSONObject().put("code", input.getString("code")).put("current", before).put("fingerprint", input.getString("fingerprint"))).getJSONObject("data")
            val snapshot = rpc("story.snapshot", JSONObject()).getJSONObject("data")
            if (input.has("expectedRevision")) require(input.getString("expectedRevision") == snapshot.getString("settingRevision")) { "故事人设已修改，请重新检查" }
            record = JSONObject().put("operationId", operationId).put("state", "prepared").put("before", before)
                .put("config", preview.getJSONObject("config")).put("storyId", snapshot.getJSONObject("story").getString("id"))
                .put("revision", snapshot.getString("settingRevision"))
            if (input.optBoolean("importPersona", true) && preview.has("storyPatch")) record.put("patch", preview.getJSONObject("storyPatch"))
            write(cardId, record)
        }
        val r = requireNotNull(record)
        if (r.optString("state") == "committed") return JSONObject().put("operationId", operationId).put("state", "committed").put("config", r.getJSONObject("config"))
        // Failure leaves a private, durable operation visible to commitStatus. Never
        // change a different card or guess whether a timed-out host write happened.
        if (r.has("patch")) rpc("story.applySetting", JSONObject().put("operationId", operationId)
            .put("expectedStoryId", r.getString("storyId")).put("expectedRevision", r.getString("revision")).put("patch", r.getJSONObject("patch")))
        r.put("state", "story-applied"); write(cardId, r)
        validate(cardId)
        val current = store.publicSettings().getJSONObject("mobileConfig")
        if (input.optBoolean("keepLocal")) r.put("config", current)
        require(canonicalJson(current) == canonicalJson(r.getJSONObject("before")) || canonicalJson(current) == canonicalJson(r.getJSONObject("config"))) { "生活设置已变更；导入保留在待恢复状态，请勿重复应用" }
        store.saveMobileConfig(r.getJSONObject("config"))
        r.put("state", "committed"); write(cardId, r)
        JSONObject().put("operationId", operationId).put("state", "committed").put("config", r.getJSONObject("config"))
    }
}

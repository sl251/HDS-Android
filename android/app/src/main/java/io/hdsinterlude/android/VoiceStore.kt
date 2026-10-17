package io.hdsinterlude.android

import android.content.Context
import android.net.Uri
import android.util.AtomicFile
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.security.MessageDigest

/** Reserve and commit under the shared lock; provider IO never holds it. */
class VoiceStore(private val context: Context, private val today: () -> String = { LocalDate.now().toString() }, private val credential: () -> String = { HdsStore(context).voiceKey() }) {
    companion object { internal val lock = Any(); private val active = HashSet<String>(); const val MAX_AUDIO = 10 * 1024 * 1024 }
    val base = File(context.noBackupFilesDir, "hds/voice").apply { mkdirs() }
    private fun read(name: String) = File(base, name).let { if (it.exists()) JSONObject(AtomicFile(it).openRead().bufferedReader().use { r -> r.readText() }) else JSONObject() }
    private fun write(name: String, value: JSONObject) {
        val f = AtomicFile(File(base, name)); val out = f.startWrite()
        try { out.write(value.toString().toByteArray()); f.finishWrite(out) } catch (e: Throwable) { f.failWrite(out); throw e }
    }
    fun config(): JSONObject = synchronized(lock) { read("settings.json").apply {
        if (!has("voices")) put("voices", JSONArray().put(JSONObject().put("id", "builtin").put("name", "茉莉").put("type", "builtin").put("value", "茉莉")))
        if (!has("defaultVoiceId")) put("defaultVoiceId", "builtin")
        if (!has("dailyLimit")) put("dailyLimit", 50000)
        if (!has("cooldown")) put("cooldown", 5)
        if (!has("characters")) put("characters", JSONObject())
    } }
    private fun usage(): JSONObject = read("usage.json").apply {
        if (optString("day") != today()) { put("day", today()); put("tokens", 0); put("notified", false); put("requests", JSONObject()) }
        if (!has("characters")) put("characters", JSONObject())
        if (!has("requests")) { val legacy = optLong("tokens"); put("requests", JSONObject().apply { if (legacy > 0) put("legacy-migration", JSONObject().put("state", "unknown").put("tokens", legacy)) }) }
        val requests = getJSONObject("requests")
        requests.keys().forEach { id -> val r = requests.getJSONObject(id); if (r.optString("state") == "reserved" && !active.contains(base.absolutePath + id)) r.put("state", "unknown") }
        val pendingCards = requests.keys().asSequence().map { requests.getJSONObject(it) }.filter { it.optString("state") == "reserved" }.map { it.optString("cardId") }.toSet()
        getJSONObject("characters").keys().forEach { id -> if (id !in pendingCards) getJSONObject("characters").getJSONObject(id).put("pending", false) }
    }
    fun state(): JSONObject = synchronized(lock) {
        val c = config(); val u = usage(); val limit = c.getInt("dailyLimit")
        if (limit > 0 && u.optLong("tokens") >= limit && !u.optBoolean("notified")) {
            c.put("notice", "今日语音用量已达上限，语音暂停至明天；文字回复继续。")
            u.put("notified", true); write("usage.json", u)
        }
        val requests = u.getJSONObject("requests")
        var reserved = 0L; var unknown = 0L
        requests.keys().forEach { id -> val r = requests.getJSONObject(id); when (r.optString("state")) { "reserved" -> reserved += r.optLong("tokens"); "unknown" -> unknown += r.optLong("tokens") } }
        c.put("usedTokens", u.optLong("tokens")).put("reservedTokens", reserved).put("unknownTokens", unknown)
            .put("confirmedTokens", maxOf(0, u.optLong("tokens") - reserved - unknown)).put("lastResult", u.optJSONObject("lastResult")) .put("day", u.getString("day"))
            .put("credentialPresent", credential().isNotEmpty())
    }
    fun saveSettings(input: JSONObject): JSONObject = synchronized(lock) {
        val c = config()
        for ((field, max) in listOf("dailyLimit" to 100000000, "cooldown" to 1000)) {
            if (input.has(field)) { val n = input.getDouble(field); require(n.isFinite() && n % 1 == 0.0 && n >= 0 && n <= max) { "语音护栏数值无效" }; c.put(field, n.toInt()) }
        }
        if (input.has("defaultVoiceId")) { require(findVoice(c, input.getString("defaultVoiceId")) != null) { "音色不存在" }; c.put("defaultVoiceId", input.getString("defaultVoiceId")) }
        val id = input.optString("cardId")
        if (id.isNotEmpty()) {
            require(id.matches(Regex("[a-f0-9]{64}"))) { "角色编号无效" }
            val binding = input.getJSONObject("binding")
            val voiceId = binding.optString("voiceId")
            require(voiceId.isEmpty() || findVoice(c, voiceId) != null) { "音色不存在" }
            val threshold = binding.optDouble("threshold", .7); require(threshold.isFinite() && threshold in 0.0..1.0) { "意愿阈值无效" }
            c.getJSONObject("characters").put(id, JSONObject().put("enabled", binding.optBoolean("enabled")).put("voiceId", voiceId).put("threshold", threshold))
        }
        if (input.has("apiKey") || input.optBoolean("clearKey")) HdsStore(context).saveVoiceKey(input.optString("apiKey"))
        write("settings.json", c); state()
    }
    private fun findVoice(c: JSONObject, id: String): JSONObject? = c.getJSONArray("voices").let { rows -> (0 until rows.length()).map { rows.getJSONObject(it) }.firstOrNull { it.optString("id") == id } }
    fun saveVoice(input: JSONObject): JSONObject = synchronized(lock) {
        val c = config(); val rows = c.getJSONArray("voices"); val name = input.optString("name").trim()
        require(name.isNotEmpty() && name.length <= 64) { "请输入音色名称（最多 64 字）" }
        val id = input.optString("id").ifEmpty { java.util.UUID.randomUUID().toString() }
        require(id != "builtin" && id.matches(Regex("[a-zA-Z0-9-]{1,64}"))) { "音色编号无效" }
        val old = findVoice(c, id)
        val row = if (old != null) JSONObject(old.toString()) else {
            require(rows.length() < 64) { "音色库最多 64 个" }
            val type = input.optString("type"); val value = input.optString("value")
            require(type in listOf("design", "reference")) { "音色类型无效" }
            if (type == "reference") require(audioFile(value).isFile) { "请先录音或导入参考音频" }
            else require(value.isNotBlank() && value.length <= 2000) { "请输入音色描述（最多 2000 字）" }
            JSONObject().put("id", id).put("type", type).put("value", value)
        }
        row.put("name", name); if (!row.has("verified")) row.put("verified", false)
        val next = JSONArray(); for (i in 0 until rows.length()) if (rows.getJSONObject(i).getString("id") != id) next.put(rows.getJSONObject(i))
        next.put(row); c.put("voices", next); write("settings.json", c); state()
    }
    fun deleteVoice(id: String): JSONObject = synchronized(lock) {
        require(id != "builtin") { "内置音色不能删除" }; val c = config(); val rows = c.getJSONArray("voices")
        c.put("voices", JSONArray().apply { for (i in 0 until rows.length()) if (rows.getJSONObject(i).getString("id") != id) put(rows.getJSONObject(i)) })
        if (c.optString("defaultVoiceId") == id) c.put("defaultVoiceId", "builtin")
        val chars = c.getJSONObject("characters"); chars.keys().forEach { key -> if (chars.getJSONObject(key).optString("voiceId") == id) chars.getJSONObject(key).put("voiceId", "") }
        // Keep audio referenced by historical messages, including after a voice is deleted.
        write("settings.json", c); state()
    }
    internal fun audioFile(id: String): File {
        require(id.matches(Regex("[a-f0-9]{64}"))) { "音频编号无效" }
        val file = File(base, "$id.wav")
        require(file.canonicalFile == File(base.canonicalFile, "$id.wav")) { "音频路径无效" }
        return file
    }
    fun putAudio(bytes: ByteArray): JSONObject {
        require(bytes.size <= MAX_AUDIO) { "音频超过 10 MiB" }
        val duration = WavAudio.duration(bytes)
        require(bytes.size <= MAX_AUDIO && duration > 0 && duration <= 180) { "音频应在 180 秒、10 MiB 以内" }
        val id = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        synchronized(lock) { val file = audioFile(id); if (!file.exists()) { val f = AtomicFile(file); val out = f.startWrite(); try { out.write(bytes); f.finishWrite(out) } catch (e: Throwable) { f.failWrite(out); throw e } }; file.setLastModified(System.currentTimeMillis()) }
        return JSONObject().put("audioId", id).put("duration", duration)
    }
    fun import(uri: Uri, clipSeconds: Int? = null): JSONObject {
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readVoiceBytes(MAX_AUDIO) } ?: throw IllegalArgumentException("无法读取音频")
        require(bytes.size <= MAX_AUDIO) { "音频超过 10 MiB" }
        val normalized = WavAudio.normalize(context, bytes, clipSeconds)
        return putAudio(normalized).put("format", "wav/pcm16").put("sampleRate", 24000).put("channels", 1).put("bytes", normalized.size).put("clipSeconds", clipSeconds ?: JSONObject.NULL)
    }
    fun audio(id: String): JSONObject {
        val file = audioFile(id); require(file.isFile) { "该备份未包含音频，可展开文字稿" }
        return JSONObject().put("dataUri", "data:audio/wav;base64," + Base64.encodeToString(file.inputStream().use { it.readVoiceBytes(MAX_AUDIO) }, Base64.NO_WRAP))
    }

    fun synthesize(input: JSONObject, client: MimoTtsClient = MimoTtsClient()): JSONObject {
        val requestId = input.optString("requestId").ifEmpty { java.util.UUID.randomUUID().toString() }
        require(requestId.matches(Regex("[a-zA-Z0-9-]{8,64}"))) { "语音请求编号无效" }
        fun outcome(status: String, reason: String) = JSONObject().put("requestId", requestId).put("status", status).put("stage", "synthesis").put("reason", reason)
        lateinit var selected: JSONObject; lateinit var key: String; lateinit var value: String; lateinit var text: String
        var reservation = 0L; var requestDay = ""; var replyNumber = 0L
        val signature = MessageDigest.getInstance("SHA-256").digest(canonicalJson(input).toByteArray()).joinToString("") { "%02x".format(it) }
        synchronized(lock) {
        val c = config(); val u = usage(); val preview = input.optBoolean("preview"); val cardId = input.optString("cardId")
        val requests = u.getJSONObject("requests"); val previous = requests.optJSONObject(requestId)
        if (previous != null) {
            require(previous.optString("signature") == signature) { "语音请求编号已用于其他内容" }
            return previous.optJSONObject("result") ?: outcome("unknown", "in_progress_or_interrupted")
        }
        fun skip(reason: String): JSONObject { val result = outcome("skipped", reason); u.put("lastResult", result); write("usage.json", u); return result }
        if (active.size >= 2) return skip("queue_full")
        if (requests.length() >= 2048) return skip("request_limit")
        val binding = c.getJSONObject("characters").optJSONObject(cardId) ?: JSONObject()
        val counts = u.getJSONObject("characters"); val count = counts.optJSONObject(cardId) ?: JSONObject().put("replies", 0).put("lastVoice", -1000000)
        if (!preview) { count.put("replies", count.optLong("replies") + 1); counts.put(cardId, count); write("usage.json", u) }
        val willingness = input.optDouble("willingness", -1.0)
        val cooldown = c.getInt("cooldown")
        if (!preview && !binding.optBoolean("enabled")) return skip("disabled")
        if (!preview && (!willingness.isFinite() || willingness < binding.optDouble("threshold", .7) || willingness > 1)) return skip("threshold")
        if (!preview && (count.optBoolean("pending") || cooldown > 0 && count.optLong("replies") - count.optLong("lastVoice") < cooldown)) return skip("cooldown")
        val limit = c.getInt("dailyLimit"); val used = u.optLong("tokens")
        if (limit > 0 && used >= limit) return skip("quota")
        text = input.optString("text").trim(); if (text.isEmpty() || text.length > 12000) return outcome("failed", "invalid_text")
        val voice = if (preview) input.optJSONObject("draft")?.let { draft ->
            val type = draft.optString("type"); val value = draft.optString("value")
            require(type in listOf("reference", "design") && value.isNotBlank() && value.length <= 2000) { "请先填写音色描述或导入音频" }; draft
        } ?: findVoice(c, input.optString("voiceId")) else findVoice(c, binding.optString("voiceId"))
        selected = voice ?: findVoice(c, c.getString("defaultVoiceId")) ?: findVoice(c, "builtin")!!
        key = credential(); if (key.isBlank()) return skip("missing_key")
        value = if (selected.getString("type") == "reference") "data:audio/wav;base64," + Base64.encodeToString(audioFile(selected.getString("value")).inputStream().use { it.readVoiceBytes(MAX_AUDIO) }, Base64.NO_WRAP) else selected.getString("value")
        // Reserve before IO. Unknown/timeout billing stays conservatively charged, across restart.
        reservation = if (limit > 0) minOf(4096L, limit - used) else 4096L
        requestDay = u.getString("day"); replyNumber = count.optLong("replies")
        active.add(base.absolutePath + requestId)
        if (!preview) count.put("pending", true)
        requests.put(requestId, JSONObject().put("state", "reserved").put("tokens", reservation).put("signature", signature).put("cardId", cardId))
        u.put("tokens", used + reservation); write("usage.json", u)
        }
        val started = System.nanoTime()
        var charged = reservation; var billing = "unknown"
        var result: JSONObject
        try {
            val response = client.synthesize(key, MimoTtsClient.Voice(selected.getString("type"), value), text, input.optString("style").take(3000))
            charged = response.tokens ?: reservation; billing = if (response.tokens != null) "confirmed" else "unknown"
            result = try { putAudio(response.wav).put("status", "generated").put("stage", "synthesis").put("requestId", requestId) }
                catch (_: Exception) { outcome("failed", "provider_invalid_audio") }
        } catch (failure: Exception) {
            if (failure is MimoTtsClient.Failure && !failure.billingUnknown) { charged = 0; billing = "confirmed" }
            result = outcome(if (failure is MimoTtsClient.Failure) "failed" else "unknown", (failure as? MimoTtsClient.Failure)?.code ?: "provider_timeout_or_network")
        }
        result.put("elapsedMs", (System.nanoTime() - started) / 1_000_000)
        synchronized(lock) {
            active.remove(base.absolutePath + requestId)
            val u = usage()
            if (u.optString("day") == requestDay) {
                u.put("tokens", maxOf(0, u.optLong("tokens") - reservation + charged))
                u.getJSONObject("requests").getJSONObject(requestId).put("state", billing).put("tokens", charged).put("result", result)
            }
            val count = u.getJSONObject("characters").optJSONObject(input.optString("cardId"))
            count?.put("pending", false)
            if (result.has("audioId") && !input.optBoolean("preview")) count?.put("lastVoice", replyNumber)
            u.put("lastResult", result); write("usage.json", u)
            if (result.has("audioId")) { val c = config(); findVoice(c, selected.optString("id"))?.put("verified", true); write("settings.json", c) }
        }
        return result
    }
}

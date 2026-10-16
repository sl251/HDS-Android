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

/** Shared by foreground previews and background replies. One lock covers quota + network + commit. */
class VoiceStore(private val context: Context, private val today: () -> String = { LocalDate.now().toString() }, private val credential: () -> String = { HdsStore(context).voiceKey() }) {
    companion object { internal val lock = Any(); const val MAX_AUDIO = 10 * 1024 * 1024 }
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
        if (optString("day") != today()) { put("day", today()); put("tokens", 0); put("notified", false) }
        if (!has("characters")) put("characters", JSONObject())
    }
    fun state(): JSONObject = synchronized(lock) {
        val c = config(); val u = usage(); val limit = c.getInt("dailyLimit")
        if (limit > 0 && u.optLong("tokens") >= limit && !u.optBoolean("notified")) {
            c.put("notice", "今日语音用量已达上限，语音暂停至明天；文字回复继续。")
            u.put("notified", true); write("usage.json", u)
        }
        c.put("usedTokens", u.optLong("tokens")).put("day", u.getString("day"))
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
        row.put("name", name)
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
        val duration = WavAudio.duration(bytes)
        require(bytes.size <= MAX_AUDIO && duration > 0 && duration <= 180) { "音频应在 180 秒、10 MiB 以内" }
        val id = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        synchronized(lock) { val file = audioFile(id); if (!file.exists()) { val f = AtomicFile(file); val out = f.startWrite(); try { out.write(bytes); f.finishWrite(out) } catch (e: Throwable) { f.failWrite(out); throw e } } }
        return JSONObject().put("audioId", id).put("duration", duration)
    }
    fun import(uri: Uri): JSONObject {
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readVoiceBytes(MAX_AUDIO) } ?: throw IllegalArgumentException("无法读取音频")
        require(bytes.size <= MAX_AUDIO) { "音频超过 10 MiB" }
        return putAudio(WavAudio.normalize(context, bytes))
    }
    fun audio(id: String): JSONObject = JSONObject().put("dataUri", "data:audio/wav;base64," + Base64.encodeToString(audioFile(id).inputStream().use { it.readVoiceBytes(MAX_AUDIO) }, Base64.NO_WRAP))

    fun synthesize(input: JSONObject, client: MimoTtsClient = MimoTtsClient()): JSONObject = synchronized(lock) {
        val c = config(); val u = usage(); val preview = input.optBoolean("preview"); val cardId = input.optString("cardId")
        val binding = c.getJSONObject("characters").optJSONObject(cardId) ?: JSONObject()
        val counts = u.getJSONObject("characters"); val count = counts.optJSONObject(cardId) ?: JSONObject().put("replies", 0).put("lastVoice", -1000000)
        if (!preview) { count.put("replies", count.optLong("replies") + 1); counts.put(cardId, count); write("usage.json", u) }
        val willingness = input.optDouble("willingness", -1.0)
        val cooldown = c.getInt("cooldown")
        if (!preview && (!binding.optBoolean("enabled") || !willingness.isFinite() || willingness < binding.optDouble("threshold", .7) || willingness > 1 || cooldown > 0 && count.optLong("replies") - count.optLong("lastVoice") < cooldown)) return JSONObject()
        val limit = c.getInt("dailyLimit"); val used = u.optLong("tokens")
        if (limit > 0 && used >= limit) return JSONObject()
        val text = input.optString("text").trim(); if (text.isEmpty() || text.length > 12000) return JSONObject()
        val voice = if (preview) input.optJSONObject("draft")?.let { draft ->
            val type = draft.optString("type"); val value = draft.optString("value")
            require(type in listOf("reference", "design") && value.isNotBlank() && value.length <= 2000) { "请先填写音色描述或导入音频" }; draft
        } ?: findVoice(c, input.optString("voiceId")) else findVoice(c, binding.optString("voiceId"))
        val selected = voice ?: findVoice(c, c.getString("defaultVoiceId")) ?: findVoice(c, "builtin")!!
        val key = credential(); if (key.isBlank()) return JSONObject()
        val model = when (selected.getString("type")) { "design" -> "mimo-v2.5-tts-voicedesign"; "reference" -> "mimo-v2.5-tts-voiceclone"; else -> "mimo-v2.5-tts" }
        val value = if (selected.getString("type") == "reference") Base64.encodeToString(audioFile(selected.getString("value")).inputStream().use { it.readVoiceBytes(MAX_AUDIO) }, Base64.NO_WRAP) else selected.getString("value")
        // Reserve before IO. Unknown/timeout billing stays conservatively charged, across restart.
        val reservation = if (limit > 0) minOf(4096L, limit - used) else 4096L
        u.put("tokens", used + reservation); write("usage.json", u)
        try {
            val result = client.synthesize(key, model, value, text, input.optString("style").take(3000))
            u.put("tokens", used + (result.tokens ?: reservation)); write("usage.json", u)
            val audio = putAudio(result.wav)
            if (!preview) { count.put("lastVoice", count.getLong("replies")); write("usage.json", u) }
            audio
        } catch (_: Exception) { JSONObject() } // Text delivery must always proceed.
    }
}

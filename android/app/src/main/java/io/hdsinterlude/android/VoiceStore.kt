package io.hdsinterlude.android

import android.content.Context
import android.net.Uri
import android.util.AtomicFile
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/** Shared by foreground previews and background replies. The lock only guards state; network IO runs outside it. */
class VoiceStore(private val context: Context, private val credential: () -> String = { HdsStore(context).voiceKey() }) {
    companion object {
        internal val lock = Any(); const val MAX_AUDIO = 10 * 1024 * 1024
        /** 800 字实测约 30-40 秒合成，留在 90 秒超时与 180 秒音频上限内；更长的回复直接回退文字。 */
        const val MAX_SPEECH_CHARS = 800
        /** 网络/5xx 失败后暂停自动语音两分钟，避免每条回复都卡满超时。 */
        const val FAILURE_BACKOFF_MS = 120_000L
        /** In-flight automatic syntheses per character, guarded by [lock]; one store instance is created per request. */
        internal val inFlight = HashSet<String>()
    }
    val base = File(context.noBackupFilesDir, "hds/voice").apply { mkdirs() }
    private fun read(name: String) = File(base, name).let { if (it.exists()) JSONObject(AtomicFile(it).openRead().bufferedReader().use { r -> r.readText() }) else JSONObject() }
    private fun write(name: String, value: JSONObject) {
        val f = AtomicFile(File(base, name)); val out = f.startWrite()
        try { out.write(value.toString().toByteArray()); f.finishWrite(out) } catch (e: Throwable) { f.failWrite(out); throw e }
    }
    fun config(): JSONObject = synchronized(lock) { read("settings.json").apply {
        if (!has("voices")) put("voices", JSONArray().put(JSONObject().put("id", "builtin").put("name", "茉莉").put("type", "builtin").put("value", "茉莉")))
        if (!has("defaultVoiceId")) put("defaultVoiceId", "builtin")
        // Drop the retired local daily TTS limit from legacy settings on next save.
        remove("dailyLimit")
        if (!has("cooldown")) put("cooldown", 5)
        if (!has("characters")) put("characters", JSONObject())
    } }
    private fun usage(): JSONObject = read("usage.json").apply {
        // Legacy token reservations and day counters never gate synthesis again.
        remove("day"); remove("tokens"); remove("notified")
        if (!has("characters")) put("characters", JSONObject())
    }
    fun state(): JSONObject = synchronized(lock) {
        val c = config(); val u = usage()
        c.put("lastResult", u.optJSONObject("lastResult"))
            .put("credentialPresent", credential().isNotEmpty())
    }
    fun saveSettings(input: JSONObject): JSONObject = synchronized(lock) {
        val c = config()
        if (input.has("cooldown")) {
            val n = input.getDouble("cooldown")
            require(n.isFinite() && n % 1 == 0.0 && n >= 0 && n <= 1000) { "语音冷却数值无效" }
            c.put("cooldown", n.toInt())
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

    private class Job(val cardId: String, val preview: Boolean, val key: String, val model: String, val voiceValue: String, val text: String, val style: String)

    fun synthesize(input: JSONObject, client: MimoTtsClient = MimoTtsClient()): JSONObject {
        // Phase 1: all bookkeeping under the lock, no network.
        val prepared: Any = synchronized(lock) {
            val c = config(); val u = usage(); val preview = input.optBoolean("preview"); val cardId = input.optString("cardId")
            fun outcome(status: String, reason: String, audio: JSONObject = JSONObject()): JSONObject {
                val diagnostic = JSONObject().put("status", status).put("stage", "synthesis").put("reason", reason)
                u.put("lastResult", diagnostic); write("usage.json", u)
                return audio.put("diagnostic", diagnostic)
            }
            fun skip(reason: String) = outcome("skipped", reason)
            val binding = c.getJSONObject("characters").optJSONObject(cardId) ?: JSONObject()
            val counts = u.getJSONObject("characters"); val count = counts.optJSONObject(cardId) ?: JSONObject().put("replies", 0).put("lastVoice", -1000000)
            if (!preview) { count.put("replies", count.optLong("replies") + 1); counts.put(cardId, count); write("usage.json", u) }
            val willingness = input.optDouble("willingness", -1.0)
            val cooldown = c.getInt("cooldown")
            if (!preview && !binding.optBoolean("enabled")) return@synchronized skip("disabled")
            if (!preview && (!willingness.isFinite() || willingness < 0 || willingness > 1)) return@synchronized skip("missing_decision")
            if (!preview && willingness < binding.optDouble("threshold", .7)) return@synchronized skip("threshold")
            // A recent network failure suppresses automatic replies; manual previews always retry.
            if (!preview && u.optLong("suppressedUntil", 0) > System.currentTimeMillis()) return@synchronized skip("provider_backoff")
            if (!preview && (cooldown > 0 && count.optLong("replies") - count.optLong("lastVoice") < cooldown)) return@synchronized skip("cooldown")
            val text = input.optString("text").trim()
            if (text.isEmpty()) return@synchronized skip("invalid_text")
            if (text.length > MAX_SPEECH_CHARS) return@synchronized skip("text_too_long")
            val voice = if (preview) input.optJSONObject("draft")?.let { draft ->
                val type = draft.optString("type"); val value = draft.optString("value")
                require(type in listOf("reference", "design") && value.isNotBlank() && value.length <= 2000) { "请先填写音色描述或导入音频" }; draft
            } ?: findVoice(c, input.optString("voiceId")) else findVoice(c, binding.optString("voiceId"))
            val selected = voice ?: findVoice(c, c.getString("defaultVoiceId")) ?: findVoice(c, "builtin")!!
            val key = credential(); if (key.isBlank()) return@synchronized skip("missing_key")
            val model = when (selected.getString("type")) { "design" -> "mimo-v2.5-tts-voicedesign"; "reference" -> "mimo-v2.5-tts-voiceclone"; else -> "mimo-v2.5-tts" }
            val value = if (selected.getString("type") == "reference") try {
                "data:audio/wav;base64," + Base64.encodeToString(audioFile(selected.getString("value")).inputStream().use { it.readVoiceBytes(MAX_AUDIO) }, Base64.NO_WRAP)
            } catch (_: Exception) { return@synchronized skip("reference_unreadable") } else selected.getString("value")
            if (!preview && !inFlight.add(cardId)) return@synchronized skip("queue_full")
            Job(cardId, preview, key, model, value, text, input.optString("style").take(3000))
        }
        if (prepared !is Job) return prepared as JSONObject
        val job = prepared
        // Phase 2: network without the lock, so settings/state stay responsive.
        try {
            val wav = client.synthesize(job.key, job.model, job.voiceValue, job.text, job.style).wav
            return synchronized(lock) {
                val u = usage(); val audio = putAudio(wav)
                if (!job.preview) {
                    val counts = u.getJSONObject("characters"); val count = counts.optJSONObject(job.cardId) ?: JSONObject().put("replies", 1).put("lastVoice", -1000000)
                    count.put("lastVoice", count.optLong("replies")); counts.put(job.cardId, count)
                }
                u.remove("suppressedUntil")
                val diagnostic = JSONObject().put("status", "generated").put("stage", "synthesis").put("reason", "generated")
                u.put("lastResult", diagnostic); write("usage.json", u)
                audio.put("diagnostic", diagnostic)
            }
        } catch (e: MimoTtsClient.Failure) {
            return failed(job, e.reason)
        } catch (_: java.net.SocketTimeoutException) {
            return failed(job, "provider_timeout_or_network")
        } catch (_: java.io.IOException) {
            return failed(job, "provider_timeout_or_network")
        } catch (_: org.json.JSONException) {
            return failed(job, "provider_invalid_audio")
        } catch (_: IllegalArgumentException) {
            return failed(job, "provider_invalid_audio") // bad base64, oversized or >180s audio
        } catch (_: Exception) {
            return failed(job, "provider_error")
        } finally {
            if (!job.preview) synchronized(lock) { inFlight.remove(job.cardId) }
        }
    }

    private fun failed(job: Job, reason: String): JSONObject = synchronized(lock) {
        val u = usage()
        val transient = reason == "provider_timeout_or_network" || reason == "provider_rate_limit" ||
            reason == "provider_http_429" || reason.matches(Regex("provider_http_5\\d\\d"))
        if (transient) u.put("suppressedUntil", System.currentTimeMillis() + FAILURE_BACKOFF_MS)
        val diagnostic = JSONObject().put("status", "failed").put("stage", "synthesis").put("reason", reason)
        u.put("lastResult", diagnostic); write("usage.json", u)
        JSONObject().put("diagnostic", diagnostic)
    }
}

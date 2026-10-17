package io.hdsinterlude.android

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MimoTtsClient(private val endpoint: String = "https://api.xiaomimimo.com/v1/chat/completions", private val timeout: Int = 25000) {
    data class Result(val wav: ByteArray, val tokens: Long?)
    data class Voice(val type: String, val value: String)
    class Failure(val code: String, val billingUnknown: Boolean) : Exception(code)
    internal fun request(voice: Voice, text: String, style: String): JSONObject {
        val audio = JSONObject().put("format", "wav")
        val model = when (voice.type) {
            "builtin" -> { require(voice.value.isNotBlank()); audio.put("voice", voice.value); "mimo-v2.5-tts" }
            "reference" -> {
                require(voice.value.startsWith("data:audio/wav;base64,")) { "参考音频必须为 WAV data URI" }
                audio.put("voice", voice.value); "mimo-v2.5-tts-voiceclone"
            }
            "design" -> { require(voice.value.isNotBlank()); "mimo-v2.5-tts-voicedesign" }
            else -> throw IllegalArgumentException("音色类型无效")
        }
        val instruction = if (voice.type == "design") "音色设计（优先遵守）：${voice.value}\n其他表达风格：${style.take(3000)}"
            else style.ifBlank { "自然、克制地说话，忠实朗读正文。" }
        return JSONObject().put("model", model).put("audio", audio).put("messages", JSONArray()
            .put(JSONObject().put("role", "user").put("content", instruction))
            .put(JSONObject().put("role", "assistant").put("content", text)))
    }
    fun synthesize(key: String, voice: Voice, text: String, style: String): Result {
        val body = request(voice, text, style)
        val c = URL(endpoint).openConnection() as HttpURLConnection
        val watchdog = java.util.concurrent.Executors.newSingleThreadScheduledExecutor { task -> Thread(task, "hds-tts-timeout").apply { isDaemon = true } }
        val deadline = watchdog.schedule({ c.disconnect() }, timeout.toLong(), java.util.concurrent.TimeUnit.MILLISECONDS)
        try {
            c.requestMethod = "POST"; c.connectTimeout = timeout; c.readTimeout = timeout; c.instanceFollowRedirects = false; c.doOutput = true
            c.setRequestProperty("api-key", key); c.setRequestProperty("Content-Type", "application/json")
            c.outputStream.use { it.write(body.toString().toByteArray()) }
            val status = c.responseCode
            if (status !in 200..299) throw Failure("provider_http_$status", status !in listOf(400, 401, 403, 404, 422, 429))
            val bytes = c.inputStream.use { it.readVoiceBytes(16 * 1024 * 1024) }; require(bytes.size <= 16 * 1024 * 1024)
            val result = JSONObject(String(bytes, Charsets.UTF_8)); val usage = result.optJSONObject("usage")
            val tokens = if (usage?.has("total_tokens") == true) usage.optLong("total_tokens", -1).takeIf { it >= 0 }
                else if (usage?.has("prompt_tokens") == true && usage.has("completion_tokens")) (usage.optLong("prompt_tokens") + usage.optLong("completion_tokens")).takeIf { it >= 0 } else null
            val data = result.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optJSONObject("audio")?.optString("data")
            if (data.isNullOrBlank()) throw Failure("provider_missing_audio", true)
            val wav = try { Base64.decode(data, Base64.DEFAULT) } catch (_: Exception) { throw Failure("provider_invalid_audio", true) }
            return Result(wav, tokens)
        } finally { deadline.cancel(false); watchdog.shutdownNow(); c.disconnect() }
    }
}

/** Bounded IO also on API 26, where InputStream.readNBytes is unavailable. */
internal fun java.io.InputStream.readVoiceBytes(limit: Int): ByteArray {
    val out = java.io.ByteArrayOutputStream(); val block = ByteArray(16384)
    while (true) { val n = read(block); if (n < 0) break; require(out.size() + n <= limit) { "音频文件过大" }; out.write(block, 0, n) }
    return out.toByteArray()
}

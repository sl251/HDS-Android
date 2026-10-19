package io.hdsinterlude.android

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MimoTtsClient(private val endpoint: String = "https://api.xiaomimimo.com/v1/chat/completions", private val timeout: Int = 90000, private val connectTimeout: Int = 15000) {
    class Failure(val reason: String) : Exception(reason)
    data class Result(val wav: ByteArray)
    fun synthesize(key: String, model: String, voice: String, text: String, style: String): Result {
        val c = URL(endpoint).openConnection() as HttpURLConnection
        val watchdog = java.util.concurrent.Executors.newSingleThreadScheduledExecutor { task -> Thread(task, "hds-tts-timeout").apply { isDaemon = true } }
        val deadline = watchdog.schedule({ c.disconnect() }, timeout.toLong(), java.util.concurrent.TimeUnit.MILLISECONDS)
        try {
            c.requestMethod = "POST"; c.connectTimeout = connectTimeout; c.readTimeout = timeout; c.instanceFollowRedirects = false; c.doOutput = true
            c.setRequestProperty("api-key", key); c.setRequestProperty("Content-Type", "application/json")
            // Voice design uses a user-message description rather than audio.voice.
            val design = model == "mimo-v2.5-tts-voicedesign"
            val audio = JSONObject().put("format", "wav")
            if (!design) audio.put("voice", voice)
            val instruction = if (design) {
                voice.trim() + if (style.isBlank()) "" else "\n朗读语气：${style.trim()}"
            } else style.ifBlank { "自然、克制地说话，忠实朗读正文。" }
            val body = JSONObject().put("model", model).put("audio", audio)
                .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", instruction))
                    .put(JSONObject().put("role", "assistant").put("content", text)))
            c.outputStream.use { it.write(body.toString().toByteArray()) }
            val status = c.responseCode
            if (status !in 200..299) throw Failure(ProviderFailure.reason(c, status))
            val bytes = c.inputStream.use { it.readVoiceBytes(16 * 1024 * 1024) }; require(bytes.size <= 16 * 1024 * 1024)
            val result = JSONObject(String(bytes, Charsets.UTF_8))
            return Result(Base64.decode(result.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getJSONObject("audio").getString("data"), Base64.DEFAULT))
        } finally { deadline.cancel(false); watchdog.shutdownNow(); c.disconnect() }
    }
}

/** Bounded IO also on API 26, where InputStream.readNBytes is unavailable. */
internal fun java.io.InputStream.readVoiceBytes(limit: Int): ByteArray {
    val out = java.io.ByteArrayOutputStream(); val block = ByteArray(16384)
    while (true) { val n = read(block); if (n < 0) break; require(out.size() + n <= limit) { "音频文件过大" }; out.write(block, 0, n) }
    return out.toByteArray()
}

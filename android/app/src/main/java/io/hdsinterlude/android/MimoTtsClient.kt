package io.hdsinterlude.android

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MimoTtsClient(private val endpoint: String = "https://api.xiaomimimo.com/v1/chat/completions", private val timeout: Int = 25000) {
    data class Result(val wav: ByteArray, val tokens: Long?)
    fun synthesize(key: String, model: String, voice: String, text: String, style: String): Result {
        val c = URL(endpoint).openConnection() as HttpURLConnection
        val watchdog = java.util.concurrent.Executors.newSingleThreadScheduledExecutor { task -> Thread(task, "hds-tts-timeout").apply { isDaemon = true } }
        val deadline = watchdog.schedule({ c.disconnect() }, timeout.toLong(), java.util.concurrent.TimeUnit.MILLISECONDS)
        try {
            c.requestMethod = "POST"; c.connectTimeout = timeout; c.readTimeout = timeout; c.instanceFollowRedirects = false; c.doOutput = true
            c.setRequestProperty("api-key", key); c.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().put("model", model).put("audio", JSONObject().put("format", "wav").put("voice", voice))
                .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", style.ifBlank { "自然、克制地说话，忠实朗读正文。" }))
                    .put(JSONObject().put("role", "assistant").put("content", text)))
            c.outputStream.use { it.write(body.toString().toByteArray()) }
            require(c.responseCode in 200..299) { "语音服务暂不可用" }
            val bytes = c.inputStream.use { it.readVoiceBytes(16 * 1024 * 1024) }; require(bytes.size <= 16 * 1024 * 1024)
            val result = JSONObject(String(bytes, Charsets.UTF_8)); val usage = result.optJSONObject("usage")
            val tokens = if (usage?.has("total_tokens") == true) usage.optLong("total_tokens", -1).takeIf { it >= 0 }
                else if (usage?.has("prompt_tokens") == true && usage.has("completion_tokens")) (usage.optLong("prompt_tokens") + usage.optLong("completion_tokens")).takeIf { it >= 0 } else null
            return Result(Base64.decode(result.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getJSONObject("audio").getString("data"), Base64.DEFAULT), tokens)
        } finally { deadline.cancel(false); watchdog.shutdownNow(); c.disconnect() }
    }
}

/** Bounded IO also on API 26, where InputStream.readNBytes is unavailable. */
internal fun java.io.InputStream.readVoiceBytes(limit: Int): ByteArray {
    val out = java.io.ByteArrayOutputStream(); val block = ByteArray(16384)
    while (true) { val n = read(block); if (n < 0) break; require(out.size() + n <= limit) { "音频文件过大" }; out.write(block, 0, n) }
    return out.toByteArray()
}

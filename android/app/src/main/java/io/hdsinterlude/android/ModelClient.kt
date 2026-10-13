package io.hdsinterlude.android

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/** Native network access keeps keys out of browser storage and avoids WebView CORS. */
class ModelClient {
    private fun request(provider: JSONObject, endpoint: String, body: JSONObject? = null): JSONObject {
        val connection = URL(endpoint).openConnection() as HttpURLConnection
        val key = provider.optString("apiKey")
        try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = if (body == null) "GET" else "POST"
            connection.connectTimeout = 15000; connection.readTimeout = 60000
            connection.setRequestProperty("Accept", "application/json")
            if (provider.optString("protocol") == "anthropic-messages") {
                connection.setRequestProperty("anthropic-version", "2023-06-01")
                if (key.isNotEmpty()) connection.setRequestProperty("x-api-key", key)
            } else if (key.isNotEmpty()) connection.setRequestProperty("Authorization", "Bearer $key")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            require(status in 200..299) {
                val hint = when (status) {
                    404, 405 -> if (body == null) "供应商可能不支持模型列表；可以直接填写模型名或设置列表地址。" else "接口路径或模型路由不存在，404 不代表密钥无效。"
                    401, 403 -> "服务商拒绝认证或访问，请核对密钥权限。"
                    429 -> "服务商限流或额度不足。"
                    in 300..399 -> "服务商返回重定向，请填写最终 API 地址。"
                    else -> "服务商未接受请求，请核对接口协议与模型。"
                }
                "HTTP $status · ${ModelEndpoint.display(endpoint)}。$hint"
            }
            val output = ByteArrayOutputStream()
            connection.inputStream.use { stream ->
                val buffer = ByteArray(8192)
                while (true) {
                    val count = stream.read(buffer); if (count < 0) break
                    require(output.size() + count <= 2 * 1024 * 1024) { "模型响应超过 2 MiB" }
                    output.write(buffer, 0, count)
                }
            }
            return try { JSONObject(output.toString("UTF-8")) } catch (_: Exception) { throw IllegalArgumentException("服务商返回了非 JSON 响应，请核对 API 地址") }
        } finally { connection.disconnect() }
    }

    fun list(provider: JSONObject): JSONObject {
        val endpoint = ModelEndpoint.models(provider.getString("endpoint"), provider.optString("modelsEndpoint"))
        val response = request(provider, endpoint)
        val data = response.optJSONArray("data") ?: throw IllegalArgumentException("模型列表缺少 data 数组，可手动填写模型名")
        val ids = sortedSetOf<String>()
        for (i in 0 until data.length().coerceAtMost(10000)) {
            val id = data.optJSONObject(i)?.optString("id")?.trim().orEmpty()
            if (id.isNotEmpty() && id.length <= 256) ids.add(id)
        }
        require(ids.isNotEmpty()) { "此密钥未返回可用模型，可手动填写模型名" }
        return JSONObject().put("models", JSONArray(ids.toList())).put("partial", response.optBoolean("has_more") || data.length() > 10000)
            .put("endpoint", ModelEndpoint.display(endpoint))
    }

    fun test(provider: JSONObject): JSONObject {
        val start = System.nanoTime()
        val body = JSONObject().put("model", provider.getString("model")).put("max_tokens", 256).put("stream", false)
            .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", "Reply with OK.")))
        if (provider.optString("protocol") != "anthropic-messages" && provider.optString("deepseekThinking", "inherit") != "inherit") {
            body.put("thinking", JSONObject().put("type", provider.getString("deepseekThinking")))
        }
        val response = request(provider, provider.getString("endpoint"), body)
        val text = if (provider.optString("protocol") == "anthropic-messages") {
            val blocks = response.optJSONArray("content") ?: JSONArray()
            (0 until blocks.length()).mapNotNull { blocks.optJSONObject(it) }.filter { it.optString("type") == "text" }.joinToString("") { it.optString("text") }
        } else response.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content").orEmpty()
        require(text.isNotBlank() && text != "null") { "接口已响应，但没有可见文字；可能需要更大的输出预算或关闭思考模式" }
        return JSONObject().put("message", "${provider.optString("label")}连接成功 · ${(System.nanoTime() - start) / 1000000} ms（真实调用，可能产生少量费用）")
    }
}

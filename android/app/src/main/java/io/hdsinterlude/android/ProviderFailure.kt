package io.hdsinterlude.android

import java.net.HttpURLConnection
import org.json.JSONObject

/** Error bodies are inspected transiently; only fixed reason codes may leave this boundary. */
internal object ProviderFailure {
    fun reason(connection: HttpURLConnection, status: Int): String {
        val detail = try {
            val bytes = connection.errorStream?.use { it.readVoiceBytes(64 * 1024) }
            val json = if (bytes != null) JSONObject(String(bytes, Charsets.UTF_8)) else JSONObject()
            val error = json.optJSONObject("error") ?: json
            listOf(error.optString("code"), error.optString("type"), error.optString("message")).joinToString(" ").take(16000)
        } catch (_: Exception) { "" }
        if (status == 402 || Regex("insufficient[_ -](quota|balance|credit)|quota[_ -]exceeded|credit.*exhaust|balance.*insufficient|余额不足|额度.*(用尽|不足|耗尽)", RegexOption.IGNORE_CASE).containsMatchIn(detail)) return "provider_quota"
        // RESOURCE_EXHAUSTED can mean provider-side capacity or throttling;
        // never present it as confirmed account balance exhaustion.
        if (Regex("resource[_ -]?exhaust(ed|ion)?|资源(?:已)?耗尽", RegexOption.IGNORE_CASE).containsMatchIn(detail)) return "provider_resource_exhausted"
        if (status == 401) return "provider_authentication"
        if (status == 403) return "provider_permission"
        if (status == 429 && Regex("rate[_ -]limit|too many requests|限流", RegexOption.IGNORE_CASE).containsMatchIn(detail)) return "provider_rate_limit"
        return "provider_http_$status"
    }
    fun label(reason: String): String = when (reason) {
        "provider_quota" -> "供应商报告余额或配额不足，请检查对应账户余额及 Key 限额；这不是本机后台预算。"
        "provider_resource_exhausted" -> "供应商返回资源耗尽，可能是并发限制或服务容量；不能直接认定 Key 余额不足。"
        "provider_authentication" -> "供应商拒绝密钥，请核对是否填写正确或已经失效。"
        "provider_permission" -> "供应商拒绝访问，请核对模型权限。"
        "provider_rate_limit" -> "供应商限流，请稍后重试；这不代表余额用尽。"
        "provider_http_429" -> "供应商返回 429，暂不能区分限流与配额，请查看供应商控制台。"
        else -> "供应商未接受请求，请核对接口协议与模型。"
    }
}

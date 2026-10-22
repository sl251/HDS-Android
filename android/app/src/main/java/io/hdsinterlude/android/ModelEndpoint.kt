package io.hdsinterlude.android

import java.net.URI

/** Resolve common OpenAI-compatible base URLs; preserve custom complete endpoints. */
object ModelEndpoint {
    fun resolve(value: String, protocol: String = "chat-completions"): String {
        require(protocol in listOf("chat-completions", "anthropic-messages")) { "不支持的模型协议" }
        val uri = URI(value.trim())
        require(uri.scheme in listOf("http", "https") && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.fragment == null) {
            "API 地址必须是 HTTP(S) 地址，不含凭据或片段"
        }
        val path = uri.rawPath.orEmpty().trimEnd('/')
        val suffix = if (protocol == "anthropic-messages") "messages" else "chat/completions"
        val resolved = when {
            path.isEmpty() -> "/v1/$suffix"
            Regex(".*/v[0-9]+(?:beta[0-9]*)?").matches(path) -> "$path/$suffix"
            path.endsWith("/chat/completions") -> path.removeSuffix("/chat/completions") + "/$suffix"
            path.endsWith("/messages") -> path.removeSuffix("/messages") + "/$suffix"
            else -> uri.rawPath
        }
        return "${uri.scheme}://${uri.rawAuthority}$resolved" + (uri.rawQuery?.let { "?$it" } ?: "")
    }

    fun validateRetrievalEndpoint(value: String): String {
        val uri = try { URI(value.trim()) } catch (_: Exception) { throw IllegalArgumentException("应为 HTTP(S) 地址，不含凭据或片段") }
        require(uri.scheme?.lowercase() in listOf("http", "https") && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.fragment == null && value.trim().none { it.code <= 32 || it.code == 127 }) {
            "应为 HTTP(S) 地址，不含凭据或片段"
        }
        require(uri.port in -1..65535) { "应为 HTTP(S) 地址，不含凭据或片段" }
        return value.trim()
    }

    fun models(value: String, explicit: String = ""): String {
        if (explicit.isNotBlank()) {
            val uri = URI(explicit.trim())
            require(uri.scheme in listOf("http", "https") && uri.host != null && uri.userInfo == null && uri.fragment == null) { "模型列表地址无效" }
            require(origin(explicit) == origin(value)) { "模型列表地址必须与模型接口同源，避免密钥发送到其他服务" }
            return uri.toASCIIString()
        }
        val uri = URI(value)
        val path = uri.rawPath.trimEnd('/')
        val prefix = when {
            path.endsWith("/chat/completions") -> path.removeSuffix("/chat/completions")
            path.endsWith("/messages") -> path.removeSuffix("/messages")
            else -> throw IllegalArgumentException("自定义接口无法推导模型列表地址，请填写同源的完整 /models 地址")
        }
        return "${uri.scheme}://${uri.rawAuthority}$prefix/models" + (uri.rawQuery?.let { "?$it" } ?: "")
    }

    fun origin(value: String): String {
        val uri = URI(value.trim())
        return "${uri.scheme.lowercase()}://${uri.host.lowercase()}:${if (uri.port >= 0) uri.port else if (uri.scheme == "https") 443 else 80}"
    }

    // Query parameters can contain credentials; they must never appear in diagnostics.
    fun display(value: String): String {
        val uri = URI(value)
        return "${uri.scheme}://${uri.rawAuthority}${uri.rawPath}"
    }
}

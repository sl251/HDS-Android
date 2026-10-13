package io.hdsinterlude.android

import java.net.URI

/** Resolve common OpenAI-compatible base URLs; preserve custom complete endpoints. */
object ModelEndpoint {
    fun resolve(value: String): String {
        val uri = URI(value.trim())
        require(uri.scheme in listOf("http", "https") && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.fragment == null) {
            "API 地址必须是 HTTP(S) 地址，不含凭据或片段"
        }
        val path = uri.rawPath.orEmpty().trimEnd('/')
        val resolved = when {
            path.isEmpty() -> "/v1/chat/completions"
            Regex(".*/v[0-9]+(?:beta[0-9]*)?").matches(path) -> "$path/chat/completions"
            else -> uri.rawPath
        }
        return "${uri.scheme}://${uri.rawAuthority}$resolved" + (uri.rawQuery?.let { "?$it" } ?: "")
    }

    // Query parameters can contain credentials; they must never appear in diagnostics.
    fun display(value: String): String {
        val uri = URI(value)
        return "${uri.scheme}://${uri.rawAuthority}${uri.rawPath}"
    }
}

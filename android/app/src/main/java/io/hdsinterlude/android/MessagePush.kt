package io.hdsinterlude.android

import org.json.JSONObject
import java.time.Instant

/** No Android dependencies: stdout protocol is also tested on the plain JVM. */
data class CharacterMessage(val id: String, val content: String, val fullContent: String, val occurredAt: Instant) {
    companion object {
        fun fromJson(value: JSONObject): CharacterMessage? = try {
            val id = value.getString("id")
            val content = value.getString("content")
            require(id.isNotBlank() && id.length <= 64)
            CharacterMessage(id, content, value.optString("fullContent", content), Instant.parse(value.getString("occurredAt")))
        } catch (_: Exception) { null }
    }
}
fun parseMessagePush(line: String): CharacterMessage? {
    if (!line.startsWith("HDS_MSG_PUSH ")) return null
    return try { CharacterMessage.fromJson(JSONObject(line.substring(13))) } catch (_: Exception) { null }
}

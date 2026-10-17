package io.hdsinterlude.android

import org.json.JSONObject

/** Rechecked after the picker returns, before copying any file into storage. */
internal fun requireStickerVision(settings: JSONObject) {
    val options = settings.optJSONObject("modelOptions") ?: JSONObject()
    require(options.optBoolean("visionEnabled")) { "请先到模型设置开启图片理解，并配置可用的识图模型，再导入表情包。" }
    val rows = settings.optJSONArray("providers")
    val id = options.optString("visionProviderId")
    val candidates = (0 until (rows?.length() ?: 0)).map { rows!!.getJSONObject(it) }
        .filter { if (id.isNotEmpty()) it.optString("id") == id else it.optBoolean("enabled", true) && it.optBoolean("useForMain") }
    require(candidates.isNotEmpty() && candidates.all { it.optBoolean("enabled", true) && it.optString("model").isNotBlank() && it.optString("imageInput") != "unsupported" }) { "请配置启用且支持图片的识图模型，再导入表情包。" }
    candidates.forEach { ModelEndpoint.resolve(it.optString("endpoint"), it.optString("protocol", "chat-completions")) }
}

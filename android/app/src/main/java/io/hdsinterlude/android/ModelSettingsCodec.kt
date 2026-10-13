package io.hdsinterlude.android

import org.json.JSONArray
import org.json.JSONObject

/** Settings migration/validation without Android or network access. Secrets never enter public rows. */
class ModelSettingsCodec(private val presets: JSONArray) {
    private val roles = listOf("useForMain", "useForCompaction", "useForAlter")
    // A pristine extra row is an accidental add, not a runnable connection.
    // Never discard a draft with typed values or a previously saved secret.
    fun emptyDraft(input: JSONObject, previous: JSONObject? = null): Boolean =
        input.optString("preset", "custom") == "custom" &&
            listOf("endpoint", "model", "modelsEndpoint", "apiKey", "encryptedKey").all { input.optString(it).isBlank() } &&
            !input.optBoolean("credentialPresent") && previous?.optString("encryptedKey").isNullOrEmpty()

    fun configuredRows(rows: JSONArray, previous: JSONArray = JSONArray()): JSONArray {
        require(rows.length() in 1..12) { "请配置 1 至 12 条模型连接" }
        val result = JSONArray()
        for (i in 0 until rows.length()) {
            val row = rows.getJSONObject(i)
            val old = (0 until previous.length()).map { previous.getJSONObject(it) }.firstOrNull { it.optString("id") == row.optString("id") }
            if (!emptyDraft(row, old)) result.put(row)
        }
        require(result.length() > 0) { "请至少填写一条模型连接的 API 地址和模型名称" }
        return result
    }
    fun rows(settings: JSONObject): JSONArray {
        settings.optJSONArray("providers")?.let { return it }
        val legacy = JSONObject().put("id", "legacy-primary").put("preset", "custom").put("label", "原有模型连接")
            .put("endpoint", settings.optString("endpoint")).put("model", settings.optString("model")).put("enabled", true)
            .put("protocol", "chat-completions")
        roles.forEach { legacy.put(it, true) }
        for (field in listOf("encryptedKey", "keyIv")) if (settings.has(field)) legacy.put(field, settings.get(field))
        return JSONArray().put(legacy)
    }

    fun normalize(input: JSONObject, requireModel: Boolean = true): JSONObject {
        val id = input.getString("id")
        require(id.matches(Regex("[a-zA-Z0-9-]{1,64}"))) { "模型连接编号无效" }
        val presetId = input.optString("preset", "custom")
        val preset = (0 until presets.length()).map { presets.getJSONObject(it) }.find { it.getString("id") == presetId }
            ?: throw IllegalArgumentException("未知供应商预设")
        val protocol = if (presetId == "custom") input.optString("protocol", "chat-completions") else preset.getString("protocol")
        val endpoint = if (presetId == "custom") input.optString("endpoint").trim() else preset.getString("endpoint")
        require(endpoint.isNotEmpty()) { "连接「${input.optString("label", "未命名") }」缺少 API 地址，请填写或删除此连接" }
        require(endpoint.length <= 2048) { "API 地址过长" }
        val result = JSONObject().put("id", id).put("preset", presetId).put("mode", preset.getString("mode"))
            .put("protocol", protocol).put("endpoint", ModelEndpoint.resolve(endpoint, protocol))
            .put("enabled", input.optBoolean("enabled", true))
        for (field in listOf("label", "model", "modelsEndpoint")) {
            val value = input.optString(field).trim()
            require(value.length <= if (field == "modelsEndpoint") 2048 else 256) { "模型字段过长" }
            result.put(field, value)
        }
        if (result.getString("label").isEmpty()) result.put("label", preset.getString("label"))
        require(!requireModel || result.getString("model").isNotBlank()) { "请填写或选择模型名称" }
        if (result.getString("modelsEndpoint").isNotEmpty()) ModelEndpoint.models(result.getString("endpoint"), result.getString("modelsEndpoint"))
        roles.forEach { result.put(it, input.optBoolean(it, false)) }
        val thinking = input.optString("deepseekThinking", if (presetId == "deepseek") "disabled" else "inherit")
        require(thinking in listOf("inherit", "disabled", "enabled")) { "思考模式无效" }
        result.put("deepseekThinking", thinking)
        return result
    }

    fun publicRows(settings: JSONObject): JSONArray {
        val result = JSONArray()
        val source = rows(settings)
        for (i in 0 until source.length()) {
            val row = source.getJSONObject(i)
            val clean = JSONObject()
            for (field in listOf("id", "preset", "label", "endpoint", "model", "modelsEndpoint", "protocol", "enabled", "deepseekThinking") + roles) {
                if (row.has(field)) clean.put(field, row.get(field))
            }
            clean.put("credentialPresent", row.optString("encryptedKey").isNotEmpty())
            result.put(clean)
        }
        return result
    }

    fun preserveCredential(input: JSONObject, normalized: JSONObject, previous: JSONObject?) {
        if (input.optBoolean("clearKey", false) || input.optString("apiKey").isNotEmpty() || previous == null) return
        if (previous.optString("encryptedKey").isEmpty()) return
        require(ModelEndpoint.origin(previous.getString("endpoint")) == ModelEndpoint.origin(normalized.getString("endpoint"))
            && previous.optString("protocol", "chat-completions") == normalized.getString("protocol")) {
            "供应商地址或协议已改变，请输入新密钥或明确清除原密钥"
        }
        for (field in listOf("encryptedKey", "keyIv")) normalized.put(field, previous.get(field))
    }

    fun validateRows(rows: JSONArray) {
        require(rows.length() in 1..12) { "请配置 1 至 12 条模型连接" }
        val list = (0 until rows.length()).map { rows.getJSONObject(it) }
        require(list.map { it.getString("id") }.distinct().size == list.size) { "模型连接编号重复" }
        for ((role, name) in roles.zip(listOf("主叙事", "记忆压缩", "Alter 分析"))) {
            require(list.any { it.optBoolean("enabled") && it.optBoolean(role) }) { "请至少为$name 指定一条启用的连接" }
        }
    }

    fun options(input: JSONObject): JSONObject {
        val result = JSONObject()
        fun choice(name: String, default: String, allowed: List<String>) {
            val value = input.optString(name, default)
            require(value in allowed) { "$name 选项无效" }; result.put(name, value)
        }
        fun number(name: String, default: Double, minimum: Double, maximum: Double, integer: Boolean = false) {
            val value = if (input.has(name)) input.getDouble(name) else default
            require(value.isFinite() && value in minimum..maximum && (!integer || value % 1.0 == 0.0)) { "$name 超出范围" }
            result.put(name, if (integer) value.toInt() else value)
        }
        choice("mainStreamingMode", "off", listOf("off", "experimental"))
        choice("mainResponseFormat", "json-object", listOf("json-object", "prompt-only"))
        choice("failoverStrategy", "priority", listOf("priority", "round-robin"))
        choice("mainPayloadOrder", "cache-first", listOf("cache-first", "legacy"))
        result.put("failoverEnabled", input.optBoolean("failoverEnabled", false))
        number("mainTemperature", 0.8, 0.0, 2.0)
        number("mainMaxTokens", 4096.0, 256.0, 100000.0, true)
        number("mainTimeout", 60000.0, 5000.0, 300000.0, true)
        require(result.getString("mainStreamingMode") != "experimental" || result.getString("mainResponseFormat") == "json-object") { "HDS 流式首条回复需要 JSON 模式" }
        return result
    }
}

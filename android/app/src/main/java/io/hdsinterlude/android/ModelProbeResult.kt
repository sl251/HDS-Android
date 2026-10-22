package io.hdsinterlude.android

import org.json.JSONObject

/** Only allowlisted, non-secret fields can leave the guest probe. */
object ModelProbeResult {
    private val categories = setOf("succeeded", "configuration", "provider_required", "model_required", "endpoint_required", "endpoint_origin", "authentication", "permission", "route_not_found", "invalid_request", "gateway_convert_request", "gateway_model_ratio", "provider_error", "provider_quota", "throttled_or_quota", "timeout", "cancelled", "network", "invalid_response", "background_budget", "redirect_rejected")
    fun sanitize(raw: JSONObject, task: String): JSONObject {
        require(raw.opt("ok") is Boolean && raw.optString("task") == task && raw.optString("category") in categories) { "模型测试响应无效" }
        require(raw.getBoolean("ok") == (raw.getString("category") == "succeeded")) { "模型测试响应无效" }
        val output = JSONObject().put("ok", raw.getBoolean("ok")).put("task", task).put("category", raw.getString("category"))
        for ((key, max) in listOf("httpStatus" to 599, "elapsedMs" to 150000, "vectorDimensions" to 32768, "resultCount" to 20)) {
            if (!raw.has(key)) continue
            val value = raw.get(key)
            require(value is Number && value.toDouble().isFinite() && value.toDouble() % 1.0 == 0.0 && value.toDouble() in (if (key == "httpStatus") 100.0 else 0.0)..max.toDouble()) { "模型测试响应无效" }
            output.put(key, value.toLong())
        }
        require(!output.getBoolean("ok") || output.optString("category") == "succeeded" && (if (task == "embedding") output.optInt("vectorDimensions") > 0 else output.optInt("resultCount") > 0)) { "模型测试响应无效" }
        return output
    }
}

package io.hdsinterlude.android

import org.json.JSONArray
import org.json.JSONObject

/** Uses the build-time upstream schema, also consumed by the React form. */
class MobileSettingsCodec(private val schema: JSONObject) {
    fun normalize(input: JSONObject): JSONObject {
        require(input.toString().length <= 32768) { "生活设置过大" }
        val limit = input.opt("backgroundLimit") ?: schema.getInt("backgroundLimit")
        require(limit is Number && limit.toDouble().isFinite() && limit.toDouble() % 1.0 == 0.0 && limit.toDouble() in 0.0..10000.0) { "后台预算应为 0 至 10000 的整数" }
        require(!input.has("sections") || input.opt("sections") is JSONObject) { "生活设置分区无效" }
        val source = input.optJSONObject("sections") ?: JSONObject()
        val sections = JSONObject()
        val definitions = schema.getJSONArray("sections")
        for (section in source.keys()) {
            val definition = (0 until definitions.length()).map { definitions.getJSONObject(it) }.firstOrNull { it.getString("key") == section }
                ?: throw IllegalArgumentException("不支持的配置分区：$section")
            val fields = source.getJSONObject(section)
            val allowed = definition.getJSONArray("fields")
            val output = JSONObject()
            for (key in fields.keys()) {
                val field = (0 until allowed.length()).map { allowed.getJSONObject(it) }.firstOrNull { it.getString("key") == key }
                    ?: throw IllegalArgumentException("不支持的配置字段：$section.$key")
                val rawValue = fields.get(key)
                val value = if (rawValue is String) rawValue.trim() else rawValue
                when (field.getString("type")) {
                    "boolean" -> require(value is Boolean) { "$section.$key 应为开关" }
                    "number" -> {
                        require(value is Number && value.toDouble().isFinite()) { "$section.$key 应为数字" }
                        require(value.toDouble() >= field.optDouble("min", -Double.MAX_VALUE) && value.toDouble() <= field.optDouble("max", Double.MAX_VALUE)) { "$section.$key 超出范围" }
                        if (field.optDouble("step", 0.0) == 1.0) require(value.toDouble() % 1.0 == 0.0) { "$section.$key 应为整数" }
                    }
                    "union" -> {
                        val options = field.getJSONArray("options")
                        require((0 until options.length()).any { options.get(it) == value }) { "$section.$key 选项无效" }
                    }
                    "string" -> {
                        val maxLength = field.optInt("maxLength", 128)
                        val label = when (key) { "endpoint" -> "HTTP(S) 地址"; "model" -> "模型名"; else -> "连接编号" }
                        require(value is String) { "$section.$key 应为$label" }
                        require(value.length <= maxLength && value.none { it.code < 32 || it.code == 127 }) { "$section.$key 应为不超过 $maxLength 字符的$label" }
                        if (key == "endpoint" && value.isNotEmpty()) ModelEndpoint.validateRetrievalEndpoint(value)
                    }
                    "array" -> {
                        require(value is JSONArray && value.length() <= 12) { "补写时间点最多 12 个" }
                        for (i in 0 until value.length()) {
                            val item = value.get(i)
                            val options = field.optJSONArray("itemOptions")
                            if (options != null) {
                                require((0 until options.length()).any { options.get(it) == item }) { "$section.$key 表情选项无效" }
                            } else {
                                require(item is Number && item.toDouble() % 1.0 == 0.0 && item.toDouble() >= field.getDouble("itemMin") && item.toDouble() <= field.getDouble("itemMax")) { "补写时间点应为 1 至 240 分钟" }
                            }
                        }
                    }
                    else -> throw IllegalArgumentException("配置字段类型尚未支持")
                }
                output.put(key, value)
            }
            sections.put(section, output)
        }
        return JSONObject().put("sections", sections).put("backgroundLimit", limit.toInt())
    }
}

package io.hdsinterlude.android

import org.json.JSONObject
import java.io.OutputStream

/** The system picker owns the destination URI; no caller-supplied filesystem paths. */
internal data class CharacterDocument(val name: String, val mime: String, val bytes: ByteArray) {
    fun writeTo(output: OutputStream) { output.use { it.write(bytes); it.flush() } }
    companion object {
        fun from(input: JSONObject): CharacterDocument {
            val name = input.optString("filename")
            val mime = input.optString("mime")
            require(name.isNotBlank() && name.length <= 128 && !name.startsWith(".") && name.none { it.code < 32 || it.code == 127 || it in "<>:\"/\\|?*" }) { "导出文件名无效" }
            require((mime == "application/json" && name.endsWith(".json")) || (mime == "text/yaml" && name.endsWith(".yaml"))) { "导出格式无效" }
            val bytes = input.optString("content").toByteArray(Charsets.UTF_8)
            require(bytes.isNotEmpty() && bytes.size <= 6 * 1024 * 1024) { "角色卡导出内容为空或超过 6 MiB" }
            return CharacterDocument(name, mime, bytes)
        }
    }
}

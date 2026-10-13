package io.hdsinterlude.android

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class HdsStore(private val context: Context) {
    val base = File(context.noBackupFilesDir, "hds").apply { mkdirs() }
    val data = File(base, "profiles").apply { mkdirs() }
    private val cards = File(base, "cards").apply { mkdirs() }
    private val settingsFile = File(base, "settings.json")
    private fun read(file: File): JSONObject = if (file.exists()) JSONObject(AtomicFile(file).openRead().bufferedReader().use { it.readText() }) else JSONObject()
    private fun write(file: File, value: JSONObject) {
        file.parentFile?.mkdirs()
        val atomic = AtomicFile(file)
        val output = atomic.startWrite()
        try { output.write(value.toString().toByteArray(Charsets.UTF_8)); atomic.finishWrite(output) }
        catch (error: Throwable) { atomic.failWrite(output); throw error }
    }
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("hds-model-key", null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder("hds-model-key", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        return generator.generateKey()
    }
    @Synchronized fun privateSettings(): JSONObject = read(settingsFile)
    @Synchronized fun publicSettings(): JSONObject {
        val source = privateSettings()
        return JSONObject().put("endpoint", source.optString("endpoint")).put("model", source.optString("model"))
            .put("credentialPresent", source.optString("encryptedKey").isNotEmpty()).put("userName", source.optString("userName", "我"))
            .put("userProfile", source.optString("userProfile")).put("autoAdvance", source.optBoolean("autoAdvance", false)).put("activeCard", source.optString("activeCard"))
    }
    @Synchronized fun apiKey(): String {
        val prefs = privateSettings()
        val encrypted = prefs.optString("encryptedKey")
        if (encrypted.isEmpty()) return ""
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(prefs.getString("keyIv"), Base64.NO_WRAP)))
        return String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), Charsets.UTF_8)
    }
    @Synchronized fun saveSettings(input: JSONObject) {
        val source = privateSettings()
        val endpoint = input.getString("endpoint").trim()
        val uri = java.net.URI(endpoint)
        require(uri.scheme in listOf("https", "http") && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.fragment == null) { "API 地址必须是完整 HTTP(S) 请求地址，不含凭据或片段" }
        require(input.getString("model").trim().isNotEmpty()) { "模型名称不能为空" }
        for (field in listOf("endpoint", "model", "userName", "userProfile")) {
            val text = input.optString(field)
            require(text.length <= if (field == "userProfile") 12000 else 2048) { "设置字段过长" }
            source.put(field, text.trim())
        }
        source.put("autoAdvance", input.optBoolean("autoAdvance", false))
        if (input.optBoolean("clearKey", false)) { source.remove("encryptedKey"); source.remove("keyIv") }
        val plain = input.optString("apiKey")
        if (plain.isNotEmpty()) {
            require(plain.length <= 8192) { "API Key 超过长度限制" }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            source.put("encryptedKey", Base64.encodeToString(cipher.doFinal(plain.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
            source.put("keyIv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
        }
        write(settingsFile, source)
    }
    @Synchronized fun listCards(): JSONArray {
        val values = JSONArray()
        cards.listFiles { file -> file.name.endsWith(".json") }?.sortedBy { it.name }?.forEach { file -> values.put(read(file)) }
        return values
    }
    @Synchronized fun saveCard(card: JSONObject, bytes: ByteArray): JSONObject {
        require(bytes.size <= 32 * 1024 * 1024 && bytes.isNotEmpty()) { "角色卡超过大小限制" }
        require(card.optString("name").isNotBlank() && card.optString("name").length <= 128) { "角色名称无效" }
        require(card.toString().toByteArray().size <= 6 * 1024 * 1024) { "卡元数据超过限制" }
        val id = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val target = File(cards, "$id.json")
        if (target.exists()) return read(target)
        require(listCards().length() < 32) { "预览版角色库上限为 32 个" }
        val atomic = AtomicFile(File(cards, "$id.source"))
        val output = atomic.startWrite()
        try { output.write(bytes); atomic.finishWrite(output) } catch (error: Throwable) { atomic.failWrite(output); throw error }
        val saved = JSONObject().put("id", id).put("card", card).put("importedAt", java.time.Instant.now().toString())
        write(target, saved)
        return saved
    }
    @Synchronized fun select(id: String) {
        require(id.matches(Regex("[a-f0-9]{64}")) && File(cards, "$id.json").exists()) { "角色不存在" }
        val source = privateSettings().put("activeCard", id)
        write(settingsFile, source)
    }
    @Synchronized fun selectedCard(): JSONObject {
        val id = privateSettings().optString("activeCard")
        require(id.matches(Regex("[a-f0-9]{64}"))) { "请先导入并选择角色" }
        return read(File(cards, "$id.json")).getJSONObject("card")
    }
    @Synchronized fun profile(): File {
        val id = privateSettings().optString("activeCard")
        require(id.matches(Regex("[a-f0-9]{64}"))) { "请先选择角色" }
        return File(data, id).apply { mkdirs() }
    }
}

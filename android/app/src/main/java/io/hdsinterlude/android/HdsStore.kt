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
    init { StoryArchive(base).recover() }
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
    private val models by lazy { ModelSettingsCodec(JSONArray(context.assets.open("model-presets.json").bufferedReader().use { it.readText() })) }
    @Synchronized fun privateSettings(): JSONObject = read(settingsFile)
    @Synchronized fun publicSettings(): JSONObject {
        val source = privateSettings()
        val providers = models.publicRows(source)
        val primary = (0 until providers.length()).map { providers.getJSONObject(it) }.firstOrNull { it.optBoolean("enabled") && it.optBoolean("useForMain") } ?: JSONObject()
        return JSONObject().put("endpoint", primary.optString("endpoint")).put("model", primary.optString("model"))
            .put("credentialPresent", primary.optBoolean("credentialPresent")).put("providers", providers)
            .put("modelOptions", models.options(source.optJSONObject("modelOptions") ?: JSONObject()))
            .put("userName", source.optString("userName", "我")).put("userProfile", source.optString("userProfile"))
            .put("mobileConfig", mobileSettings.normalize(source.optJSONObject("mobileConfig") ?: JSONObject()))
            .put("autoAdvance", source.optBoolean("autoAdvance", false)).put("activeCard", source.optString("activeCard"))
    }
    private val mobileSettings by lazy { MobileSettingsCodec(JSONObject(context.assets.open("mobile-config.schema.json").bufferedReader().use { it.readText() })) }
    private fun decrypt(prefs: JSONObject): String {
        val encrypted = prefs.optString("encryptedKey")
        if (encrypted.isEmpty()) return ""
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(prefs.getString("keyIv"), Base64.NO_WRAP)))
        return String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), Charsets.UTF_8)
    }
    private fun encrypt(plain: String, target: JSONObject) {
        require(plain.length <= 8192) { "API Key 超过长度限制" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        target.put("encryptedKey", Base64.encodeToString(cipher.doFinal(plain.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
        target.put("keyIv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
    }
    @Synchronized fun runtimeProviders(): JSONArray {
        val source = models.configuredRows(models.rows(privateSettings()))
        return JSONArray().also { result ->
            for (i in 0 until source.length()) {
                val row = source.getJSONObject(i)
                if (!row.optBoolean("enabled", true)) continue
                result.put(models.normalize(row).put("apiKey", decrypt(row)))
            }
        }
    }
    @Synchronized fun modelRequest(input: JSONObject, requireModel: Boolean): JSONObject {
        val previous = models.rows(privateSettings())
        val id = input.optString("id")
        val old = (0 until previous.length()).map { previous.getJSONObject(it) }.firstOrNull { it.optString("id") == id }
        val draft = if (input.has("endpoint") || input.has("preset")) input else old ?: throw IllegalArgumentException("请选择模型连接")
        val normalized = models.normalize(draft, requireModel)
        models.preserveCredential(draft, normalized, old)
        val plain = draft.optString("apiKey")
        require(plain.length <= 8192) { "API Key 超过长度限制" }
        normalized.put("apiKey", if (plain.isNotEmpty()) plain else decrypt(normalized))
        normalized.remove("encryptedKey"); normalized.remove("keyIv")
        return normalized
    }
    @Synchronized fun saveSettings(input: JSONObject) {
        val source = privateSettings()
        val previous = models.rows(source)
        val incoming = models.configuredRows(input.getJSONArray("providers"), previous)
        require(incoming.length() in 1..12) { "请配置 1 至 12 条模型连接" }
        val saved = JSONArray()
        for (i in 0 until incoming.length()) {
            val draft = incoming.getJSONObject(i)
            val row = models.normalize(draft)
            val old = (0 until previous.length()).map { previous.getJSONObject(it) }.firstOrNull { it.optString("id") == row.getString("id") }
            models.preserveCredential(draft, row, old)
            val plain = draft.optString("apiKey")
            if (plain.isNotEmpty()) encrypt(plain, row)
            saved.put(row)
        }
        models.validateRows(saved)
        source.put("providers", saved).put("modelOptions", models.options(input.optJSONObject("modelOptions") ?: JSONObject())).put("schema", 2)
        // Atomic migration: obsolete singleton credentials disappear only after a valid save.
        for (field in listOf("endpoint", "model", "encryptedKey", "keyIv")) source.remove(field)
        for (field in listOf("userName", "userProfile")) {
            val text = input.optString(field)
            require(text.length <= if (field == "userProfile") 12000 else 128) { "设置字段过长" }
            source.put(field, text.trim())
        }
        source.put("mobileConfig", mobileSettings.normalize(input.optJSONObject("mobileConfig") ?: source.optJSONObject("mobileConfig") ?: JSONObject()))
        source.put("autoAdvance", input.optBoolean("autoAdvance", false))
        write(settingsFile, source)
    }
    @Synchronized fun listCards(): JSONArray {
        val values = JSONArray()
        cards.listFiles { file -> file.name.endsWith(".json") }?.sortedBy { it.name }?.forEach { file -> val saved = read(file); if (!saved.optBoolean("deleted")) values.put(saved) }
        return values
    }
    @Synchronized fun saveCard(card: JSONObject, original: ByteArray): JSONObject {
        val bytes = if (card.optString("format") == "hds") card.getJSONObject("raw").toString().toByteArray(Charsets.UTF_8) else original
        require(bytes.size <= 32 * 1024 * 1024 && bytes.isNotEmpty()) { "角色卡超过大小限制" }
        require(card.optString("name").isNotBlank() && card.optString("name").length <= 128) { "角色名称无效" }
        require(card.toString().toByteArray().size <= 6 * 1024 * 1024) { "卡元数据超过限制" }
        val id = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val target = File(cards, "$id.json")
        if (target.exists()) {
            val existing = read(target)
            if (existing.optBoolean("deleted")) { existing.remove("deleted"); write(target, existing) }
            return existing
        }
        require(listCards().length() < 32) { "预览版角色库上限为 32 个" }
        val atomic = AtomicFile(File(cards, "$id.source"))
        val output = atomic.startWrite()
        try { output.write(bytes); atomic.finishWrite(output) } catch (error: Throwable) { atomic.failWrite(output); throw error }
        val saved = JSONObject().put("id", id).put("card", card).put("importedAt", java.time.Instant.now().toString())
        write(target, saved)
        return saved
    }
    private fun cardFile(id: String): File {
        require(id.matches(Regex("[a-f0-9]{64}"))) { "角色编号无效" }
        return File(cards, "$id.json").also { require(it.isFile && !read(it).optBoolean("deleted")) { "角色不存在" } }
    }
    @Synchronized fun updateCard(id: String, card: JSONObject): JSONObject {
        val target = cardFile(id)
        require(card.optString("name").isNotBlank() && card.optString("name").length <= 128) { "角色名称无效" }
        require(card.toString().toByteArray(Charsets.UTF_8).size <= 6 * 1024 * 1024) { "人设内容过大" }
        val saved = read(target)
        val revision = saved.optInt("revision", 0) + 1
        card.put("revision", revision)
        saved.put("card", card).put("revision", revision).put("updatedAt", java.time.Instant.now().toString())
        write(target, saved)
        return saved
    }
    @Synchronized fun deleteCard(id: String) {
        val target = cardFile(id)
        val settings = privateSettings()
        if (settings.optString("activeCard") == id) { settings.remove("activeCard"); write(settingsFile, settings) }
        // Remove from library without recursively deleting the independent story directory.
        write(target, read(target).put("deleted", true))
    }
    @Synchronized fun select(id: String) {
        cardFile(id)
        val source = privateSettings().put("activeCard", id)
        write(settingsFile, source)
    }
    @Synchronized fun selectedCard(): JSONObject {
        val id = privateSettings().optString("activeCard")
        require(id.matches(Regex("[a-f0-9]{64}"))) { "请先导入并选择角色" }
        return read(cardFile(id)).getJSONObject("card")
    }
    @Synchronized fun profile(): File {
        val id = privateSettings().optString("activeCard")
        require(id.matches(Regex("[a-f0-9]{64}"))) { "请先选择角色" }
        return File(data, id).apply { mkdirs() }
    }
}

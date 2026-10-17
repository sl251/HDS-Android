package io.hdsinterlude.android

import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Files
import java.security.MessageDigest
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/** Only the selected profile and its card are included. No credentials or shared QQ directory. */
class StoryArchive(private val base: File) {
    private val journal = File(base, "story-operation.json")
    private fun hash(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input -> val block = ByteArray(65536); while (true) { val count = input.read(block); if (count < 0) break; digest.update(block, 0, count) } }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
    private fun current(id: String): File { require(id.matches(Regex("[a-f0-9]{64}"))) { "角色编号无效" }; return File(base, "profiles/$id") }
    private fun card(id: String) = File(base, "cards/$id.json")
    private fun writeCard(id: String, bytes: ByteArray) {
        val temporary = File(base, "cards/$id.restore.tmp")
        temporary.outputStream().use { stream -> stream.write(bytes); stream.fd.sync() }
        Files.move(temporary.toPath(), card(id).toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE)
    }
    fun export(id: String, output: OutputStream) {
        val profile = current(id); require(File(profile, "hds.sqlite").isFile) { "当前角色尚无故事存档" }
        val files = linkedMapOf("card.json" to card(id), "card.source" to File(base, "cards/$id.source"))
        profile.walkTopDown().forEach { file ->
            require(!Files.isSymbolicLink(file.toPath())) { "存档包含符号链接，无法导出" }
            if (file.isFile) files["profile/" + file.relativeTo(profile).invariantSeparatorsPath] = file
        }
        val voiceDir = File(base, "voice")
        val refs = File(profile, "voice-references.json").takeIf { it.isFile }?.let { JSONArray(it.readText()) } ?: JSONArray()
        val settings = File(voiceDir, "settings.json").takeIf { it.isFile }?.let { JSONObject(it.readText()) } ?: JSONObject()
        val binding = settings.optJSONObject("characters")?.optJSONObject(id)
        val voiceId = binding?.optString("voiceId")?.ifEmpty { settings.optString("defaultVoiceId", "builtin") } ?: "builtin"
        val voices = settings.optJSONArray("voices") ?: JSONArray()
        val voice = (0 until voices.length()).map { voices.getJSONObject(it) }.firstOrNull { it.optString("id") == voiceId }
        val selection = JSONObject().put("binding", binding ?: JSONObject()).put("voice", voice ?: JSONObject().put("id", "builtin").put("type", "builtin").put("name", "茉莉").put("value", "茉莉"))
        // Private metadata lives in the selected profile; no provider keys or other bindings.
        val selectionFile = File(profile, "archive-voice-selection.json").apply { writeText(selection.toString()) }
        files["voice/selection.json"] = selectionFile
        if (voice?.optString("type") == "reference") refs.put(voice.getString("value"))
        val missing = JSONArray()
        for (i in 0 until refs.length()) {
            val audioId = refs.getString(i); require(audioId.matches(Regex("[a-f0-9]{64}"))) { "语音引用无效" }
            val media = File(voiceDir, "$audioId.wav")
            if (!media.isFile) { missing.put(audioId); continue }
            require(!Files.isSymbolicLink(media.toPath()) && media.length() <= VoiceStore.MAX_AUDIO && hash(media) == audioId) { "语音媒体校验失败" }
            files["voice/$audioId.wav"] = media
        }
        val manifest = JSONObject().put("format", 2).put("cardId", id).put("hds", RuntimeContract.CORE).put("app", RuntimeContract.VERSION)
            .put("missingAudio", missing).put("voiceIndexPresent", File(profile, "voice-references.json").isFile).put("createdAt", java.time.Instant.now().toString())
        val checksums = JSONObject(); for ((name, file) in files) { require(file.isFile); checksums.put(name, hash(file)) }; manifest.put("sha256", checksums)
        ZipOutputStream(output).use { zip ->
            zip.putNextEntry(ZipEntry("manifest.json")); zip.write(manifest.toString().toByteArray()); zip.closeEntry()
            for ((name, file) in files) { zip.putNextEntry(ZipEntry(name)); file.inputStream().use { it.copyTo(zip) }; zip.closeEntry() }
        }
    }
    fun stage(id: String, input: InputStream): File {
        current(id)
        val stage = File(base, "story-staging/${UUID.randomUUID()}").apply { mkdirs() }
        try {
            val seen = HashSet<String>(); var total = 0L
            ZipInputStream(input).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break; val name = entry.name
                    require(!entry.isDirectory && seen.add(name) && seen.size <= 10000 && name.length <= 512) { "存档条目无效或重复" }
                    require(name in listOf("manifest.json", "card.json", "card.source", "voice/selection.json") || name.startsWith("profile/") || name.matches(Regex("voice/[a-f0-9]{64}\\.wav"))) { "存档包含未知条目" }
                    require(!name.contains('\\') && name.split('/').none { it == ".." || it == "." || it.isEmpty() } && !name.contains(':')) { "存档路径无效" }
                    val target = File(stage, name).canonicalFile
                    require(target.toPath().startsWith(stage.canonicalFile.toPath())) { "存档路径越界" }
                    target.parentFile.mkdirs(); target.outputStream().use { out ->
                        val block = ByteArray(65536); var size = 0L
                        while (true) { val count = zip.read(block); if (count < 0) break; size += count; total += count; require(size <= 512L * 1024 * 1024 && total <= 1024L * 1024 * 1024) { "存档超过大小限制" }; out.write(block, 0, count) }
                    }
                    zip.closeEntry()
                }
            }
            val metadata = File(stage, "manifest.json"); require(metadata.length() <= 2 * 1024 * 1024) { "清单过大" }
            val manifest = JSONObject(metadata.readText())
            require(manifest.getInt("format") in 1..2 && manifest.getString("cardId") == id && manifest.getString("hds") in listOf("1.0.1-rc51", "1.0.1-rc56", RuntimeContract.CORE)) { "请选择当前角色的兼容存档" }
            if (manifest.getInt("format") == 1) require(seen.none { it.startsWith("voice/") }) { "旧格式存档不能包含媒体扩展" }
            val checksums = manifest.getJSONObject("sha256"); val keys = checksums.keys().asSequence().toSet()
            require(keys == seen - "manifest.json") { "存档文件与清单不一致" }
            for (name in keys) require(hash(File(stage, name)) == checksums.getString(name)) { "存档校验失败：$name" }
            for (name in keys.filter { it.startsWith("voice/") && it.endsWith(".wav") }) {
                val media = File(stage, name); require(media.length() <= VoiceStore.MAX_AUDIO && hash(media) == media.nameWithoutExtension) { "语音摘要无效" }; WavAudio.duration(media.readBytes())
            }
            File(stage, "voice/selection.json").takeIf { it.isFile }?.let { selection ->
                require(selection.length() <= 16384); val row = JSONObject(selection.readText()); val voice = row.getJSONObject("voice")
                require(row.keys().asSequence().all { it in listOf("binding", "voice") } && voice.keys().asSequence().all { it in listOf("id", "name", "type", "value", "verified") }) { "音色配置包含未知字段" }
                require(voice.optString("type") in listOf("builtin", "design", "reference") && voice.optString("name").length in 1..64 && voice.optString("value").length in 1..2000) { "音色配置无效" }
                if (voice.optString("type") == "reference") require(File(stage, "voice/${voice.getString("value")}.wav").isFile && voice.getString("value").matches(Regex("[a-f0-9]{64}"))) { "参考音频缺失" }
            }
            require(File(stage, "profile/hds.sqlite").isFile && File(stage, "card.source").isFile && File(stage, "card.json").length() <= 6 * 1024 * 1024) { "存档缺少数据库或角色卡" }
            val saved = JSONObject(File(stage, "card.json").readText()); require(saved.getString("id") == id && saved.getJSONObject("card").getString("name").isNotBlank()) { "存档角色无效" }
            val sqlite = ByteArray(16); java.io.DataInputStream(File(stage, "profile/hds.sqlite").inputStream()).use { it.readFully(sqlite) }
            require(String(sqlite, Charsets.US_ASCII) == "SQLite format 3\u0000") { "存档数据库无效" }
            return stage
        } catch (error: Throwable) { stage.deleteRecursively(); throw error }
    }
    private fun writeJournal(value: JSONObject) {
        val temp = File(base, "story-operation.tmp")
        temp.outputStream().use { stream -> stream.write(value.toString().toByteArray()); stream.fd.sync() }
        Files.move(temp.toPath(), journal.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE)
    }
    fun stagePrevious(id: String): File {
        current(id)
        val previous = File(base, "story-backups/$id").listFiles()?.filter { it.isDirectory && it.name.matches(Regex("[a-f0-9-]{36}")) && File(it, "profile/hds.sqlite").isFile && File(it, "card.json").isFile }?.maxByOrNull { it.lastModified() }
            ?: throw IllegalArgumentException("当前角色没有可恢复的本机备份")
        val stage = File(base, "story-staging/${UUID.randomUUID()}").apply { mkdirs() }
        try {
            File(previous, "profile").walkTopDown().forEach { require(!Files.isSymbolicLink(it.toPath())) { "备份包含无效链接" } }
            require(File(previous, "profile").copyRecursively(File(stage, "profile"))) { "复制备份失败" }
            File(previous, "card.json").copyTo(File(stage, "card.json"))
            return stage
        } catch (error: Throwable) { stage.deleteRecursively(); throw error }
    }
    fun replace(id: String, stage: File? = null): String {
        require(!journal.exists()) { "上一次存档操作尚未恢复" }
        val profile = current(id).apply { mkdirs() }
        val operation = UUID.randomUUID().toString(); val backup = File(base, "story-backups/$id/$operation").apply { mkdirs() }
        val savedCard = card(id).readText(); File(backup, "card.json").writeText(savedCard)
        val record = JSONObject().put("cardId", id).put("operation", operation).put("phase", "prepared").put("oldCard", savedCard)
        val voiceSettings = File(base, "voice/settings.json")
        if (voiceSettings.isFile) record.put("oldVoiceSettings", voiceSettings.readText())
        record.put("hadVoiceSettings", voiceSettings.isFile)
        writeJournal(record)
        try {
            require(profile.renameTo(File(backup, "profile"))) { "无法备份原故事" }
            if (stage != null) {
                val mediaDir = File(base, "voice").apply { mkdirs() }
                File(stage, "voice").listFiles()?.filter { it.extension == "wav" }?.forEach { media ->
                    val target = File(mediaDir, media.name)
                    require(!Files.isSymbolicLink(target.toPath())) { "音频路径无效" }
                    if (target.exists()) require(hash(target) == media.nameWithoutExtension) { "已有音频摘要冲突" }
                    else { val temporary = File(mediaDir, "${media.name}.restore.tmp"); media.copyTo(temporary, overwrite = true); Files.move(temporary.toPath(), target.toPath(), java.nio.file.StandardCopyOption.ATOMIC_MOVE) }
                }
                File(stage, "voice/selection.json").takeIf { it.isFile }?.let { selection ->
                    val row = JSONObject(selection.readText()); val incoming = row.getJSONObject("voice")
                    val config = if (voiceSettings.isFile) JSONObject(voiceSettings.readText()) else JSONObject()
                    val voices = config.optJSONArray("voices") ?: JSONArray().put(JSONObject().put("id", "builtin").put("name", "茉莉").put("type", "builtin").put("value", "茉莉"))
                    val voiceId = if (incoming.optString("type") == "builtin") "builtin" else "archive-" + hash(selection).take(32)
                    if (voiceId != "builtin" && (0 until voices.length()).none { voices.getJSONObject(it).optString("id") == voiceId }) voices.put(JSONObject(incoming.toString()).put("id", voiceId))
                    val binding = row.getJSONObject("binding").put("voiceId", voiceId)
                    val chars = config.optJSONObject("characters") ?: JSONObject(); chars.put(id, binding)
                    config.put("voices", voices).put("characters", chars)
                    val atomic = android.util.AtomicFile(voiceSettings); val stream = atomic.startWrite()
                    try { stream.write(config.toString().toByteArray()); atomic.finishWrite(stream) } catch (e: Throwable) { atomic.failWrite(stream); throw e }
                }
                require(File(stage, "profile").renameTo(profile)) { "无法安装恢复的故事" }
                writeCard(id, File(stage, "card.json").readBytes())
            } else {
                profile.mkdirs(); File(backup, "profile/qq-policy.json").takeIf { it.isFile }?.copyTo(File(profile, "qq-policy.json"))
            }
            writeJournal(record.put("phase", "installed"))
            return operation
        } catch (error: Throwable) { recover(); throw error }
    }
    fun commit() { require(journal.delete()) { "无法完成存档操作" } }
    fun recover() {
        if (!journal.exists()) return
        val record = JSONObject(journal.readText()); val id = record.getString("cardId"); val operation = record.getString("operation")
        require(operation.matches(Regex("[a-f0-9-]{36}"))) { "恢复清单无效" }
        val profile = current(id); val backup = File(base, "story-backups/$id/$operation/profile")
        if (backup.isDirectory) {
            if (profile.exists()) { val rejected = File(base, "story-staging/rejected-${UUID.randomUUID()}"); rejected.parentFile.mkdirs(); require(profile.renameTo(rejected)) { "无法隔离未完成故事" } }
            require(backup.renameTo(profile)) { "无法恢复旧故事，请保留应用数据并重试" }
        }
        // Repeating recovery after the profile was already moved back still restores
        // the card atomically; a process kill cannot leave half-written card JSON.
        writeCard(id, record.getString("oldCard").toByteArray())
        val voiceSettings = File(base, "voice/settings.json")
        if (record.optBoolean("hadVoiceSettings")) {
            val atomic = android.util.AtomicFile(voiceSettings); val stream = atomic.startWrite()
            try { stream.write(record.getString("oldVoiceSettings").toByteArray()); atomic.finishWrite(stream) } catch (e: Throwable) { atomic.failWrite(stream); throw e }
        } else if (record.has("hadVoiceSettings")) voiceSettings.delete()
        require(journal.delete()) { "无法清理恢复清单" }
    }
}

package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.security.MessageDigest
import java.util.zip.ZipInputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class AuditArchiveTest {
    private val id = "a".repeat(64)
    private val other = "b".repeat(64)
    private fun profile(root: File) {
        File(root, "cards").mkdirs(); File(root, "profiles/$id").mkdirs()
        File(root, "cards/$id.json").writeText(JSONObject().put("id", id).put("card", JSONObject().put("name", "fixture")).toString())
        File(root, "cards/$id.source").writeText("fixture")
        File(root, "profiles/$id/hds.sqlite").writeBytes("SQLite format 3\u0000fixture".toByteArray())
    }
    @Test fun cleanDirectoryRestoreIncludesOnlySelectedHistoryAndEffectiveVoiceAndRecoversSettings() {
        val root = Files.createTempDirectory("audit-archive-source").toFile(); val clean = Files.createTempDirectory("audit-archive-clean").toFile()
        try {
            profile(root); profile(clean)
            val wav = WavAudio.pcm(ByteArray(4800), 24000, 1)
            val audioId = MessageDigest.getInstance("SHA-256").digest(wav).joinToString("") { "%02x".format(it) }
            val voices = File(root, "voice").apply { mkdirs() }; File(voices, "$audioId.wav").writeBytes(wav)
            File(voices, "${"c".repeat(64)}.wav").writeText("other character private fixture")
            File(root, "profiles/$id/voice-references.json").writeText(JSONArray().put(audioId).toString())
            File(voices, "settings.json").writeText(JSONObject().put("defaultVoiceId", "ref").put("voices", JSONArray().put(JSONObject().put("id", "ref").put("name", "参考").put("type", "reference").put("value", audioId)))
                .put("characters", JSONObject().put(id, JSONObject().put("enabled", true).put("voiceId", "").put("threshold", .7)).put(other, JSONObject().put("enabled", true))).toString())
            val out = ByteArrayOutputStream(); StoryArchive(root).export(id, out)
            val entries = mutableSetOf<String>(); ZipInputStream(ByteArrayInputStream(out.toByteArray())).use { zip -> while (true) { val e = zip.nextEntry ?: break; entries.add(e.name) } }
            assertTrue(entries.contains("voice/$audioId.wav")); assertFalse(entries.contains("voice/${"c".repeat(64)}.wav"))
            val archive = StoryArchive(clean); val stage = archive.stage(id, ByteArrayInputStream(out.toByteArray()))
            archive.replace(id, stage)
            assertArrayEquals(wav, File(clean, "voice/$audioId.wav").readBytes())
            val restored = JSONObject(File(clean, "voice/settings.json").readText())
            assertFalse(restored.getJSONObject("characters").has(other)); assertTrue(restored.getJSONObject("characters").getJSONObject(id).getBoolean("enabled"))
            archive.recover(); assertFalse(File(clean, "voice/settings.json").exists())
            val second = archive.stage(id, ByteArrayInputStream(out.toByteArray())); archive.replace(id, second); archive.commit()
            assertTrue(File(clean, "voice/settings.json").isFile)
        } finally { root.deleteRecursively(); clean.deleteRecursively() }
    }
}

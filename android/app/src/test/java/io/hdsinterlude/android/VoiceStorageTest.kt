package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.json.JSONObject
import org.json.JSONArray
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class VoiceStorageTest {
    @Test fun explicitPruningProtectsHistoryReferencesRecentSamplesAndChangedPreviews() {
        val context = RuntimeEnvironment.getApplication(); val root = File(context.noBackupFilesDir, "hds"); root.deleteRecursively()
        val voices = VoiceStore(context); val storage = VoiceStorage(context)
        fun media(n: Int, recent: Boolean = false): String {
            val id = voices.putAudio(WavAudio.pcm(ByteArray(4800) { n.toByte() }, 24000, 1)).getString("audioId")
            if (!recent) voices.audioFile(id).setLastModified(System.currentTimeMillis() - 48 * 60 * 60 * 1000L)
            return id
        }
        val history = media(1); val reference = media(2); val orphan = media(3); val recent = media(4, true)
        voices.saveVoice(JSONObject().put("id", "reference-fixture").put("type", "reference").put("name", "参考").put("value", reference))
        val profile = File(root, "profiles/${"a".repeat(64)}").apply { mkdirs() }; File(profile, "hds.sqlite").writeText("fixture")
        val index = File(profile, "voice-references.json"); index.writeText(JSONArray().put(history).toString())
        val preview = storage.preview(); assertEquals(1, preview.getInt("orphanFiles"))
        assertThrows(IllegalArgumentException::class.java) { storage.prune(JSONObject().put("previewId", preview.getString("previewId"))) }
        index.writeText(JSONArray().put(history).put(orphan).toString())
        assertThrows(IllegalArgumentException::class.java) { storage.prune(JSONObject().put("confirm", true).put("previewId", preview.getString("previewId"))) }
        index.writeText(JSONArray().put(history).toString())
        storage.prune(JSONObject().put("confirm", true).put("previewId", storage.preview().getString("previewId")))
        assertFalse(voices.audioFile(orphan).exists()); for (id in listOf(history, reference, recent)) assertTrue(voices.audioFile(id).isFile)
        index.delete(); assertFalse(storage.preview().getBoolean("referencesComplete")); assertEquals(0, storage.preview().getInt("orphanFiles"))
    }
}

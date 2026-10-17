package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.json.JSONObject
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class PresetCommitTest {
    private lateinit var store: HdsStore
    private lateinit var cardId: String
    @Before fun setup() {
        val context = RuntimeEnvironment.getApplication(); File(context.noBackupFilesDir, "hds").deleteRecursively()
        store = HdsStore(context); cardId = store.saveCard(JSONObject().put("name", "fixture").put("format", "v2"), "fixture-source".toByteArray()).getString("id"); store.select(cardId)
    }
    @Test fun nativeCommitSurvivesLostHostReceiptAndReplayAndPinsTheSelectedCard() {
        var applies = 0; var fail = true; val applied = hashSetOf<String>()
        val config = JSONObject().put("backgroundLimit", 77).put("sections", JSONObject())
        val call: (String, JSONObject) -> JSONObject = { method, payload ->
            val data = when (method) {
                "preset.sync" -> JSONObject().put("config", config).put("storyPatch", JSONObject().put("world", "海边"))
                "story.snapshot" -> JSONObject().put("story", JSONObject().put("id", "story-fixture")).put("settingRevision", "a".repeat(64))
                "story.applySetting" -> { if (applied.add(payload.getString("operationId"))) applies++; if (fail) { fail = false; throw java.net.SocketTimeoutException("fixture lost receipt") }; JSONObject().put("world", "海边") }
                else -> throw IllegalArgumentException(method)
            }; JSONObject().put("data", data)
        }
        fun commit() = PresetCommit(store, call, { require(it == cardId) })
        val before = store.publicSettings().getJSONObject("mobileConfig")
        val input = JSONObject().put("operationId", "fixture-import-operation").put("cardId", cardId).put("code", "ABCDEFGH").put("fingerprint", "fixture").put("current", before)
        assertThrows(java.net.SocketTimeoutException::class.java) { commit().apply(input) }
        assertEquals("prepared", commit().status().getString("state")); assertEquals(canonicalJson(before), canonicalJson(store.publicSettings().getJSONObject("mobileConfig")))
        val resume = JSONObject().put("operationId", "fixture-import-operation").put("cardId", cardId).put("resume", true)
        assertEquals("committed", commit().apply(resume).getString("state")); assertEquals(1, applies)
        assertEquals(77, store.publicSettings().getJSONObject("mobileConfig").getInt("backgroundLimit"))
        commit().apply(resume); assertEquals(1, applies)
        val other = store.saveCard(JSONObject().put("name", "other").put("format", "v2"), "different-source".toByteArray()).getString("id"); store.select(other)
        assertThrows(IllegalArgumentException::class.java) { commit().apply(resume) }; assertEquals(1, applies)
    }
}

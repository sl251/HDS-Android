package io.hdsinterlude.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class ExperienceSettingsTest {
    private lateinit var store: HdsStore
    private lateinit var cardId: String
    @Before fun setup() {
        val context = RuntimeEnvironment.getApplication()
        File(context.noBackupFilesDir, "hds").deleteRecursively()
        store = HdsStore(context)
        cardId = store.saveCard(JSONObject().put("name", "测试角色"), "image-settings".toByteArray()).getString("id")
        store.select(cardId)
    }
    private fun draft() = JSONObject().put("cardId", cardId)
        .put("stt", JSONObject().put("enabled", false).put("provider", "compatible"))
        .put("image", JSONObject().put("enabled", true).put("provider", "compatible").put("endpoint", "https://provider.test/v1").put("model", "image"))
    @Test fun imageProtocolsSurviveStorageAndReload() {
        for (api in listOf("auto", "images", "chat", "gemini")) {
            val input = draft()
            input.getJSONObject("image").put("imageApi", api).put("referenceImages", true)
            store.saveExperience(input)
            val reloaded = HdsStore(RuntimeEnvironment.getApplication()).experienceSettings()
            assertEquals(api, reloaded.getJSONObject("image").getString("imageApi"))
            assertTrue(reloaded.getJSONObject("image").getBoolean("referenceImages"))
        }
    }
    @Test fun oldSettingsDefaultToAutoAndInvalidProtocolPreservesSavedSettings() {
        store.saveExperience(draft())
        assertEquals("auto", store.experienceSettings().getJSONObject("image").getString("imageApi"))
        val input = draft()
        input.getJSONObject("image").put("imageApi", "unsupported")
        assertThrows(IllegalArgumentException::class.java) { store.saveExperience(input) }
        assertEquals("auto", store.experienceSettings().getJSONObject("image").getString("imageApi"))
    }
}

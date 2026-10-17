package io.hdsinterlude.android

import org.json.JSONObject
import org.junit.Assert.assertThrows
import org.junit.Test

class StickerImportPolicyTest {
    private fun settings() = JSONObject("""{"modelOptions":{"visionEnabled":true},"providers":[{"id":"vision","enabled":true,"useForMain":true,"endpoint":"https://example.com/v1","model":"vision-model","imageInput":"supported"}]}""")
    @Test fun importsRequireEnabledConfiguredVisionBeforeCopying() {
        requireStickerVision(settings())
        assertThrows(IllegalArgumentException::class.java) { requireStickerVision(JSONObject()) }
        assertThrows(IllegalArgumentException::class.java) { requireStickerVision(settings().apply { getJSONObject("modelOptions").put("visionEnabled", false) }) }
        for ((key, value) in listOf("model" to "", "endpoint" to "", "imageInput" to "unsupported")) {
            assertThrows(IllegalArgumentException::class.java) { requireStickerVision(settings().apply { getJSONArray("providers").getJSONObject(0).put(key, value) }) }
        }
        assertThrows(IllegalArgumentException::class.java) { requireStickerVision(settings().apply { getJSONObject("modelOptions").put("visionProviderId", "missing") }) }
        assertThrows(IllegalArgumentException::class.java) { requireStickerVision(settings().apply { getJSONArray("providers").getJSONObject(0).put("enabled", false) }) }
        requireStickerVision(settings().apply { getJSONObject("modelOptions").put("visionProviderId", "vision"); getJSONArray("providers").getJSONObject(0).put("useForMain", false) })
    }
}

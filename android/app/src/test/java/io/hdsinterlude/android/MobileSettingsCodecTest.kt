package io.hdsinterlude.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class MobileSettingsCodecTest {
    private fun codec() = MobileSettingsCodec(JSONObject(File("src/main/assets/mobile-config.schema.json").readText()))
    @Test fun migrationAndRoundTrip() {
        assertEquals(120, codec().normalize(JSONObject()).getInt("backgroundLimit"))
        val source = JSONObject("""{"backgroundLimit":45,"sections":{"urge":{"enabled":true,"frequency":"low"},"runtime":{"conversationFollowUpMinutes":[8,25]},"agency":{"contactMode":"balanced"}}}""")
        val saved = codec().normalize(source)
        assertEquals(saved.toString(), codec().normalize(saved).toString())
        assertEquals("low", saved.getJSONObject("sections").getJSONObject("urge").getString("frequency"))
    }
    @Test fun rejectsUnsafeOrInvalidConfiguration() {
        for (json in listOf("""{"sections":{"model":{"apiKey":"secret"}}}""", """{"sections":{"qzone":{"enabled":true}}}""", """{"backgroundLimit":-1}""", """{"sections":{"urge":{"frequency":"bad"}}}""", """{"sections":{"agency":{"enabled":"true"}}}""", """{"sections":{"runtime":{"conversationFollowUpMinutes":[0,241]}}}""")) {
            try { codec().normalize(JSONObject(json)); fail("Accepted $json") } catch (_: IllegalArgumentException) { }
        }
    }
}

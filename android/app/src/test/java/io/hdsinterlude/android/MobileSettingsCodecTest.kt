package io.hdsinterlude.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class MobileSettingsCodecTest {
    private fun codec() = MobileSettingsCodec(JSONObject(File("src/main/assets/mobile-config.schema.json").readText()))
    @Test fun scheduledContactThresholdsRoundTripAndRejectInvalidValues() {
        for (minimum in listOf(10, 300, 43200)) {
            val source = JSONObject().put("sections", JSONObject().put("runtime", JSONObject().put("minimumFollowUpCommitmentSeconds", minimum).put("sweepIntervalMinutes", 1)))
            assertEquals(minimum, codec().normalize(source).getJSONObject("sections").getJSONObject("runtime").getInt("minimumFollowUpCommitmentSeconds"))
            assertEquals(codec().normalize(source).toString(), codec().normalize(codec().normalize(source)).toString())
        }
        for (minimum in listOf(9.0, 43201.0, 10.5)) {
            val source = JSONObject().put("sections", JSONObject().put("runtime", JSONObject().put("minimumFollowUpCommitmentSeconds", minimum)))
            assertThrows(IllegalArgumentException::class.java) { codec().normalize(source) }
        }
    }
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

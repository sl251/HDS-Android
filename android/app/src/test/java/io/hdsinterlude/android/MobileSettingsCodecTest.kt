package io.hdsinterlude.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class MobileSettingsCodecTest {
    @Test fun chatExpressionsEmbeddingAndWeatherRoundTrip() {
        val source = JSONObject("""{"sections":{"chatActions":{"enabled":true,"messageReactions":true,"nativeFaces":true,"allowedReactions":["like","heart"],"allowedNativeFaces":["smile","awkward"]},"embedding":{"enabled":true,"liveQuery":false,"providerId":"vector"},"weather":{"enabled":true,"latitude":39.14,"longitude":117.18,"autoFromLocation":true,"skipFantasyWorld":false,"cadenceMinutes":30}}}""")
        val saved = codec().normalize(source)
        assertEquals(saved.toString(), codec().normalize(saved).toString())
        assertEquals("vector", saved.getJSONObject("sections").getJSONObject("embedding").getString("providerId"))
        for (invalid in listOf("""{"chatActions":{"allowedReactions":[1]}}""", """{"chatActions":{"allowedNativeFaces":["invalid"]}}""", """{"embedding":{"providerId":5}}""", """{"weather":{"latitude":91}}""")) {
            assertThrows(IllegalArgumentException::class.java) { codec().normalize(JSONObject().put("sections", JSONObject(invalid))) }
        }
    }
    @Test fun m4LifeWorldSectionsRoundTripWithMobileMemoryCaps() {
        val sections = JSONObject("""{"schedulePreplan":{"enabled":true,"horizonDays":14,"variationLevel":"stable"},"timelineDirector":{"enabled":true},"memory":{"enabled":true,"recentEntryLimit":20,"factLimit":20},"worldSeeder":{"enabled":false,"cadenceMinutes":30,"dailyCap":8},"longHorizon":{"enabled":false,"reviewIncrement":40,"intensity":"subtle"},"weather":{"enabled":false,"cadenceMinutes":30}}""")
        val source = JSONObject().put("sections", sections)
        assertEquals(sections.toString(), codec().normalize(source).getJSONObject("sections").toString())
        for (invalid in listOf("""{"memory":{"recentEntryLimit":21}}""", """{"memory":{"factLimit":21}}""", """{"worldSeeder":{"cadenceMinutes":4}}""", """{"longHorizon":{"intensity":"extreme"}}""", """{"schedulePreplan":{"horizonDays":31}}""")) {
            assertThrows(IllegalArgumentException::class.java) { codec().normalize(JSONObject().put("sections", JSONObject(invalid))) }
        }
    }
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

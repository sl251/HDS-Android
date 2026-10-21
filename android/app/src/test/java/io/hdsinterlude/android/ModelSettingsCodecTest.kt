package io.hdsinterlude.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ModelSettingsCodecTest {
    @Test fun reliabilityDefaultsAndExplicitValuesSurviveNativePersistence() {
        val defaults = codec.options(JSONObject())
        assertEquals(90000, defaults.getInt("mainTimeout"))
        assertEquals(2, defaults.getInt("maxAttemptsPerProvider"))
        assertEquals(240000, defaults.getInt("mobileTurnDeadlineMs"))
        assertEquals(5, defaults.getInt("cooldownMinutes"))
        assertFalse(defaults.getBoolean("failoverEnabled"))
        assertEquals("off", defaults.getString("mainStreamingMode"))
        for (attempts in 1..3) for (deadline in listOf(60000, 240000, 600000)) {
            val saved = codec.options(JSONObject().put("maxAttemptsPerProvider", attempts).put("mobileTurnDeadlineMs", deadline).put("cooldownMinutes", 12))
            val restored = codec.options(JSONObject(saved.toString()))
            assertEquals(attempts, restored.getInt("maxAttemptsPerProvider"))
            assertEquals(deadline, restored.getInt("mobileTurnDeadlineMs"))
            assertEquals(12, restored.getInt("cooldownMinutes"))
        }
        for ((field, values) in mapOf("maxAttemptsPerProvider" to listOf(0.0, 4.0, 1.5), "mobileTurnDeadlineMs" to listOf(59999.0, 600001.0, 60000.5), "cooldownMinutes" to listOf(-1.0, 61.0, 0.5))) {
            for (value in values) assertThrows(IllegalArgumentException::class.java) { codec.options(JSONObject().put(field, value)) }
        }
    }
    @Test fun schemaThreeMigrationOnlyChangesExactOldTimeoutDefaultAndPreservesFailover() {
        for (schema in listOf(0, 1, 2, 3)) for (timeout in listOf(60000, 75000, 120000)) for (failover in listOf(false, true)) {
            val settings = JSONObject().put("schema", schema).put("modelOptions", JSONObject().put("mainTimeout", timeout).put("failoverEnabled", failover)).put("encryptedKey", "keep")
            assertEquals(schema < 3, codec.migrate(settings))
            assertEquals(3, settings.getInt("schema"))
            assertEquals(if (schema < 3 && timeout == 60000) 90000 else timeout, settings.getJSONObject("modelOptions").getInt("mainTimeout"))
            assertEquals(failover, settings.getJSONObject("modelOptions").getBoolean("failoverEnabled"))
            assertEquals("keep", settings.getString("encryptedKey"))
            assertFalse(codec.migrate(settings))
        }
        val legacy = JSONObject().put("modelOptions", JSONObject())
        assertTrue(codec.migrate(legacy)); assertFalse(legacy.getJSONObject("modelOptions").has("failoverEnabled"))
        assertEquals(90000, codec.options(legacy.getJSONObject("modelOptions")).getInt("mainTimeout"))
    }
    @Test fun embeddingAssignmentSurvivesNativePersistenceAndRemainsOptional() {
        val normalized = codec.normalize(row().put("useForEmbedding", true))
        assertTrue(normalized.getBoolean("useForEmbedding"))
        assertTrue(codec.publicRows(JSONObject().put("providers", JSONArray().put(normalized))).getJSONObject(0).getBoolean("useForEmbedding"))
        assertFalse(codec.normalize(row()).getBoolean("useForEmbedding"))
        codec.validateRows(JSONArray().put(codec.normalize(row())))
        val legacy = codec.rows(JSONObject().put("endpoint", "https://example.com/v1").put("model", "old")).getJSONObject(0)
        assertFalse(legacy.getBoolean("useForEmbedding"))
    }
    @Test fun worldSeedingAssignmentSurvivesNativePersistenceAndRemainsOptional() {
        val normalized = codec.normalize(row().put("useForWorldSeeding", true))
        assertTrue(normalized.getBoolean("useForWorldSeeding"))
        assertTrue(codec.publicRows(JSONObject().put("providers", JSONArray().put(normalized))).getJSONObject(0).getBoolean("useForWorldSeeding"))
        assertFalse(codec.normalize(row()).getBoolean("useForWorldSeeding"))
        codec.validateRows(JSONArray().put(codec.normalize(row())))
    }
    @Test fun imageCapabilityIsExplicitAndPublic() {
        assertEquals("unknown", codec.normalize(row()).getString("imageInput"))
        for (capability in listOf("unknown", "supported", "unsupported")) {
            val normalized = codec.normalize(row().put("imageInput", capability))
            assertEquals(capability, codec.publicRows(JSONObject().put("providers", JSONArray().put(normalized))).getJSONObject(0).getString("imageInput"))
        }
        assertThrows(IllegalArgumentException::class.java) { codec.normalize(row().put("imageInput", "guess")) }
    }
    @Test fun dedicatedVisionChoiceSurvivesSettingsPersistence() {
        val options = codec.options(JSONObject().put("visionEnabled", true).put("visionProviderId", "separate-eyes"))
        assertTrue(options.getBoolean("visionEnabled"))
        assertEquals("separate-eyes", options.getString("visionProviderId"))
        assertEquals("", codec.options(JSONObject()).getString("visionProviderId"))
    }
    private val codec = ModelSettingsCodec(JSONArray("""[{"id":"custom","mode":"openai-compatible","label":"自定义","protocol":"chat-completions","endpoint":""},{"id":"official","mode":"openai-official","label":"官方","protocol":"chat-completions","endpoint":"https://api.example/v1/chat/completions"}]"""))
    private fun row() = JSONObject("""{"id":"test","preset":"custom","endpoint":"https://example.com/v1","model":"model-a","enabled":true,"useForMain":true,"useForCompaction":true,"useForAlter":true}""")
    @Test fun accidentalEmptyConnectionDoesNotBlockExistingModel() {
        val blank = row().put("id", "accidental").put("endpoint", "").put("model", "")
        val saved = codec.configuredRows(JSONArray().put(row()).put(blank))
        assertEquals(1, saved.length())
        codec.validateRows(JSONArray().put(codec.normalize(saved.getJSONObject(0))))
        assertThrows(IllegalArgumentException::class.java) { codec.configuredRows(JSONArray().put(blank)) }
        assertFalse(codec.emptyDraft(JSONObject(blank.toString()).put("apiKey", "typed-secret")))
        assertFalse(codec.emptyDraft(JSONObject(blank.toString()).put("model", "unfinished")))
        assertFalse(codec.emptyDraft(blank, row().put("encryptedKey", "saved-secret")))
        assertFalse(codec.emptyDraft(JSONObject(blank.toString()).put("credentialPresent", true)))
    }
    @Test fun legacyMigrationPreservesEncryptedCredentialAndAllThreeRoles() {
        val legacy = JSONObject("""{"endpoint":"https://example.com/v1","model":"old","encryptedKey":"cipher","keyIv":"iv"}""")
        val migrated = codec.rows(legacy).getJSONObject(0)
        assertEquals("legacy-primary", migrated.getString("id")); assertEquals("cipher", migrated.getString("encryptedKey"))
        assertTrue(migrated.getBoolean("useForCompaction")); assertTrue(migrated.getBoolean("useForAlter"))
        val public = codec.publicRows(legacy).getJSONObject(0)
        assertTrue(public.getBoolean("credentialPresent")); assertFalse(public.has("encryptedKey")); assertFalse(public.has("keyIv"))
    }
    @Test fun onlyExplicitSecretFieldsArePreservedForSameOrigin() {
        val old = row().put("encryptedKey", "cipher").put("keyIv", "iv")
        val draft = row().put("model", "model-b").put("encryptedKey", "untrusted")
        val result = codec.normalize(draft); codec.preserveCredential(draft, result, old)
        assertEquals("cipher", result.getString("encryptedKey"))
        val changed = row().put("endpoint", "https://another.example/v1")
        assertThrows(IllegalArgumentException::class.java) { codec.preserveCredential(changed, codec.normalize(changed), old) }
        changed.put("clearKey", true)
        val cleared = codec.normalize(changed); codec.preserveCredential(changed, cleared, old)
        assertFalse(cleared.has("encryptedKey"))
    }
    @Test fun protocolChangesRequireNewOrExplicitlyClearedCredentials() {
        val old = row().put("encryptedKey", "cipher").put("keyIv", "iv")
        val changed = row().put("protocol", "anthropic-messages")
        assertThrows(IllegalArgumentException::class.java) { codec.preserveCredential(changed, codec.normalize(changed), old) }
        changed.put("apiKey", "new-key")
        val result = codec.normalize(changed); codec.preserveCredential(changed, result, old)
        assertFalse(result.has("encryptedKey")); assertFalse(result.has("apiKey"))
    }
    @Test fun presetCannotOverrideItsOfficialEndpointAndFetchingDoesNotRequireModel() {
        assertEquals("https://api.example/v1/chat/completions", codec.normalize(row().put("preset", "official")).getString("endpoint"))
        val blank = row().put("model", "")
        codec.normalize(blank, false)
        assertThrows(IllegalArgumentException::class.java) { codec.normalize(blank) }
    }
    @Test fun rejectDuplicateIdsMissingAssignmentsAndInvalidOptions() {
        val normalized = codec.normalize(row())
        codec.validateRows(JSONArray().put(normalized))
        assertThrows(IllegalArgumentException::class.java) { codec.validateRows(JSONArray().put(normalized).put(normalized)) }
        assertThrows(IllegalArgumentException::class.java) { codec.validateRows(JSONArray().put(normalized.put("useForAlter", false))) }
        assertThrows(IllegalArgumentException::class.java) { codec.options(JSONObject().put("mainStreamingMode", "experimental").put("mainResponseFormat", "prompt-only")) }
        assertThrows(IllegalArgumentException::class.java) { codec.options(JSONObject().put("mainTimeout", 0)) }
        assertEquals("off", codec.options(JSONObject()).getString("mainStreamingMode"))
    }
}

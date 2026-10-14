package io.hdsinterlude.android

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ModelSettingsCodecTest {
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

package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test

class ModelEndpointTest {
    @Test fun baseUrlFromReportedFailureTargetsChatCompletions() {
        assertEquals("https://cn.tokenecho.top:9443/v1/chat/completions", ModelEndpoint.resolve(" https://cn.tokenecho.top:9443/v1/ "))
    }

    @Test fun preservesCompleteAndCustomRoutes() {
        for (endpoint in listOf("https://api.deepseek.com/chat/completions", "https://example.com/v1/chat/completions", "https://example.com/api/custom-chat", "https://example.com/api/custom-chat/")) {
            assertEquals(endpoint, ModelEndpoint.resolve(endpoint))
            assertEquals(endpoint, ModelEndpoint.resolve(ModelEndpoint.resolve(endpoint)))
        }
    }

    @Test fun supportsRootAndNestedVersionedBases() {
        assertEquals("https://example.com/v1/chat/completions", ModelEndpoint.resolve("https://example.com/"))
        assertEquals("https://example.com/api/v1/chat/completions", ModelEndpoint.resolve("https://example.com/api/v1"))
        assertEquals("https://example.com/compatible-mode/v1/chat/completions", ModelEndpoint.resolve("https://example.com/compatible-mode/v1/"))
    }

    @Test fun retainsEncodedQueryForRequestButOmitsItFromDiagnostics() {
        val resolved = ModelEndpoint.resolve("https://example.com/v1?api-key=private%2Bvalue")
        assertEquals("https://example.com/v1/chat/completions?api-key=private%2Bvalue", resolved)
        assertEquals("https://example.com/v1/chat/completions", ModelEndpoint.display(resolved))
    }

    @Test fun rejectsInvalidOrCredentialBearingUrls() {
        for (endpoint in listOf("example.com/v1", "file:///tmp/api", "https://name:key@example.com/v1", "https://example.com/v1#fragment")) {
            assertThrows(IllegalArgumentException::class.java) { ModelEndpoint.resolve(endpoint) }
        }
    }
}

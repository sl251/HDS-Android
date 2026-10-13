package io.hdsinterlude.android

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ModelClientTest {
    private fun server(test: (HttpServer, String) -> Unit) {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        try { test(server, "http://127.0.0.1:${server.address.port}/v1") } finally { server.stop(0) }
    }
    @Test fun fetchModelsUsesGetAndBearerAndDeduplicatesRealResponse() = server { server, base ->
        server.createContext("/v1/models") { request ->
            val valid = request.requestMethod == "GET" && request.requestHeaders.getFirst("Authorization") == "Bearer fixture-key"
            val body = """{"data":[{"id":"z-model"},{"id":"a-model"},{"id":"a-model"},{}]}""".toByteArray()
            request.sendResponseHeaders(if (valid) 200 else 401, body.size.toLong()); request.responseBody.use { it.write(body) }
        }
        server.start()
        val result = ModelClient().list(JSONObject().put("endpoint", "$base/chat/completions").put("apiKey", "fixture-key"))
        assertEquals(listOf("a-model", "z-model"), result.getJSONArray("models").let { (0 until it.length()).map(it::getString) })
    }
    @Test fun anthropicTestUsesNativeHeadersAndContentBlocks() = server { server, base ->
        server.createContext("/v1/messages") { request ->
            val body = JSONObject(String(request.requestBody.readBytes()))
            val valid = request.requestMethod == "POST" && request.requestHeaders.getFirst("x-api-key") == "fixture-key" && request.requestHeaders.getFirst("anthropic-version") == "2023-06-01" && body.getString("model") == "fixture-model"
            val response = """{"content":[{"type":"text","text":"OK"}]}""".toByteArray()
            request.sendResponseHeaders(if (valid) 200 else 400, response.size.toLong()); request.responseBody.use { it.write(response) }
        }
        server.start()
        val result = ModelClient().test(JSONObject().put("label", "test").put("endpoint", "$base/messages").put("protocol", "anthropic-messages").put("model", "fixture-model").put("apiKey", "fixture-key"))
        assertTrue(result.getString("message").contains("连接成功"))
    }
    @Test fun listFailureDoesNotLeakCredentialOrQueryAndOffersManualEntry() = server { server, base ->
        server.createContext("/v1/models") { request -> request.sendResponseHeaders(404, -1); request.close() }
        server.start()
        val failure = assertThrows(IllegalArgumentException::class.java) { ModelClient().list(JSONObject().put("endpoint", "$base/chat/completions?key=hidden-query").put("apiKey", "secret-fixture")) }
        assertTrue(failure.message!!.contains("直接填写模型名")); assertFalse(failure.message!!.contains("hidden-query")); assertFalse(failure.message!!.contains("secret-fixture"))
    }
    @Test fun rejectsCrossOriginModelListBeforeSendingRequest() {
        assertThrows(IllegalArgumentException::class.java) { ModelEndpoint.models("https://example.com/v1/chat/completions", "https://elsewhere.example/models") }
        assertEquals("https://example.com/v1/messages", ModelEndpoint.resolve("https://example.com/v1", "anthropic-messages"))
    }
}

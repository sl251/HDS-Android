package io.hdsinterlude.android

import java.net.ServerSocket
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ModelClientTest {
    private data class Request(val firstLine: String, val headers: Map<String, String>, val body: String)
    // Android's boot classpath excludes jdk.httpserver even for JVM tests.
    private fun server(status: Int = 200, json: String = "{}", test: (String) -> Unit): Request {
        val socket = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        val executor = Executors.newSingleThreadExecutor()
        val exchange = executor.submit<Request> {
            socket.accept().use { client ->
                client.soTimeout = 5000
                val input = BufferedInputStream(client.getInputStream())
                fun line(): String {
                    val out = ByteArrayOutputStream()
                    while (true) {
                        val value = input.read()
                        require(value >= 0) { "Unexpected end of HTTP headers" }
                        if (value == 10) return out.toString("UTF-8").trimEnd('\r')
                        out.write(value)
                    }
                }
                val firstLine = line()
                val headers = mutableMapOf<String, String>()
                while (true) {
                    val value = line(); if (value.isEmpty()) break
                    headers[value.substringBefore(':').lowercase()] = value.substringAfter(':').trim()
                }
                val body = ByteArray(headers["content-length"]?.toInt() ?: 0)
                var offset = 0
                while (offset < body.size) { val count = input.read(body, offset, body.size - offset); require(count > 0); offset += count }
                val bytes = json.toByteArray(Charsets.UTF_8)
                client.getOutputStream().use { output ->
                    output.write("HTTP/1.1 $status Test\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray(Charsets.US_ASCII))
                    output.write(bytes); output.flush()
                }
                Request(firstLine, headers, String(body, Charsets.UTF_8))
            }
        }
        try { test("http://127.0.0.1:${socket.localPort}/v1"); return exchange.get(5, TimeUnit.SECONDS) }
        finally { socket.close(); exchange.cancel(true); executor.shutdownNow() }
    }
    @Test fun fetchModelsUsesGetAndBearerAndDeduplicatesRealResponse() {
        val request = server(json = """{"data":[{"id":"z-model"},{"id":"a-model"},{"id":"a-model"},{}]}""") { base ->
            val result = ModelClient().list(JSONObject().put("endpoint", "$base/chat/completions").put("apiKey", "fixture-key"))
            assertEquals(listOf("a-model", "z-model"), result.getJSONArray("models").let { (0 until it.length()).map(it::getString) })
        }
        assertEquals("GET /v1/models HTTP/1.1", request.firstLine)
        assertEquals("Bearer fixture-key", request.headers["authorization"])
    }
    @Test fun anthropicTestUsesNativeHeadersAndContentBlocks() {
        val request = server(json = """{"content":[{"type":"text","text":"OK"}]}""") { base ->
            val result = ModelClient().test(JSONObject().put("label", "test").put("endpoint", "$base/messages").put("protocol", "anthropic-messages").put("model", "fixture-model").put("apiKey", "fixture-key"))
            assertTrue(result.getString("message").contains("连接成功"))
        }
        assertEquals("POST /v1/messages HTTP/1.1", request.firstLine)
        assertEquals("fixture-key", request.headers["x-api-key"])
        assertEquals("2023-06-01", request.headers["anthropic-version"])
        assertEquals("fixture-model", JSONObject(request.body).getString("model"))
    }
    @Test fun listFailureDoesNotLeakCredentialOrQueryAndOffersManualEntry() {
        server(status = 404) { base ->
            val failure = assertThrows(IllegalArgumentException::class.java) { ModelClient().list(JSONObject().put("endpoint", "$base/chat/completions?key=hidden-query").put("apiKey", "secret-fixture")) }
            assertTrue(failure.message!!.contains("直接填写模型名")); assertFalse(failure.message!!.contains("hidden-query")); assertFalse(failure.message!!.contains("secret-fixture"))
        }
    }
    @Test fun rejectsCrossOriginModelListBeforeSendingRequest() {
        assertThrows(IllegalArgumentException::class.java) { ModelEndpoint.models("https://example.com/v1/chat/completions", "https://elsewhere.example/models") }
        assertEquals("https://example.com/v1/messages", ModelEndpoint.resolve("https://example.com/v1", "anthropic-messages"))
    }
}

package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.json.JSONObject
import java.net.ServerSocket
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class NativeRpcContractTest {
    @Test fun nativePermissionBoundaryForwardsControlledStoryApplyOverAuthenticatedLoopback() {
        val context = RuntimeEnvironment.getApplication<android.app.Application>(); File(context.noBackupFilesDir, "hds").deleteRecursively()
        val constructor = HdsRuntime::class.java.getDeclaredConstructor(android.content.Context::class.java).apply { isAccessible = true }
        val runtime = constructor.newInstance(context)
        val id = runtime.store.saveCard(JSONObject().put("name", "fixture").put("format", "v2"), "native-fixture".toByteArray()).getString("id")
        runtime.store.select(id)
        fun field(name: String, value: Any) { HdsRuntime::class.java.getDeclaredField(name).apply { isAccessible = true }.set(runtime, value) }
        val socket = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1")); val pool = Executors.newSingleThreadExecutor()
        field("port", socket.localPort); field("token", "private-native-fixture"); field("state", "healthy"); field("runningCardId", id)
        val payload = JSONObject().put("operationId", "fixture-native-apply").put("expectedStoryId", "story-fixture").put("expectedRevision", "a".repeat(64)).put("patch", JSONObject().put("world", "海边"))
        try {
            assertThrows(IllegalArgumentException::class.java) { runtime.rpc("arbitrary.execute", JSONObject()) }
            assertThrows(IllegalArgumentException::class.java) { runtime.rpc("story.applySetting", JSONObject().put("patch", JSONObject())) }
            val request = pool.submit<JSONObject> {
                socket.accept().use { client ->
                    client.soTimeout = 5000; val input = client.getInputStream().buffered()
                    fun line(): String { val out = java.io.ByteArrayOutputStream(); while (true) { val c = input.read(); require(c >= 0); if (c == 10) return out.toString("UTF-8").trimEnd('\r'); out.write(c) } }
                    assertEquals("POST /rpc HTTP/1.1", line()); var length = 0; var auth = ""
                    while (true) { val row = line(); if (row.isEmpty()) break; if (row.startsWith("Content-Length:", true)) length = row.substringAfter(':').trim().toInt(); if (row.startsWith("Authorization:", true)) auth = row.substringAfter(':').trim() }
                    assertEquals("Bearer private-native-fixture", auth)
                    val data = ByteArray(length); var offset = 0; while (offset < length) { val n = input.read(data, offset, length - offset); require(n > 0); offset += n }
                    val response = "{\"data\":{\"world\":\"海边\"}}".toByteArray()
                    client.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Length: ${response.size}\r\nConnection: close\r\n\r\n".toByteArray() + response)
                    JSONObject(String(data, Charsets.UTF_8))
                }
            }
            assertEquals("海边", runtime.rpc("story.applySetting", payload).getJSONObject("data").getString("world"))
            val body = request.get(5, TimeUnit.SECONDS); assertEquals("story.applySetting", body.getString("method")); assertEquals(canonicalJson(payload), canonicalJson(body.getJSONObject("payload")))
        } finally { socket.close(); pool.shutdownNow() }
    }
}

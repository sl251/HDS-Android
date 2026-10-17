package io.hdsinterlude.android

import android.content.Context
import org.json.JSONObject
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.RejectedExecutionException

/** Private loopback bridge keeps the TTS key and quota entirely in Android, outside PRoot. */
class VoiceBridge(context: Context, private val token: String, private val cardId: String, processor: ((JSONObject) -> JSONObject)? = null) : AutoCloseable {
    private val server = ServerSocket(0, 4, InetAddress.getByName("127.0.0.1"))
    val url = "http://127.0.0.1:${server.localPort}/synthesize"
    private val voices = VoiceStore(context)
    private val synthesize: (JSONObject) -> JSONObject = processor ?: { voices.synthesize(it) }
    private val sockets = java.util.concurrent.ConcurrentHashMap.newKeySet<Socket>()
    // No provider queue: waiting behind another 25-second request would exceed
    // the host's 30-second bridge budget. Overflow gets an immediate reason.
    private val workers = ThreadPoolExecutor(2, 2, 0, TimeUnit.MILLISECONDS, SynchronousQueue<Runnable>(), { work -> Thread(work, "hds-voice-request").apply { isDaemon = true } })
    private fun respond(socket: Socket, value: JSONObject) {
        try {
            val bytes = value.toString().toByteArray(StandardCharsets.UTF_8); val out = socket.getOutputStream()
            out.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray()); out.write(bytes); out.flush()
        } catch (_: Exception) { /* A lost receipt never repeats the provider call. */ }
        finally { sockets.remove(socket); socket.close() }
    }
    init { Thread({
        while (!server.isClosed) {
            val socket = try { server.accept() } catch (_: Exception) { break }
            sockets.add(socket)
                try {
                    socket.soTimeout = 5000; val input = socket.getInputStream()
                    fun line(): String { val out = StringBuilder(); while (out.length < 8192) { val b = input.read(); require(b >= 0); if (b == 10) return out.toString().trimEnd('\r'); out.append(b.toChar()) }; error("Header too long") }
                    require(line() == "POST /synthesize HTTP/1.1")
                    var length = -1; var auth = ""; var headers = 0
                    while (true) { val l = line(); if (l.isEmpty()) break; require(++headers <= 40)
                        if (l.startsWith("Content-Length:", true)) length = l.substringAfter(':').trim().toInt()
                        if (l.startsWith("Authorization:", true)) auth = l.substringAfter(':').trim()
                    }
                    require(java.security.MessageDigest.isEqual(auth.toByteArray(), "Bearer $token".toByteArray()) && length in 1..65536)
                    val bytes = ByteArray(length); var offset = 0
                    while (offset < length) { val n = input.read(bytes, offset, length - offset); require(n > 0); offset += n }
                    val request = JSONObject(String(bytes, StandardCharsets.UTF_8)).put("cardId", cardId).put("preview", false)
                    try { workers.execute {
                        val result = try { synthesize(request) } catch (_: Exception) { JSONObject().put("status", "failed").put("stage", "synthesis").put("reason", "invalid_request") }
                        respond(socket, result)
                    } } catch (_: RejectedExecutionException) { respond(socket, JSONObject().put("status", "skipped").put("stage", "queue").put("reason", "queue_full")) }
                } catch (_: Exception) { sockets.remove(socket); socket.close() }
        }
    }, "hds-voice").apply { isDaemon = true; start() } }
    override fun close() { server.close(); workers.shutdownNow(); sockets.forEach { try { it.close() } catch (_: Exception) {} }; sockets.clear() }
}

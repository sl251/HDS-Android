package io.hdsinterlude.android

import android.content.Context
import org.json.JSONObject
import java.net.InetAddress
import java.net.ServerSocket
import java.nio.charset.StandardCharsets

/** Private loopback bridge keeps the TTS key and quota entirely in Android, outside PRoot. */
class VoiceBridge(context: Context, private val token: String, private val cardId: String) : AutoCloseable {
    private val server = ServerSocket(0, 4, InetAddress.getByName("127.0.0.1"))
    val url = "http://127.0.0.1:${server.localPort}/synthesize"
    private val voices = VoiceStore(context)
    init { Thread({
        while (!server.isClosed) {
            val socket = try { server.accept() } catch (_: Exception) { break }
            socket.use { s ->
                try {
                    s.soTimeout = 5000; val input = s.getInputStream()
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
                    val result = voices.synthesize(request).toString().toByteArray()
                    val output = s.getOutputStream(); output.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${result.size}\r\nConnection: close\r\n\r\n".toByteArray()); output.write(result); output.flush()
                } catch (_: Exception) { /* Caller silently retains text. Never log audio, key or transcript. */ }
            }
        }
    }, "hds-voice").apply { isDaemon = true; start() } }
    override fun close() { server.close() }
}

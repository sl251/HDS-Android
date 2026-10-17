package io.hdsinterlude.android

import android.content.Context
import android.net.Uri
import android.util.Base64
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File
import java.net.ServerSocket
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class VoiceStoreTest {
    private lateinit var context: Context
    private val card = "a".repeat(64)
    private val other = "b".repeat(64)
    private var day = "2026-10-17"
    private fun store() = VoiceStore(context, { day }, { "fixture-key" })
    private fun wav() = WavAudio.pcm(ByteArray(4800), 24000, 1)
    @Before fun setup() { context = RuntimeEnvironment.getApplication(); File(context.noBackupFilesDir, "hds/voice").deleteRecursively() }
    private fun settings(enabled: Boolean = true, threshold: Double = .7, voiceId: String = "") = JSONObject().put("cardId", card).put("binding", JSONObject().put("enabled", enabled).put("threshold", threshold).put("voiceId", voiceId))
    private fun reply(w: Double = 1.0, id: String = card) = JSONObject().put("cardId", id).put("willingness", w).put("text", "最后的文字稿").put("style", "温柔自然")
    private data class Request(val headers: Map<String, String>, val body: JSONObject)
    private fun server(status: Int = 200, tokens: Long? = 25, delay: Long = 0, invalid: Boolean = false, test: (MimoTtsClient) -> Unit): Request {
        val socket = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1")); val executor = Executors.newSingleThreadExecutor()
        val task = executor.submit<Request> {
            socket.accept().use { client ->
                client.soTimeout = 5000; val input = client.getInputStream().buffered()
                fun line(): String { val out = java.io.ByteArrayOutputStream(); while (true) { val b = input.read(); require(b >= 0); if (b == 10) return out.toString("UTF-8").trimEnd('\r'); out.write(b) } }
                assertEquals("POST /v1/chat/completions HTTP/1.1", line())
                val headers = mutableMapOf<String, String>(); while (true) { val l = line(); if (l.isEmpty()) break; headers[l.substringBefore(':').lowercase()] = l.substringAfter(':').trim() }
                val body = ByteArray(headers.getValue("content-length").toInt()); var offset = 0
                while (offset < body.size) { val n = input.read(body, offset, body.size - offset); require(n > 0); offset += n }
                val result = JSONObject().put("choices", JSONArray().put(JSONObject().put("message", JSONObject().put("audio", JSONObject().put("data", Base64.encodeToString(if (invalid) "bad".toByteArray() else wav(), Base64.NO_WRAP))))))
                if (tokens != null) result.put("usage", JSONObject().put("total_tokens", tokens))
                Thread.sleep(delay)
                val bytes = result.toString().toByteArray()
                try { client.getOutputStream().write("HTTP/1.1 $status Test\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray() + bytes) } catch (_: Exception) {}
                Request(headers, JSONObject(String(body)))
            }
        }
        try { test(MimoTtsClient("http://127.0.0.1:${socket.localPort}/v1/chat/completions", if (delay > 0) 100 else 5000)); return task.get(6, TimeUnit.SECONDS) }
        finally { socket.close(); task.cancel(true); executor.shutdownNow() }
    }
    @Test fun exactTtsShapeBuiltinAndCloneAndDesignUseOnePipeline() {
        val s = store(); s.saveSettings(settings().put("cooldown", 0))
        val built = server { client -> assertTrue(s.synthesize(reply(), client).has("audioId")) }
        assertEquals("fixture-key", built.headers["api-key"]); assertFalse(built.headers.containsKey("authorization"))
        assertEquals(setOf("model", "messages", "audio"), built.body.keys().asSequence().toSet())
        assertEquals("mimo-v2.5-tts", built.body.getString("model")); assertEquals("茉莉", built.body.getJSONObject("audio").getString("voice"))
        val messages = built.body.getJSONArray("messages")
        assertEquals("user", messages.getJSONObject(0).getString("role")); assertEquals("温柔自然", messages.getJSONObject(0).getString("content"))
        assertEquals("assistant", messages.getJSONObject(1).getString("role")); assertEquals("最后的文字稿", messages.getJSONObject(1).getString("content"))
        val audio = s.putAudio(wav()); s.saveVoice(JSONObject().put("id", "ref").put("name", "参考").put("type", "reference").put("value", audio.getString("audioId")))
        s.saveSettings(settings(voiceId = "ref")); val clone = server { client -> s.synthesize(reply(), client) }
        assertTrue(clone.body.getJSONObject("audio").getString("voice").startsWith("data:audio/wav;base64,"))
        assertEquals("mimo-v2.5-tts-voiceclone", clone.body.getString("model")); assertArrayEquals(wav(), Base64.decode(clone.body.getJSONObject("audio").getString("voice").substringAfter("data:audio/wav;base64,"), Base64.DEFAULT))
        s.saveVoice(JSONObject().put("id", "design").put("name", "温暖").put("type", "design").put("value", "温暖清亮")); s.saveSettings(JSONObject().put("defaultVoiceId", "design")); s.saveSettings(settings())
        val design = server { client -> s.synthesize(reply(), client) }
        assertEquals("mimo-v2.5-tts-voicedesign", design.body.getString("model")); assertFalse(design.body.getJSONObject("audio").has("voice")); assertTrue(design.body.getJSONArray("messages").getJSONObject(0).getString("content").startsWith("音色设计（优先遵守）：温暖清亮"))
        assertEquals(75, s.state().getInt("usedTokens"))
    }
    @Test fun explicitProviderRejectionsReleaseReservationsAndReportSeparateReasons() {
        val s = store(); s.saveSettings(settings().put("cooldown", 0))
        for (status in listOf(400, 401, 403, 429)) {
            server(status = status) { client -> val r = s.synthesize(reply(), client); assertEquals("failed", r.getString("status")); assertEquals("provider_http_$status", r.getString("reason")) }
            assertEquals(0L, s.state().getLong("usedTokens")); assertEquals(0L, s.state().getLong("unknownTokens"))
        }
    }
    @Test fun replayUsesPersistedRequestReceiptAndDoesNotChargeAgain() {
        val s = store(); s.saveSettings(settings().put("cooldown", 0))
        val input = reply().put("requestId", "fixture-repeated-request")
        var id = ""; server { client -> id = s.synthesize(input, client).getString("audioId") }
        assertEquals(id, store().synthesize(input).getString("audioId")); assertEquals(25L, s.state().getLong("usedTokens"))
        val reordered = JSONObject(); input.keys().asSequence().toList().reversed().forEach { reordered.put(it, input.get(it)) }
        assertEquals(id, store().synthesize(reordered).getString("audioId")); assertEquals(25L, s.state().getLong("usedTokens"))
        assertThrows(IllegalArgumentException::class.java) { s.synthesize(reply().put("requestId", "fixture-repeated-request").put("text", "other")) }
    }
    @Test fun thresholdCooldownDisabledAndPerCharacterArePersistent() {
        val s = store(); assertFalse(s.config().getJSONObject("characters").has(card)); assertFalse(s.synthesize(reply()).has("audioId"))
        s.saveSettings(settings()); assertFalse(s.synthesize(reply(.699)).has("audioId"))
        server { client -> assertTrue(s.synthesize(reply(.7), client).has("audioId")) }
        repeat(4) { assertFalse(store().synthesize(reply()).has("audioId")) }
        server { client -> assertTrue(store().synthesize(reply(), client).has("audioId")) }
        s.saveSettings(settings().put("cardId", other)); server { client -> assertTrue(s.synthesize(reply(id = other), client).has("audioId")) }
        s.saveSettings(settings(enabled = false).put("cooldown", 0)); assertFalse(s.synthesize(reply()).has("audioId"))
        s.saveSettings(settings().put("cooldown", 0)); server { client -> assertTrue(s.synthesize(reply(), client).has("audioId")) }
        assertFalse(s.synthesize(reply(1.1)).has("audioId"))
    }
    @Test fun quotaCountsPreviewsStopsBothPathsNotifiesOnceAndRollsOverWithoutDeleting() {
        val s = store(); s.saveSettings(settings().put("cooldown", 0).put("dailyLimit", 50))
        var id = ""; server { client -> id = s.synthesize(reply(), client).getString("audioId") }
        server { client -> assertTrue(s.synthesize(JSONObject().put("preview", true).put("voiceId", "builtin").put("text", "试听"), client).has("audioId")) }
        assertFalse(s.synthesize(reply()).has("audioId")); assertFalse(s.synthesize(reply().put("preview", true)).has("audioId"))
        assertTrue(s.state().has("notice")); assertFalse(store().state().has("notice")); assertEquals(50, s.state().getInt("usedTokens"))
        day = "2026-10-18"; assertEquals(0, store().state().getInt("usedTokens")); assertTrue(s.audio(id).getString("dataUri").startsWith("data:audio/wav;base64,"))
        s.saveSettings(JSONObject().put("dailyLimit", 0)); server(tokens = 100000) { client -> assertTrue(s.synthesize(reply(), client).has("audioId")) }; assertFalse(s.state().has("notice"))
    }
    @Test fun failuresAndTimeoutFallBackChargeConservativelyAndNeverProduceAnAudioId() {
        val s = store(); s.saveSettings(settings().put("cooldown", 0).put("dailyLimit", 0))
        server(status = 503) { client -> assertFalse(s.synthesize(reply(), client).has("audioId")) }
        assertEquals(4096, s.state().getInt("usedTokens"))
        server(delay = 250) { client -> assertFalse(s.synthesize(reply(), client).has("audioId")) }
        assertEquals(8192, s.state().getInt("usedTokens"))
        server(invalid = true) { client -> assertFalse(s.synthesize(reply(), client).has("audioId")) }; assertEquals(8217, s.state().getInt("usedTokens"))
        server(tokens = null) { client -> assertTrue(s.synthesize(reply(), client).has("audioId")) }; assertEquals(12313, s.state().getInt("usedTokens"))
    }
    @Test fun safImportRenameDeleteAndHistoricalStorageRejectTraversalAndInvalidWav() {
        val s = store(); val file = File(context.cacheDir, "reference.wav").apply { writeBytes(wav()) }
        val result = s.import(Uri.fromFile(file)); val id = result.getString("audioId")
        assertEquals(.1, result.getDouble("duration"), .0001); assertEquals(id, s.putAudio(wav()).getString("audioId"))
        assertThrows(IllegalArgumentException::class.java) { s.audio("../../private") }
        val outside = File(context.cacheDir, "private-audio.wav").apply { writeBytes(wav()) }
        java.nio.file.Files.createSymbolicLink(File(s.base, "c".repeat(64) + ".wav").toPath(), outside.toPath())
        assertThrows(IllegalArgumentException::class.java) { s.audio("c".repeat(64)) }
        assertThrows(IllegalArgumentException::class.java) { s.putAudio("bad".toByteArray()) }
        s.saveVoice(JSONObject().put("id", "ref").put("name", "原名").put("type", "reference").put("value", id)); s.saveVoice(JSONObject().put("id", "ref").put("name", "新名"))
        s.saveSettings(settings(voiceId = "ref").put("defaultVoiceId", "ref")); s.deleteVoice("ref")
        assertEquals("builtin", s.config().getString("defaultVoiceId")); assertEquals("", s.config().getJSONObject("characters").getJSONObject(card).getString("voiceId"))
        assertArrayEquals(wav(), Base64.decode(store().audio(id).getString("dataUri").substringAfter(','), Base64.DEFAULT))
        assertThrows(IllegalArgumentException::class.java) { s.saveSettings(JSONObject().put("cooldown", -1)) }
    }
    @Test fun recorderUsesMicrophoneAndCancelsTemporaryFileWithoutSavingInvalidAudio() {
        val recorder = VoiceRecorder(context); recorder.start()
        assertTrue(context.cacheDir.listFiles()!!.any { it.name.startsWith("voice-record-") })
        recorder.cancel(); assertFalse(context.cacheDir.listFiles()!!.any { it.name.startsWith("voice-record-") })
        recorder.start(); assertThrows(Exception::class.java) { recorder.stop() }
        assertFalse(context.cacheDir.listFiles()!!.any { it.name.startsWith("voice-record-") })
    }
    @Test fun successfulRecordingIsSavedAndReusableAsCloneReference() {
        val recorder = VoiceRecorder(context); recorder.start()
        // MediaRecorder is a Robolectric shadow; supply captured bytes at its actual output path.
        val output = context.cacheDir.listFiles()!!.single { it.name.startsWith("voice-record-") }
        output.writeBytes(wav())
        val result = recorder.stop(); assertArrayEquals(wav(), store().audioFile(result.getString("audioId")).readBytes())
        assertFalse(output.exists()); assertThrows(IllegalArgumentException::class.java) { recorder.stop() }
    }
    @Test @Config(shadows = [Mp3Extractor::class]) fun mp3ImportDecodesToPcmWavBeforeCloneStorage() {
        org.robolectric.shadows.ShadowMediaCodec.addDecoder("audio/mpeg", org.robolectric.shadows.ShadowMediaCodec.CodecConfig(4096, 8192) { input, output ->
            if (input.hasRemaining()) { input.position(input.limit()); output.put(ByteArray(4800)) }
        })
        val file = File(context.cacheDir, "import.mp3").apply { writeBytes("ID3-compressed-fixture".toByteArray()) }
        val result = store().import(Uri.fromFile(file))
        assertEquals(.1, result.getDouble("duration"), .0001)
        assertArrayEquals(wav(), store().audioFile(result.getString("audioId")).readBytes())
        assertFalse(context.cacheDir.listFiles()!!.any { it.name.startsWith("voice-decode-") })
    }
    @org.robolectric.annotation.Implements(android.media.MediaExtractor::class)
    class Mp3Extractor : org.robolectric.shadows.ShadowMediaExtractor() {
        @org.robolectric.annotation.Implementation override fun setDataSource(path: String) {
            val format = android.media.MediaFormat.createAudioFormat("audio/mpeg", 24000, 1)
            org.robolectric.shadows.ShadowMediaExtractor.addTrack(org.robolectric.shadows.util.DataSource.toDataSource(path), format, "mp3-frame".toByteArray())
            super.setDataSource(path)
        }
    }

    @Test fun simultaneousPreviewAndReplyCannotRacePastDailyLimit() {
        val s = store(); s.saveSettings(settings().put("cooldown", 0).put("dailyLimit", 25))
        server { client ->
            val pool = Executors.newFixedThreadPool(2)
            try {
                val a = pool.submit<JSONObject> { s.synthesize(reply(), client) }
                val b = pool.submit<JSONObject> { store().synthesize(reply().put("preview", true), client) }
                val results = listOf(a.get(6, TimeUnit.SECONDS), b.get(6, TimeUnit.SECONDS))
                assertEquals(1, results.count { it.has("audioId") }); assertEquals(25, s.state().getInt("usedTokens"))
            } finally { pool.shutdownNow() }
        }
    }
    @Test fun nativeLoopbackBridgeAuthenticatesAndPinsCharacterInsteadOfTrustingRequest() {
        VoiceBridge(context, "private-fixture", card).use { bridge ->
            val connection = java.net.URL(bridge.url).openConnection() as java.net.HttpURLConnection
            try {
                connection.requestMethod = "POST"; connection.doOutput = true; connection.readTimeout = 5000
                connection.setRequestProperty("Authorization", "Bearer private-fixture")
                connection.outputStream.use { it.write(reply(id = other).toString().toByteArray()) }
                assertEquals(200, connection.responseCode); assertEquals("disabled", JSONObject(connection.inputStream.bufferedReader().use { it.readText() }).getString("reason"))
            } finally { connection.disconnect() }
            val counts = JSONObject(File(store().base, "usage.json").readText()).getJSONObject("characters")
            assertTrue(counts.has(card)); assertFalse(counts.has(other))
            val rejected = java.net.URL(bridge.url).openConnection() as java.net.HttpURLConnection
            try {
                rejected.requestMethod = "POST"; rejected.doOutput = true; rejected.readTimeout = 1000
                rejected.setRequestProperty("Authorization", "Bearer invalid")
                rejected.outputStream.use { it.write(reply().toString().toByteArray()) }
                assertThrows(java.io.IOException::class.java) { rejected.inputStream.use { it.read() } }
            } finally { rejected.disconnect() }
        }
    }

}

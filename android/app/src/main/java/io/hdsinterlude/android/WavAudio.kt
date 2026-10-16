package io.hdsinterlude.android

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

object WavAudio {
    fun duration(bytes: ByteArray): Double {
        require(bytes.size in 44..VoiceStore.MAX_AUDIO && String(bytes, 0, 4) == "RIFF" && String(bytes, 8, 4) == "WAVE") { "无法解码 WAV 音频" }
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        var offset = 12; var rate = 0; var data = 0; var pcm = false
        while (offset + 8 <= bytes.size) {
            val size = buffer.getInt(offset + 4); require(size >= 0 && size <= bytes.size - offset - 8) { "WAV 数据不完整" }
            when (String(bytes, offset, 4)) {
                "fmt " -> { require(size >= 16); pcm = buffer.getShort(offset + 8).toInt() == 1; rate = buffer.getInt(offset + 16); require(buffer.getShort(offset + 22).toInt() == 16) { "请使用 16-bit PCM WAV" } }
                "data" -> data += size
            }
            offset += 8 + size + size % 2
        }
        require(pcm && rate > 0 && data > 0) { "请使用 PCM WAV 音频" }
        return data.toDouble() / rate
    }
    fun pcm(data: ByteArray, rate: Int, channels: Int): ByteArray {
        val b = ByteBuffer.allocate(44 + data.size).order(ByteOrder.LITTLE_ENDIAN)
        b.put("RIFF".toByteArray()).putInt(36 + data.size).put("WAVEfmt ".toByteArray()).putInt(16).putShort(1).putShort(channels.toShort())
        b.putInt(rate).putInt(rate * channels * 2).putShort((channels * 2).toShort()).putShort(16).put("data".toByteArray()).putInt(data.size).put(data)
        return b.array()
    }
    /** MP3 / recorded AAC is decoded locally; clone always receives a WAV reference. */
    fun normalize(context: Context, bytes: ByteArray): ByteArray {
        if (bytes.size >= 12 && String(bytes, 0, 4) == "RIFF") { duration(bytes); return bytes }
        val file = File.createTempFile("voice-decode-", ".audio", context.cacheDir)
        val extractor = MediaExtractor(); var codec: MediaCodec? = null
        try {
            file.writeBytes(bytes); extractor.setDataSource(file.absolutePath)
            val track = (0 until extractor.trackCount).firstOrNull { extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true } ?: throw IllegalArgumentException("请选择 wav 或 mp3 音频")
            extractor.selectTrack(track); val format = extractor.getTrackFormat(track)
            val decoder = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!); codec = decoder
            decoder.configure(format, null, null, 0); decoder.start()
            val out = ByteArrayOutputStream(); val info = MediaCodec.BufferInfo(); var ended = false
            var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE); var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            val deadline = System.nanoTime() + 30_000_000_000L
            while (true) {
                require(System.nanoTime() < deadline) { "音频解码超时" }
                if (!ended) {
                    val index = decoder.dequeueInputBuffer(10000)
                    if (index >= 0) {
                        val n = extractor.readSampleData(decoder.getInputBuffer(index)!!, 0)
                        if (n < 0) { decoder.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); ended = true }
                        else { decoder.queueInputBuffer(index, 0, n, extractor.sampleTime, 0); extractor.advance() }
                    }
                }
                val index = decoder.dequeueOutputBuffer(info, 10000)
                if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    val f = decoder.outputFormat; rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE); channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                    require(!f.containsKey(MediaFormat.KEY_PCM_ENCODING) || f.getInteger(MediaFormat.KEY_PCM_ENCODING) == android.media.AudioFormat.ENCODING_PCM_16BIT) { "不支持此 PCM 编码" }
                }
                if (index >= 0) {
                    val b = decoder.getOutputBuffer(index)!!; b.position(info.offset); b.limit(info.offset + info.size)
                    require(out.size() + info.size <= VoiceStore.MAX_AUDIO - 44 && out.size() + info.size <= rate * channels * 2 * 180) { "参考音频过长" }
                    val chunk = ByteArray(info.size); b.get(chunk); out.write(chunk); decoder.releaseOutputBuffer(index, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                }
            }
            return pcm(out.toByteArray(), rate, channels).also { duration(it) }
        } finally { try { codec?.stop() } catch (_: Exception) {}; codec?.release(); extractor.release(); file.delete() }
    }
}

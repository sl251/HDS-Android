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
    private data class Wave(val encoding: Int, val channels: Int, val rate: Int, val bits: Int, val data: ByteArray)
    private fun wave(bytes: ByteArray): Wave {
        require(bytes.size in 44..64 * 1024 * 1024 && String(bytes, 0, 4) == "RIFF" && String(bytes, 8, 4) == "WAVE") { "无法解码 WAV 音频" }
        val b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        require(b.getInt(4).toLong() + 8 == bytes.size.toLong()) { "WAV 文件损坏或被截断" }
        var offset = 12; var encoding = 0; var channels = 0; var rate = 0; var bits = 0; var data: ByteArray? = null
        while (offset + 8 <= bytes.size) {
            val size = b.getInt(offset + 4); require(size >= 0 && size <= bytes.size - offset - 8) { "WAV 数据不完整" }
            when (String(bytes, offset, 4)) {
                "fmt " -> {
                    require(encoding == 0 && size >= 16) { "WAV 格式块无效" }
                    encoding = b.getShort(offset + 8).toInt() and 65535; channels = b.getShort(offset + 10).toInt() and 65535
                    rate = b.getInt(offset + 12); bits = b.getShort(offset + 22).toInt() and 65535
                    if (encoding == 65534) {
                        require(size >= 40 && b.getShort(offset + 24).toInt() >= 22) { "Extensible WAV 格式块不完整" }
                        val validBits = b.getShort(offset + 26).toInt()
                        require(validBits == 0 || validBits == bits) { "暂不支持有效位深不同的 WAV" }
                        val suffix = byteArrayOf(0, 0, 0, 0, 16, 0, -128, 0, 0, -86, 0, 56, -101, 113)
                        require(bytes.copyOfRange(offset + 34, offset + 48).contentEquals(suffix)) { "不支持此 WAV 子格式" }
                        encoding = b.getShort(offset + 32).toInt()
                    }
                    require(channels in 1..8 && rate in 8000..192000 && (encoding == 1 && bits in listOf(16, 24, 32) || encoding == 3 && bits == 32)) { "支持 PCM 16/24/32-bit 或 float32 WAV" }
                    require(b.getShort(offset + 20).toInt() == channels * bits / 8 && b.getInt(offset + 16) == rate * channels * bits / 8) { "WAV 采样信息不一致" }
                }
                "data" -> { require(data == null); data = bytes.copyOfRange(offset + 8, offset + 8 + size) }
            }
            offset += 8 + size + size % 2
        }
        val pcm = data ?: throw IllegalArgumentException("WAV 缺少音频数据")
        require(encoding != 0 && pcm.isNotEmpty() && pcm.size % (channels * bits / 8) == 0) { "WAV 采样数据无效" }
        require(pcm.size.toDouble() / (rate * channels * bits / 8) <= 180) { "参考音频超过 180 秒，请先裁剪后重新导入" }
        return Wave(encoding, channels, rate, bits, pcm)
    }
    fun duration(bytes: ByteArray): Double {
        val w = wave(bytes); require(w.encoding == 1 && w.bits == 16) { "请使用规范化 PCM16 WAV" }
        return w.data.size.toDouble() / (w.rate * w.channels * 2)
    }
    fun normalizeWav(bytes: ByteArray): ByteArray {
        val w = wave(bytes); val b = ByteBuffer.wrap(w.data).order(ByteOrder.LITTLE_ENDIAN)
        val frames = w.data.size / (w.channels * w.bits / 8)
        val mono = FloatArray(frames)
        for (frame in 0 until frames) {
            var sum = 0.0
            repeat(w.channels) {
                val v = if (w.encoding == 3) b.float.toDouble().also { require(it.isFinite()) { "WAV 包含无效浮点采样" } }
                    else when (w.bits) { 16 -> b.short / 32768.0; 24 -> { val lo = b.get().toInt() and 255; val mid = b.get().toInt() and 255; val hi = b.get().toInt(); (lo or (mid shl 8) or (hi shl 16)) / 8388608.0 }; else -> b.int / 2147483648.0 }
                sum += v.coerceIn(-1.0, 1.0)
            }
            mono[frame] = (sum / w.channels).toFloat()
        }
        val length = maxOf(1, (frames.toLong() * 24000 / w.rate).toInt())
        val out = ByteBuffer.allocate(length * 2).order(ByteOrder.LITTLE_ENDIAN)
        for (i in 0 until length) {
            val position = i.toDouble() * w.rate / 24000; val left = position.toInt().coerceAtMost(frames - 1); val right = minOf(left + 1, frames - 1)
            val value = mono[left] + (mono[right] - mono[left]) * (position - left)
            out.putShort(kotlin.math.round(value * 32768).toInt().coerceIn(-32768, 32767).toShort())
        }
        return pcm(out.array(), 24000, 1)
    }
    fun pcm(data: ByteArray, rate: Int, channels: Int): ByteArray {
        val b = ByteBuffer.allocate(44 + data.size).order(ByteOrder.LITTLE_ENDIAN)
        b.put("RIFF".toByteArray()).putInt(36 + data.size).put("WAVEfmt ".toByteArray()).putInt(16).putShort(1).putShort(channels.toShort())
        b.putInt(rate).putInt(rate * channels * 2).putShort((channels * 2).toShort()).putShort(16).put("data".toByteArray()).putInt(data.size).put(data)
        return b.array()
    }
    /** MP3 / recorded AAC is decoded locally; clone always receives a WAV reference. */
    fun normalize(context: Context, bytes: ByteArray): ByteArray {
        if (bytes.size >= 12 && String(bytes, 0, 4) == "RIFF") return normalizeWav(bytes)
        val file = File.createTempFile("voice-decode-", ".audio", context.cacheDir)
        val extractor = MediaExtractor(); var codec: MediaCodec? = null
        try {
            file.writeBytes(bytes); extractor.setDataSource(file.absolutePath)
            val track = (0 until extractor.trackCount).firstOrNull { extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME) in listOf("audio/mpeg", "audio/mp4a-latm") } ?: throw IllegalArgumentException("支持 WAV、MP3、M4A/AAC；无法识别或不支持此格式")
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
                    require(rate in 8000..192000 && channels in 1..8 && out.size().toLong() + info.size <= 64L * 1024 * 1024 && out.size().toLong() + info.size <= rate.toLong() * channels * 2 * 180) { "参考音频解码超过 64 MiB 或 180 秒，请先裁剪后重新导入" }
                    val chunk = ByteArray(info.size); b.get(chunk); out.write(chunk); decoder.releaseOutputBuffer(index, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
                }
            }
            return normalizeWav(pcm(out.toByteArray(), rate, channels))
        } finally { try { codec?.stop() } catch (_: Exception) {}; codec?.release(); extractor.release(); file.delete() }
    }
}

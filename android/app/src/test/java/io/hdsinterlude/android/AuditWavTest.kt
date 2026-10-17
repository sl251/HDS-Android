package io.hdsinterlude.android

import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.*
import org.junit.Test

class AuditWavTest {
    private fun input(bits: Int, encoding: Int, channels: Int = 2, rate: Int = 48000): ByteArray {
        val size = rate / 10 * channels * bits / 8
        val b = ByteBuffer.allocate(44 + size).order(ByteOrder.LITTLE_ENDIAN)
        b.put("RIFF".toByteArray()).putInt(36 + size).put("WAVEfmt ".toByteArray()).putInt(16)
            .putShort(encoding.toShort()).putShort(channels.toShort()).putInt(rate).putInt(rate * channels * bits / 8)
            .putShort((channels * bits / 8).toShort()).putShort(bits.toShort()).put("data".toByteArray()).putInt(size)
        repeat(size / (bits / 8)) { when { encoding == 3 -> b.putFloat(.25f); bits == 24 -> b.put(byteArrayOf(0, 0, 32)); bits == 16 -> b.putShort(8192); else -> b.putInt(536870912) } }
        return b.array()
    }
    @Test fun normalizesSupportedIntegerAndFloatWavesTo24kMonoPcm16() {
        for ((bits, encoding) in listOf(16 to 1, 24 to 1, 32 to 1, 32 to 3)) {
            val wav = WavAudio.normalizeWav(input(bits, encoding)); val b = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN)
            assertEquals(4844, wav.size); assertEquals(24000, b.getInt(24)); assertEquals(1, b.getShort(22).toInt()); assertEquals(8192, b.getShort(44).toInt())
            assertEquals(.1, WavAudio.duration(wav), .000001)
        }
    }
    @Test fun recognizesExtensibleAndAdditionalChunksButRejectsTruncationAndDishonestHeaders() {
        val original = input(24, 1)
        val ext = ByteBuffer.allocate(original.size + 24).order(ByteOrder.LITTLE_ENDIAN)
        ext.put(original, 0, 36); ext.putInt(16, 40); ext.putShort(20, 65534.toShort())
        ext.putShort(22).putShort(24).putInt(3).putInt(1).putShort(0).putShort(16)
            .put(byteArrayOf(-128, 0, 0, -86, 0, 56, -101, 113)).put(original, 36, original.size - 36)
        ext.putInt(4, ext.capacity() - 8)
        assertEquals(.1, WavAudio.duration(WavAudio.normalizeWav(ext.array())), .000001)
        val chunked = original.copyOfRange(0, 36) + "JUNK".toByteArray() + byteArrayOf(2, 0, 0, 0, 0, 0) + original.copyOfRange(36, original.size)
        ByteBuffer.wrap(chunked).order(ByteOrder.LITTLE_ENDIAN).putInt(4, chunked.size - 8)
        assertEquals(.1, WavAudio.duration(WavAudio.normalizeWav(chunked)), .000001)
        for (bad in listOf(original.copyOf(original.size - 1), original.clone().also { it[32] = 1 }, input(16, 1).also { it[34] = 8 })) assertThrows(IllegalArgumentException::class.java) { WavAudio.normalizeWav(bad) }
    }
    @Test fun overlongInputIsRejectedUnlessTheUserExplicitlyChoseAPrefixClip() {
        val long = WavAudio.pcm(ByteArray(24000 * 2 * 181), 24000, 1)
        assertThrows(IllegalArgumentException::class.java) { WavAudio.normalizeWav(long) }
        assertEquals(30.0, WavAudio.duration(WavAudio.normalizeWav(long, 30)), .000001)
        assertThrows(IllegalArgumentException::class.java) { WavAudio.normalizeWav(long, 0) }
    }
}

package io.hdsinterlude.android

import android.content.Context
import android.media.MediaRecorder
import java.io.File

@Suppress("DEPRECATION")
class VoiceRecorder(private val context: Context) {
    private var recorder: MediaRecorder? = null
    private var recording: File? = null
    @Synchronized fun start() {
        require(recorder == null) { "已在录音" }
        val file = File.createTempFile("voice-record-", ".m4a", context.cacheDir)
        val r = MediaRecorder()
        try {
            r.setAudioSource(MediaRecorder.AudioSource.MIC); r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4); r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setAudioSamplingRate(24000); r.setAudioChannels(1); r.setAudioEncodingBitRate(96000)
            r.setMaxDuration(60000); r.setMaxFileSize(VoiceStore.MAX_AUDIO.toLong()); r.setOutputFile(file.absolutePath)
            r.prepare(); r.start(); recorder = r; recording = file
        } catch (e: Exception) { r.release(); file.delete(); throw e }
    }
    @Synchronized fun stop(): org.json.JSONObject {
        val r = recorder ?: throw IllegalArgumentException("尚未开始录音"); val file = recording!!
        recorder = null; recording = null
        try { r.stop(); return VoiceStore(context).putAudio(WavAudio.normalize(context, file.readBytes())) }
        finally { r.release(); file.delete() }
    }
    @Synchronized fun cancel() { try { recorder?.stop() } catch (_: Exception) {}; recorder?.release(); recorder = null; recording?.delete(); recording = null }
}

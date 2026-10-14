package io.hdsinterlude.android

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Typeface
import android.net.Uri
import android.util.AtomicFile
import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File

class AppearanceStore(private val context: Context) {
    private val root = File(context.noBackupFilesDir, "hds/appearance").apply { mkdirs() }
    private val settings = File(root, "settings.json")
    private fun defaults() = JSONObject().put("font", "default").put("fontSize", 14).put("backgroundOpacity", 35).put("panelOpacity", 92).put("backgroundBlur", 0).put("theme", "system")
    fun read(): JSONObject {
        val result = if (settings.exists()) JSONObject(AtomicFile(settings).openRead().bufferedReader().use { it.readText() }) else defaults()
        File(root, "background.jpg").takeIf { it.exists() }?.let { result.put("backgroundData", "data:image/jpeg;base64," + Base64.encodeToString(it.readBytes(), Base64.NO_WRAP)) }
        File(root, "font.bin").takeIf { it.exists() }?.let { result.put("fontData", "data:font/ttf;base64," + Base64.encodeToString(it.readBytes(), Base64.NO_WRAP)) }
        return result
    }
    private fun atomic(file: File, bytes: ByteArray) {
        val target = AtomicFile(file); val stream = target.startWrite()
        try { stream.write(bytes); target.finishWrite(stream) } catch (error: Throwable) { target.failWrite(stream); throw error }
    }
    fun save(input: JSONObject) {
        val next = defaults()
        for ((name, bounds) in listOf("fontSize" to 12..24, "backgroundOpacity" to 0..100, "panelOpacity" to 0..100, "backgroundBlur" to 0..20)) {
            val value = input.optInt(name, next.getInt(name)); require(value in bounds) { "界面参数超出范围：$name" }; next.put(name, value)
        }
        val font = input.optString("font", "default"); require(font in listOf("default", "sans", "serif", "custom")) { "字体选项无效" }
        require(font != "custom" || File(root, "font.bin").exists()) { "请先导入字体文件" }
        val theme = input.optString("theme", "system"); require(theme in listOf("system", "light", "dark")) { "主题选项无效" }
        next.put("font", font).put("theme", theme).put("fontName", input.optString("fontName", "自定义字体").take(128))
        atomic(settings, next.toString().toByteArray())
        if (input.optBoolean("removeBackground")) { File(root, "background.jpg").delete() }
        if (input.optBoolean("removeFont")) { File(root, "font.bin").delete() }
    }
    fun import(kind: String, uri: Uri): JSONObject {
        val bytes = bounded(uri, if (kind == "font") 16 * 1024 * 1024 else 32 * 1024 * 1024)
        val previous = read()
        if (kind == "font") {
            require(bytes.size >= 12 && (bytes.copyOfRange(0, 4).contentEquals(byteArrayOf(0, 1, 0, 0)) || String(bytes.copyOfRange(0, 4), Charsets.US_ASCII) == "OTTO")) { "请使用有效的 TTF 或 OTF 字体" }
            val temporary = File(root, "font-import.tmp")
            try { temporary.writeBytes(bytes); Typeface.createFromFile(temporary); atomic(File(root, "font.bin"), bytes) } finally { temporary.delete() }
            previous.put("font", "custom").put("fontName", "本地导入字体")
        } else { require(kind == "background"); atomic(File(root, "background.jpg"), jpeg(bytes, 2048, 1500000)) }
        save(previous)
        return read()
    }
    fun image(uri: Uri): String = "data:image/jpeg;base64," + Base64.encodeToString(jpeg(bounded(uri, 32 * 1024 * 1024), 1024, 480000), Base64.NO_WRAP)
    private fun bounded(uri: Uri, limit: Int): ByteArray {
        val output = ByteArrayOutputStream()
        context.contentResolver.openInputStream(uri)?.use { input ->
            val block = ByteArray(65536)
            while (true) { val count = input.read(block); if (count < 0) break; require(output.size() + count <= limit) { "文件过大" }; output.write(block, 0, count) }
        } ?: throw IllegalArgumentException("无法读取所选文件")
        return output.toByteArray()
    }
    private fun jpeg(bytes: ByteArray, edge: Int, limit: Int): ByteArray {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "无法解码图片，请选择 JPEG、PNG 或 WebP" }
        val options = BitmapFactory.Options(); while (maxOf(bounds.outWidth, bounds.outHeight) / options.inSampleSize > edge * 2) options.inSampleSize *= 2
        val original = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) ?: throw IllegalArgumentException("图片解码失败")
        val ratio = minOf(1.0, edge.toDouble() / maxOf(original.width, original.height))
        val resized = Bitmap.createScaledBitmap(original, maxOf(1, (original.width * ratio).toInt()), maxOf(1, (original.height * ratio).toInt()), true)
        val orientation = try { android.media.ExifInterface(java.io.ByteArrayInputStream(bytes)).getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, 1) } catch (_: Exception) { 1 }
        val matrix = android.graphics.Matrix()
        when (orientation) {
            2 -> matrix.setScale(-1f, 1f)
            3 -> matrix.setRotate(180f)
            4 -> matrix.setScale(1f, -1f)
            5 -> { matrix.setRotate(90f); matrix.postScale(-1f, 1f) }
            6 -> matrix.setRotate(90f)
            7 -> { matrix.setRotate(-90f); matrix.postScale(-1f, 1f) }
            8 -> matrix.setRotate(-90f)
        }
        val scaled = if (orientation in 2..8) Bitmap.createBitmap(resized, 0, 0, resized.width, resized.height, matrix, true) else resized
        try {
            var quality = 88; var result: ByteArray
            do { val output = ByteArrayOutputStream(); require(scaled.compress(Bitmap.CompressFormat.JPEG, quality, output)); result = output.toByteArray(); quality -= 10 } while (result.size > limit && quality >= 18)
            require(result.size <= limit) { "图片压缩后仍过大，请选择较小图片" }; return result
        } finally { if (scaled !== resized) scaled.recycle(); if (resized !== original) resized.recycle(); original.recycle() }
    }
}

package io.hdsinterlude.android

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.file.Files
import java.security.MessageDigest

class VoiceStorage(context: Context) {
    private val voice = VoiceStore(context)
    private val root = voice.base.parentFile!!
    private fun snapshot(): Pair<JSONObject, List<File>> {
        val keep = hashSetOf<String>(); var complete = true
        val rows = voice.config().getJSONArray("voices")
        for (i in 0 until rows.length()) rows.getJSONObject(i).let { if (it.optString("type") == "reference") keep.add(it.optString("value")) }
        File(root, "profiles").listFiles()?.filter { it.isDirectory && File(it, "hds.sqlite").isFile }?.forEach { profile ->
            try {
                val index = File(profile, "voice-references.json"); require(index.isFile && index.length() <= 4 * 1024 * 1024)
                val refs = JSONArray(index.readText()); for (i in 0 until refs.length()) keep.add(refs.getString(i))
            } catch (_: Exception) { complete = false }
        }
        // Local rollback snapshots also own their history. Missing legacy indexes
        // make pruning conservative until those backups are migrated/removed.
        File(root, "story-backups").walkTopDown().filter { it.name == "hds.sqlite" && it.isFile }.forEach { db ->
            try { val refs = JSONArray(File(db.parentFile, "voice-references.json").readText()); for (i in 0 until refs.length()) keep.add(refs.getString(i)) } catch (_: Exception) { complete = false }
        }
        val files = voice.base.listFiles()?.filter { it.name.matches(Regex("[a-f0-9]{64}\\.wav")) && it.isFile && !Files.isSymbolicLink(it.toPath()) }.orEmpty().sortedBy { it.name }
        val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
        val orphans = if (complete) files.filter { it.nameWithoutExtension !in keep && it.lastModified() < cutoff } else emptyList()
        val signature = canonicalJson(JSONObject().put("files", JSONArray(files.map { "${it.name}:${it.length()}:${it.lastModified()}" })).put("keep", JSONArray(keep.sorted())).put("orphans", JSONArray(orphans.map { it.name })).put("complete", complete))
        val previewId = MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).joinToString("") { "%02x".format(it) }
        return JSONObject().put("previewId", previewId).put("bytes", files.sumOf { it.length() }).put("files", files.size)
            .put("orphanBytes", orphans.sumOf { it.length() }).put("orphanFiles", orphans.size).put("referencesComplete", complete) to orphans
    }
    fun preview(): JSONObject = synchronized(VoiceStore.lock) { snapshot().first }
    fun prune(input: JSONObject): JSONObject = synchronized(VoiceStore.lock) {
        require(input.optBoolean("confirm")) { "请先确认清理预览" }
        val (state, orphans) = snapshot(); require(state.getString("previewId") == input.optString("previewId")) { "存储内容已改变，请重新预览" }
        for (file in orphans) { require(file.canonicalFile == File(voice.base.canonicalFile, file.name)); require(file.delete()) { "部分文件未能删除，请重新预览" } }
        snapshot().first
    }
}

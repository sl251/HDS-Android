package io.hdsinterlude.android

import android.database.sqlite.SQLiteDatabase
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Rebuild after the host has stopped. The selected profile's DB is authoritative,
 * so backups of pre-index versions still include historical voice references. */
object VoiceReferences {
    fun rebuild(profile: File) {
        val ids = linkedSetOf<String>()
        SQLiteDatabase.openDatabase(File(profile, "hds.sqlite").absolutePath, null, SQLiteDatabase.OPEN_READONLY).use { db ->
            var hasAudio = false
            db.rawQuery("PRAGMA table_info(mobile_message)", null).use { cursor -> while (cursor.moveToNext()) if (cursor.getString(cursor.getColumnIndexOrThrow("name")) == "audio") hasAudio = true }
            if (hasAudio) db.rawQuery("SELECT audio FROM mobile_message WHERE audio IS NOT NULL", null).use { cursor ->
                while (cursor.moveToNext()) {
                    val id = try { JSONObject(cursor.getString(0)).optString("audioId") } catch (_: Exception) { "" }
                    if (id.matches(Regex("[a-f0-9]{64}"))) ids.add(id)
                }
            }
        }
        val target = AtomicFile(File(profile, "voice-references.json")); val out = target.startWrite()
        try { out.write(JSONArray(ids.toList()).toString().toByteArray()); target.finishWrite(out) } catch (e: Throwable) { target.failWrite(out); throw e }
    }
}

package io.hdsinterlude.android

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.OutputStream
import java.io.File
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class CharacterDocumentTest {
    @Test fun exportUsesUtf8AndRejectsInvalidDestinationsAndFailedWrites() {
        val input = JSONObject().put("filename", "角色-v2.json").put("mime", "application/json").put("content", "{\"name\":\"角色\"}\n")
        val document = CharacterDocument.from(input)
        val output = ByteArrayOutputStream(); document.writeTo(output)
        assertEquals(input.getString("content"), output.toString("UTF-8"))
        assertThrows(IllegalArgumentException::class.java) { CharacterDocument.from(JSONObject(input.toString()).put("filename", "../card.json")) }
        assertThrows(IllegalArgumentException::class.java) { CharacterDocument.from(JSONObject(input.toString()).put("mime", "text/html")) }
        assertThrows(IllegalArgumentException::class.java) { CharacterDocument.from(JSONObject(input.toString()).put("content", "")) }
        var closed = false
        assertThrows(IOException::class.java) { document.writeTo(object : OutputStream() {
            override fun write(value: Int) { throw IOException("disk full") }
            override fun close() { closed = true }
        }) }
        assertTrue(closed)
    }
    @Test fun importingCreatesLibraryEntryWithoutMutatingSelectedStoryAndDuplicateRetainsEdits() {
        val context = RuntimeEnvironment.getApplication<android.app.Application>()
        val store = HdsStore(context)
        val old = store.saveCard(JSONObject().put("format", "v2").put("name", "已有角色"), "old-card".toByteArray())
        store.select(old.getString("id"))
        File(store.profile(), "history-fixture.txt").writeText("existing history")
        val source = JSONObject().put("storyDefaults", JSONObject().put("characterName", "导入的角色").put("characterProfile", "人设"))
        val card = JSONObject().put("format", "hds").put("name", "导入的角色").put("raw", source)
        val saved = store.saveCard(card, source.toString().toByteArray())
        assertNotEquals(old.getString("id"), saved.getString("id"))
        assertEquals(old.getString("id"), store.privateSettings().getString("activeCard"))
        assertTrue((0 until store.listCards().length()).any { store.listCards().getJSONObject(it).getString("id") == saved.getString("id") })
        store.updateCard(saved.getString("id"), JSONObject(card.toString()).put("name", "编辑后的角色"))
        val duplicate = store.saveCard(card, source.toString().toByteArray())
        assertEquals(saved.getString("id"), duplicate.getString("id"))
        assertEquals("编辑后的角色", duplicate.getJSONObject("card").getString("name"))
        assertEquals("existing history", File(store.profile(), "history-fixture.txt").readText())
    }
    @Test fun settingImportPassesNativeAllowlistButUnknownMethodsDoNot() {
        val runtime = HdsRuntime.get(RuntimeEnvironment.getApplication())
        val allowed = assertThrows(IllegalArgumentException::class.java) { runtime.rpc("story.applySetting", JSONObject()) }
        assertEquals("请先启动 HDS", allowed.message)
        val denied = assertThrows(IllegalArgumentException::class.java) { runtime.rpc("arbitrary.method", JSONObject()) }
        assertEquals("不允许的本机 API 方法", denied.message)
    }
}

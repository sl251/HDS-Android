package io.hdsinterlude.android

import android.content.Context
import android.graphics.Bitmap
import android.util.Base64
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class CharacterAvatarStoreTest {
    private lateinit var context: Context
    private lateinit var store: HdsStore
    private lateinit var avatars: CharacterAvatarStore
    private lateinit var first: String
    private lateinit var second: String
    @Before fun setup() {
        context = RuntimeEnvironment.getApplication()
        File(context.noBackupFilesDir, "hds").deleteRecursively()
        store = HdsStore(context); avatars = CharacterAvatarStore(context, store)
        first = store.saveCard(JSONObject().put("name", "星禾"), "first".toByteArray()).getString("id")
        second = store.saveCard(JSONObject().put("name", "林间"), "second".toByteArray()).getString("id")
        store.select(first)
    }
    private fun jpeg(): ByteArray {
        val bitmap = Bitmap.createBitmap(32, 48, Bitmap.Config.ARGB_8888)
        return ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it); bitmap.recycle() }.toByteArray()
    }
    @Test fun uploadedAvatarPersistsInStoryAndDoesNotLeakOnSwitch() {
        assertFalse(avatars.read(first).has("path"))
        val saved = avatars.save(JSONObject().put("cardId", first).put("dataUri", "data:image/jpeg;base64," + Base64.encodeToString(jpeg(), Base64.NO_WRAP)))
        assertTrue(File(saved.getString("path")).isFile)
        assertEquals(store.profile(), File(saved.getString("path")).parentFile)
        store.select(second); assertFalse(avatars.read(second).has("path"))
        assertThrows(IllegalArgumentException::class.java) { avatars.save(JSONObject().put("cardId", first).put("clear", true)) }
        store.select(first); assertTrue(CharacterAvatarStore(context, store).read(first).has("path"))
        avatars.save(JSONObject().put("cardId", first).put("clear", true)); assertFalse(avatars.read(first).has("path"))
    }
    @Test fun generatedAssetMustExistInCurrentStoryAndInvalidInputPreservesAvatar() {
        val id = "a".repeat(64)
        val images = File(store.profile(), "images").apply { mkdirs() }
        File(images, "$id.jpg").writeBytes(jpeg())
        val saved = avatars.save(JSONObject().put("cardId", first).put("imageId", id))
        val before = File(saved.getString("path")).readBytes()
        assertThrows(IllegalArgumentException::class.java) { avatars.save(JSONObject().put("cardId", first).put("imageId", "../secret")) }
        assertArrayEquals(before, File(saved.getString("path")).readBytes())
        store.select(second)
        assertThrows(IllegalArgumentException::class.java) { avatars.save(JSONObject().put("cardId", second).put("imageId", id)) }
    }
    @Test fun palettePersistsAndRejectsUnknownNames() {
        val appearance = AppearanceStore(context)
        appearance.save(JSONObject().put("theme", "dark").put("palette", "rose"))
        assertEquals("rose", AppearanceStore(context).read().getString("palette"))
        assertThrows(IllegalArgumentException::class.java) { appearance.save(JSONObject().put("palette", "unknown")) }
        assertEquals("rose", appearance.read().getString("palette"))
    }
}

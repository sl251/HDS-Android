package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files

class RuntimeTransactionTest {
    private fun scenario(action: (File) -> Unit) {
        val environment = Files.createTempDirectory("hds-transaction").toFile()
        try { action(environment) } finally {
            val transaction = RuntimeTransaction(environment)
            if (transaction.root.exists()) transaction.root.renameTo(transaction.staging)
            transaction.deleteOwned(transaction.staging); transaction.deleteOwned(transaction.previous)
            environment.delete()
        }
    }
    private fun generation(directory: File, value: String) {
        directory.mkdirs(); File(directory, ".hds-installed.json").writeText(value); File(directory, "host").writeText(value)
    }
    @Test fun switchesMarkerAndFilesTogether() = scenario { env ->
        val transaction = RuntimeTransaction(env)
        generation(transaction.root, "old"); transaction.prepare(); generation(transaction.staging, "new")
        assertTrue(transaction.activate())
        assertEquals("new", File(transaction.root, ".hds-installed.json").readText())
        assertEquals("new", File(transaction.root, "host").readText())
        assertFalse(transaction.previous.exists())
    }
    @Test fun recoversDeathBetweenRenames() = scenario { env ->
        val transaction = RuntimeTransaction(env)
        generation(transaction.previous, "old"); generation(transaction.staging, "new")
        transaction.recover()
        assertEquals("old", File(transaction.root, "host").readText())
    }
    @Test fun retainsCommittedGenerationAfterDeathBeforeCleanup() = scenario { env ->
        val transaction = RuntimeTransaction(env)
        generation(transaction.root, "new"); generation(transaction.previous, "old")
        transaction.recover()
        assertEquals("new", File(transaction.root, ".hds-installed.json").readText())
    }
    @Test fun activationFailureRollsBackOldGeneration() = scenario { env ->
        val transaction = RuntimeTransaction(env) { a, b -> if (a.name == "staging") false else a.renameTo(b) }
        generation(transaction.root, "old"); generation(transaction.staging, "new")
        assertThrows(IllegalStateException::class.java) { transaction.activate() }
        assertEquals("old", File(transaction.root, "host").readText())
        assertEquals("old", File(transaction.root, ".hds-installed.json").readText())
    }
    @Test fun markerFailureCannotActivateOrTouchOldGeneration() = scenario { env ->
        val transaction = RuntimeTransaction(env)
        generation(transaction.root, "old"); transaction.prepare(); File(transaction.staging, "host").writeText("partial")
        assertThrows(IllegalArgumentException::class.java) { transaction.activate() }
        assertEquals("old", File(transaction.root, "host").readText())
        transaction.prepare()
        assertTrue(transaction.staging.list()!!.isEmpty())
    }
    @Test fun cleanupDoesNotFollowSymlinkIntoUserData() = scenario { env ->
        val transaction = RuntimeTransaction(env)
        val profile = File(env, "profile").apply { mkdir() }
        val story = File(profile, "story").apply { writeText("keep") }
        transaction.staging.mkdir()
        Files.createSymbolicLink(File(transaction.staging, "escape").toPath(), profile.toPath())
        transaction.deleteOwned(transaction.staging)
        assertEquals("keep", story.readText()); story.delete(); profile.delete()
        assertThrows(IllegalArgumentException::class.java) { transaction.deleteOwned(env) }
    }
    @Test fun cleanupHandlesReadOnlyDirectories() = scenario { env ->
        val transaction = RuntimeTransaction(env)
        val directory = File(transaction.staging, "readonly").apply { mkdirs() }
        File(directory, "file").writeText("temporary")
        directory.setWritable(false, false)
        transaction.deleteOwned(transaction.staging)
        assertFalse(transaction.staging.exists())
    }
    @Test fun failedCleanupKeepsCommittedGenerationReady() = scenario { env ->
        var previousDeletes = 0
        val transaction = RuntimeTransaction(env, beforeDelete = { file ->
            if (file.name == "previous" && ++previousDeletes == 2) throw java.io.IOException("injected cleanup failure")
        })
        generation(transaction.root, "old"); generation(transaction.staging, "new")
        assertFalse(transaction.activate())
        assertEquals("new", File(transaction.root, "host").readText())
        assertEquals("new", File(transaction.root, ".hds-installed.json").readText())
        assertTrue(transaction.previous.exists())
    }
}

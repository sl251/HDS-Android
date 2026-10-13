package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test

class ProotLaunchTest {
    @Test fun enablesSyscallTranslationEvenWhenParentDisabledIt() {
        val environment = mutableMapOf("PROOT_NO_SECCOMP" to "1", "LD_LIBRARY_PATH" to "/host/lib")
        ProotLaunch.configure(environment, "/native", "/cache/proot")
        assertFalse(environment.containsKey("PROOT_NO_SECCOMP"))
        assertEquals("/native/libhds_loader.so", environment["PROOT_LOADER"])
        assertEquals("/cache/proot", environment["PROOT_TMP_DIR"])
        assertEquals("", environment["LD_LIBRARY_PATH"])
    }

    @Test fun cwdAndPwdAgreeAndCompatibilityVersionPrecedesGuestCommand() {
        val args = ProotLaunch.guestArgs()
        assertEquals("4.14.0", args[args.indexOf("-k") + 1])
        assertTrue(args.indexOf("-k") < args.indexOf("/usr/bin/env"))
        assertEquals("/opt/hds", args[args.indexOf("-w") + 1])
        assertTrue(args.contains("PWD=/opt/hds"))
        assertEquals(listOf("/opt/node/bin/node", "/opt/hds/host.cjs"), args.takeLast(2))
    }
}

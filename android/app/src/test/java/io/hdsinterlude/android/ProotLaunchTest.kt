package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test

class ProotLaunchTest {
    @Test fun preservesMainLaunchEnvironmentAndSeparatesHostTemporaryDirectory() {
        val environment = mutableMapOf("TMPDIR" to "/android/cache", "LD_LIBRARY_PATH" to "/host/lib")
        ProotLaunch.configure(environment, "/native", "/cache/proot")
        assertEquals("1", environment["PROOT_NO_SECCOMP"])
        assertEquals("/native/libhds_loader.so", environment["PROOT_LOADER"])
        assertEquals("/cache/proot", environment["PROOT_TMP_DIR"])
        assertFalse(environment.containsKey("TMPDIR"))
        assertEquals("", environment["LD_LIBRARY_PATH"])
        assertEquals("/etc/ssl/openssl.cnf", environment["OPENSSL_CONF"])
        assertEquals("/usr/lib/aarch64-linux-gnu/ossl-modules", environment["OPENSSL_MODULES"])
        assertEquals("1", environment["HDS_MOBILE_MAIN"])
    }

    @Test fun startsNodeDirectlyInGuestWorkingDirectory() {
        val args = ProotLaunch.guestArgs()
        assertEquals("/opt/hds", args[args.indexOf("-w") + 1])
        assertFalse(args.contains("/usr/bin/env"))
        assertEquals(listOf("/opt/node/bin/node", "/opt/hds/host.cjs"), args.takeLast(2))
    }
}

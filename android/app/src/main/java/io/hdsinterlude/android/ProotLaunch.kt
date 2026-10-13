package io.hdsinterlude.android

/** Shared launch policy, kept independent of Android for regression checks. */
object ProotLaunch {
    fun guestArgs() = listOf(
        "-k", "4.14.0", "-w", "/opt/hds", "/usr/bin/env", "-i",
        "HOME=/root", "PWD=/opt/hds", "PATH=/opt/node/bin:/usr/bin:/bin",
        "LANG=C.UTF-8", "TMPDIR=/tmp", "HDS_MOBILE_MAIN=1",
        "/opt/node/bin/node", "/opt/hds/host.cjs"
    )

    fun configure(environment: MutableMap<String, String>, nativeDir: String, temporary: String) {
        // PRoot's seccomp trace is needed for syscall translation on recent Android.
        // Disabling it can make getcwd/stat/chdir return ENOSYS.
        environment.remove("PROOT_NO_SECCOMP")
        environment["PROOT_LOADER"] = "$nativeDir/libhds_loader.so"
        environment["PROOT_TMP_DIR"] = temporary
        environment["TMPDIR"] = temporary
        environment["LD_LIBRARY_PATH"] = ""
    }
}

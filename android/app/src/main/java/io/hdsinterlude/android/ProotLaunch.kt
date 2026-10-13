package io.hdsinterlude.android

/** Preserve main's direct Node launch policy independently of Android for regression checks. */
object ProotLaunch {
    fun guestArgs() = listOf("-w", "/opt/hds", "/opt/node/bin/node", "/opt/hds/host.cjs")

    fun configure(environment: MutableMap<String, String>, nativeDir: String, temporary: String) {
        environment["PROOT_NO_SECCOMP"] = "1"
        environment["PROOT_LOADER"] = "$nativeDir/libhds_loader.so"
        environment["PROOT_TMP_DIR"] = temporary
        // PRoot gets a host temporary directory; Node must not inherit an Android-only TMPDIR.
        environment.remove("TMPDIR")
        environment["LD_LIBRARY_PATH"] = ""
        environment["HOME"] = "/root"
        environment["PATH"] = "/opt/node/bin:/usr/bin:/bin"
        environment["LANG"] = "C.UTF-8"
        environment["OPENSSL_CONF"] = "/etc/ssl/openssl.cnf"
        environment["OPENSSL_MODULES"] = "/usr/lib/aarch64-linux-gnu/ossl-modules"
        environment["HDS_MOBILE_MAIN"] = "1"
    }
}

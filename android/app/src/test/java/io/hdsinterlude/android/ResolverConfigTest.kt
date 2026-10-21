package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test

class ResolverConfigTest {
    @Test fun systemDnsAlwaysPrecedesBothFallbackServers() {
        assertEquals("nameserver 10.0.0.1\nnameserver 2001:db8::1\nnameserver 223.5.5.5\nnameserver 1.1.1.1\n", resolverConfig(listOf("10.0.0.1", "2001:db8::1")))
        assertEquals("nameserver 223.5.5.5\nnameserver 1.1.1.1\n", resolverConfig(emptyList()))
    }
    @Test fun changedNetworkReplacesThePreviousSystemDns() {
        val wifi = resolverConfig(listOf("192.168.1.1"))
        val mobile = resolverConfig(listOf("10.1.1.1"))
        assertFalse(mobile.contains("192.168.1.1")); assertNotEquals(wifi, mobile)
        assertTrue(mobile.endsWith("nameserver 223.5.5.5\nnameserver 1.1.1.1\n"))
    }
}

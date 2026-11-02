package chat.vale.core

import java.net.ServerSocket
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TransportTest {
    @Test fun directFramingAndPrivateAddressRestriction() {
        val port = ServerSocket(0).use { it.localPort }
        val received = AtomicReference<String>()
        val listener = LanTransport(port) { packet, hops -> received.set("$packet/$hops"); true }
        assertTrue(listener.start())
        try {
            assertTrue(LanTransport.validEndpoint("192.168.1.5"))
            assertTrue(LanTransport.validEndpoint("127.0.0.1:$port"))
            assertFalse(LanTransport.validEndpoint("8.8.8.8"))
            assertFalse(LanTransport.validEndpoint("evil.example"))
            assertFalse(LanTransport.validEndpoint("192.168.999.5"))
            assertTrue(LanTransport.send("127.0.0.1:$port", "test", 2))
            assertEquals("test/2", received.get())
        } finally { listener.close() }
    }
}

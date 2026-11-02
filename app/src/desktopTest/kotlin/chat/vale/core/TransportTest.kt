package chat.vale.core

import java.net.ServerSocket
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TransportTest {
    @Test fun directFramingAndPrivateAddressRestriction() {
        val port = ServerSocket(0).use { it.localPort }
        val received = AtomicReference<String>()
        val listener = LanTransport(port) { packet, hops -> received.set("$packet/$hops"); "ok" }
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
    @Test fun closingNetworkEpochInterruptsPendingSend() {
        ServerSocket(0).use { server ->
            val accepted = CountDownLatch(1)
            val peer = Thread {
                server.accept().use { socket ->
                    accepted.countDown()
                    // Do not send a receipt; the client should be cancelled instead of waiting.
                    try { while (socket.getInputStream().read() != -1) { } } catch (_: Exception) { }
                }
            }.apply { isDaemon = true; start() }
            val sockets = OutboundSockets()
            val result = CompletableFuture.supplyAsync {
                LanTransport.sendReceipt("127.0.0.1:${server.localPort}", "packet", sockets = sockets)
            }
            try {
                assertTrue(accepted.await(5, TimeUnit.SECONDS))
                sockets.close()
                assertNull(result.get(5, TimeUnit.SECONDS))
                assertNull(sockets.open())
            } finally {
                sockets.close()
                peer.join(5_000)
            }
        }
    }

}

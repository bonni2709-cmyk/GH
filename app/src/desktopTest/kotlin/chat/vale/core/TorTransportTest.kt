package chat.vale.core

import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TorTransportTest {
    @Test fun onionIsSentToProxyAsDomainAndNoClearnetFallback() {
        val onion = "a".repeat(56) + ".onion"
        val listener = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        val executor = Executors.newSingleThreadExecutor()
        try {
            val received = executor.submit<String> {
                listener.accept().use { peer ->
                    val input = DataInputStream(peer.getInputStream()); val output = DataOutputStream(peer.getOutputStream())
                    val greeting = ByteArray(3); input.readFully(greeting)
                    assertTrue(greeting.contentEquals(byteArrayOf(5, 1, 0)))
                    output.write(byteArrayOf(5, 0)); output.flush()
                    assertEquals(5, input.readUnsignedByte()); assertEquals(1, input.readUnsignedByte()); assertEquals(0, input.readUnsignedByte())
                    assertEquals(3, input.readUnsignedByte()) // domain, never local DNS
                    val hostname = ByteArray(input.readUnsignedByte()); input.readFully(hostname)
                    assertEquals(DEFAULT_PORT, input.readUnsignedShort())
                    output.write(byteArrayOf(5, 0, 0, 1, 127, 0, 0, 1, 0, 1)); output.flush()
                    val size = input.readInt(); assertEquals(3, input.readUnsignedByte())
                    val packet = ByteArray(size); input.readFully(packet)
                    output.writeBoolean(true); output.flush()
                    String(hostname) + ":" + String(packet)
                }
            }
            assertTrue(TorTransport.send(onion, listener.localPort, "ciphertext"))
            assertEquals("$onion:ciphertext", received.get(10, TimeUnit.SECONDS))
            assertFalse(TorTransport.send("example.com", listener.localPort, "x"))
            assertFalse(TorTransport.send("192.168.1.2", listener.localPort, "x"))
            assertFalse(TorTransport.validEndpoint("abc.onion"))
        } finally { listener.close(); executor.shutdownNow() }
    }
}

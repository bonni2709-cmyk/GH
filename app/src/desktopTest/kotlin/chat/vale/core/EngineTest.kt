package chat.vale.core

import com.goterl.lazysodium.LazySodiumJava
import com.goterl.lazysodium.SodiumJava
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.encodeToString
import java.io.DataInputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class EngineTest {
    private class MemoryStore : EncryptedStore {
        @Volatile var contents: String? = null
        override fun read(): String? = contents
        override fun write(value: String) { contents = value }
        override fun close() {}
    }
    private val bridge = object : PlatformBridge {
        override val mobile = false
        override fun copyText(value: String) {}
        override fun scanQr(onResult: (String?) -> Unit) = onResult(null)
        override fun clearCache() {}
        override fun setDisguised(enabled: Boolean) {}
    }
    private suspend fun waitFor(predicate: () -> Boolean) = withTimeout(15_000) { while (!predicate()) delay(40) }

    @Test fun twoPeersAndReplayProtection() = runBlocking {
        val portA = ServerSocket(0).use { it.localPort }
        var portB = ServerSocket(0).use { it.localPort }
        while (portA == portB) portB = ServerSocket(0).use { it.localPort }
        val storeA = MemoryStore()
        val storeB = MemoryStore()
        val a = Engine(LazySodiumJava(SodiumJava()), bridge, { storeA }, portA)
        val b = Engine(LazySodiumJava(SodiumJava()), bridge, { storeB }, portB)
        try {
            waitFor { !a.state.value.loading && !b.state.value.loading }
            a.createProfile("Alice"); b.createProfile("Bob")
            waitFor { a.state.value.networkAvailable && b.state.value.networkAvailable }
            val alice = a.state.value.publicId
            val bob = b.state.value.publicId
            a.addContact("Bob", bob, "127.0.0.1:$portB")
            b.addContact("Alice", alice, "127.0.0.1:$portA")
            waitFor { a.state.value.contacts.size == 1 && b.state.value.contacts.size == 1 }
            a.selectContact(bob)
            a.sendMessage("Hello from Alice")
            waitFor { b.state.value.messages.any { it.text == "Hello from Alice" } }
            waitFor { a.state.value.messages.firstOrNull()?.pending == false }
            assertEquals(1, b.state.value.messages.size)

            val aliceIdentity = json.decodeFromString<Vault>(storeA.contents!!).identity!!
            val crypto = Crypto(LazySodiumJava(SodiumJava()))
            val packet = crypto.seal(aliceIdentity, bob, "Exactly once", 0, System.currentTimeMillis())
            val wire = json.encodeToString(packet)
            assertTrue(LanTransport.send("127.0.0.1:$portB", wire))
            assertTrue(LanTransport.send("127.0.0.1:$portB", wire))
            waitFor { b.state.value.messages.size == 2 }
            assertEquals(1, b.state.value.messages.count { it.text == "Exactly once" })
            assertFalse(LanTransport.send("127.0.0.1:$portB", json.encodeToString(packet.copy(to = alice))))
            val markerText = CONTENT_PREFIX + "literal text"
            a.sendMessage(markerText)
            waitFor { b.state.value.messages.any { it.text == markerText } }
            val countBeforeLongMessage = a.state.value.messages.size
            a.sendMessage("я".repeat(8_193)) // 16,386 UTF-8 bytes, not characters
            assertEquals(countBeforeLongMessage, a.state.value.messages.size)
            assertTrue(a.state.value.error?.contains("16 КБ") == true)
            a.panic()
            waitFor { a.state.value.panic }
            assertTrue(a.state.value.messages.isEmpty())
            a.restore()
            waitFor { !a.state.value.panic && a.state.value.profileName == "Alice" }
        } finally { a.close(); b.close() }
    }
    @Test fun switchingToTorCancelsDirectSendAndDoesNotTryLanRelay() = runBlocking {
        ServerSocket(0).use { stalled ->
            ServerSocket(0).use { relay ->
                val accepted = CompletableFuture<Socket>()
                Thread({ try { accepted.complete(stalled.accept()) } catch (e: Exception) { accepted.completeExceptionally(e) } }, "stalled-peer").apply { isDaemon = true; start() }
                val listenPort = ServerSocket(0).use { it.localPort }
                val a = Engine(LazySodiumJava(SodiumJava()), bridge, { MemoryStore() }, listenPort)
                try {
                    waitFor { !a.state.value.loading }
                    a.createProfile("Alice")
                    waitFor { a.state.value.networkAvailable }
                    val crypto = Crypto(LazySodiumJava(SodiumJava()))
                    val bob = crypto.generateIdentity("Bob").publicKey
                    val relayId = crypto.generateIdentity("Relay").publicKey
                    a.addContact("Bob", bob, "127.0.0.1:${stalled.localPort}")
                    a.addContact("Relay", relayId, "127.0.0.1:${relay.localPort}")
                    waitFor { a.state.value.contacts.size == 2 }
                    a.selectContact(bob)
                    a.sendMessage("queued")
                    accepted.get(10, TimeUnit.SECONDS).use { blocked ->
                        blocked.soTimeout = 5_000
                        val input = DataInputStream(blocked.getInputStream())
                        val size = input.readInt()
                        assertTrue(size in 1..MAX_PACKET_SIZE)
                        input.readUnsignedByte()
                        input.readFully(ByteArray(size))
                        a.setTor(true)
                        waitFor { a.state.value.torEnabled }
                        val closed = try { input.read() == -1 } catch (_: SocketException) { true }
                        assertTrue(closed)
                    }
                    relay.soTimeout = 1_000
                    assertFailsWith<SocketTimeoutException> { relay.accept().close() }
                } finally { a.close() }
            }
        }
    }

    @Test fun expiryCleanupContinuesWhileAnOutboundPeerIsStalled() = runBlocking {
        ServerSocket(0).use { stalled ->
            val accepted = CompletableFuture<Socket>()
            Thread({ try { accepted.complete(stalled.accept()) } catch (e: Exception) { accepted.completeExceptionally(e) } }, "stalled-expiry-peer").apply { isDaemon = true; start() }
            val listenPort = ServerSocket(0).use { it.localPort }
            val crypto = Crypto(LazySodiumJava(SodiumJava()))
            val alice = crypto.generateIdentity("Alice")
            val bob = crypto.generateIdentity("Bob")
            val packet = crypto.seal(alice, bob.publicKey, "blocked", 0, System.currentTimeMillis())
            val store = MemoryStore().apply {
                contents = json.encodeToString(Vault(identity = alice, contacts = listOf(Contact(bob.publicKey, "Bob", "127.0.0.1:${stalled.localPort}")),
                    messages = listOf(Message(packet.id, bob.publicKey, "blocked", true, packet.createdAt, 0, json.encodeToString(packet)))))
            }
            val a = Engine(LazySodiumJava(SodiumJava()), bridge, { store }, listenPort)
            try {
                waitFor { a.state.value.networkAvailable }
                accepted.get(15, TimeUnit.SECONDS).use { blocked ->
                    blocked.soTimeout = 5_000
                    val input = DataInputStream(blocked.getInputStream())
                    val length = input.readInt()
                    assertTrue(length in 1..MAX_PACKET_SIZE)
                    input.readUnsignedByte(); input.readFully(ByteArray(length))
                    val temporary = crypto.seal(bob, alice.publicKey, "temporary", 60, System.currentTimeMillis() - 55_000)
                    assertTrue(LanTransport.send("127.0.0.1:$listenPort", json.encodeToString(temporary)))
                    waitFor { a.state.value.messages.any { it.text == "temporary" } }
                    withTimeout(25_000) { while (a.state.value.messages.any { it.text == "temporary" }) delay(40) }
                }
            } finally { a.close() }
        }
    }

}

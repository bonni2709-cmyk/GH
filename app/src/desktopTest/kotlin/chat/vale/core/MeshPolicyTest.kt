package chat.vale.core

import com.goterl.lazysodium.LazySodiumJava
import com.goterl.lazysodium.SodiumJava
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.net.ServerSocket
import java.util.concurrent.ConcurrentHashMap
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MeshPolicyTest {
    private class MemoryStore : EncryptedStore {
        @Volatile private var contents: String? = null
        override fun read() = contents
        override fun write(value: String) { contents = value }
        override fun close() = Unit
    }
    private class Mesh {
        val receivers = ConcurrentHashMap<String, (String, Int) -> String?>()
        val links = ConcurrentHashMap<String, List<String>>()
        fun bridge(name: String) = object : PlatformBridge {
            override val mobile = true
            override fun copyText(value: String) = Unit
            override fun scanQr(onResult: (String?) -> Unit) = onResult(null)
            override fun clearCache() = Unit
            override fun setDisguised(enabled: Boolean) = Unit
            override fun startNearby(onPacket: (String, Int) -> String?, onStatus: (Int, String) -> Unit): NearbyLink {
                receivers[name] = onPacket
                onStatus(links[name]?.size ?: 0, "тест")
                return object : NearbyLink {
                    override fun send(packet: String, hops: Int) = links[name].orEmpty().firstNotNullOfOrNull { receivers[it]?.invoke(packet, hops) }
                    override fun close() { receivers.remove(name) }
                }
            }
            override fun startTor(localPort: Int, socksPort: Int, onStatus: (String, String) -> Unit): TorHandle {
                onStatus("a".repeat(56) + ".onion", "тест")
                return object : TorHandle { override fun close() = Unit }
            }
        }
    }
    private suspend fun waitFor(predicate: () -> Boolean) = withTimeout(20_000) { while (!predicate()) delay(40) }
    private fun freePorts(count: Int): List<Int> {
        val sockets = (1..count).map { ServerSocket(0) }
        return sockets.map { it.localPort }.also { sockets.forEach(ServerSocket::close) }
    }

    @Test fun encryptedMessageTraversesTwoNearbyHops() = runBlocking {
        val mesh = Mesh().apply { links["a"] = listOf("b"); links["b"] = listOf("a", "c"); links["c"] = listOf("b") }
        val ports = freePorts(3)
        fun node(name: String, port: Int) = Engine(LazySodiumJava(SodiumJava()), mesh.bridge(name), { MemoryStore() }, port)
        val a = node("a", ports[0]); val b = node("b", ports[1]); val c = node("c", ports[2])
        try {
            waitFor { listOf(a, b, c).all { !it.state.value.loading } }
            a.createProfile("Alice"); b.createProfile("Relay"); c.createProfile("Carol")
            waitFor { listOf(a, b, c).all { it.state.value.networkAvailable } }
            val alice = a.state.value.publicId; val carol = c.state.value.publicId
            a.addContact("Carol", carol, ""); b.addContact("Alice", alice, ""); b.addContact("Carol", carol, ""); c.addContact("Alice", alice, "")
            waitFor { a.state.value.contacts.size == 1 && b.state.value.contacts.size == 2 && c.state.value.contacts.size == 1 }
            b.setRelay(true); a.setNearby(true); b.setNearby(true); c.setNearby(true)
            waitFor { listOf(a, b, c).all { it.state.value.nearbyEnabled } && mesh.receivers.size == 3 }
            // Wait for the relay opt-in to be persisted as well.
            waitFor { b.state.value.relayEnabled }
            a.selectContact(carol); a.sendMessage("across the mesh")
            waitFor { c.state.value.messages.any { it.text == "across the mesh" } }
            waitFor { a.state.value.messages.any { !it.pending } }
            assertTrue(b.state.value.messages.isEmpty()) // relay never decrypts or displays plaintext
        } finally { a.close(); b.close(); c.close() }
    }

    @Test fun forgedRelayReceiptDoesNotMarkMessageDelivered() = runBlocking {
        val mesh = Mesh().apply { links["a"] = listOf("evil"); receivers["evil"] = { _, _ -> "A".repeat(86) } }
        val a = Engine(LazySodiumJava(SodiumJava()), mesh.bridge("a"), { MemoryStore() }, freePorts(1).single())
        try {
            waitFor { !a.state.value.loading }
            a.createProfile("Alice")
            waitFor { a.state.value.networkAvailable }
            val target = Crypto(LazySodiumJava(SodiumJava())).generateIdentity("Bob").publicKey
            a.addContact("Bob", target, ""); a.setNearby(true)
            waitFor { a.state.value.contacts.size == 1 && a.state.value.nearbyEnabled && mesh.receivers.containsKey("a") }
            a.selectContact(target); a.sendMessage("prove receipt")
            waitFor { a.state.value.messages.isNotEmpty() }
            delay(1_000)
            assertTrue(a.state.value.messages.single().pending)
        } finally { a.close() }
    }

    @Test fun torOnlyRejectsLocalEndpointsAndDirectCalls() = runBlocking {
        val mesh = Mesh(); val ports = freePorts(2)
        val a = Engine(LazySodiumJava(SodiumJava()), mesh.bridge("a"), { MemoryStore() }, ports[0])
        val b = Engine(LazySodiumJava(SodiumJava()), mesh.bridge("b"), { MemoryStore() }, ports[1])
        try {
            waitFor { !a.state.value.loading && !b.state.value.loading }
            a.createProfile("Alice"); b.createProfile("Bob")
            waitFor { a.state.value.networkAvailable && b.state.value.networkAvailable }
            val alice = a.state.value.publicId; val bob = b.state.value.publicId
            a.addContact("Bob", bob, "127.0.0.1:${ports[1]}"); b.addContact("Alice", alice, "127.0.0.1:${ports[0]}")
            waitFor { a.state.value.contacts.size == 1 && b.state.value.contacts.size == 1 }
            a.setTor(true)
            waitFor { a.state.value.torEnabled && a.state.value.torOnion.endsWith(".onion") }
            assertTrue(a.contactCard().endsWith(".onion"))
            a.selectContact(bob); a.sendMessage("must not leave via LAN"); a.startCall(false)
            delay(1_000)
            assertTrue(a.state.value.messages.any { it.pending })
            assertFalse(b.state.value.messages.any { it.text == "must not leave via LAN" })
            assertTrue(a.state.value.call == null)
        } finally { a.close(); b.close() }
    }
}

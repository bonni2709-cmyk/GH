package chat.vale.core

import com.goterl.lazysodium.LazySodiumJava
import com.goterl.lazysodium.SodiumJava
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.encodeToString
import java.net.ServerSocket
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
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
            a.panic()
            waitFor { a.state.value.panic }
            assertTrue(a.state.value.messages.isEmpty())
            a.restore()
            waitFor { !a.state.value.panic && a.state.value.profileName == "Alice" }
        } finally { a.close(); b.close() }
    }
}

package chat.vale.core

import com.goterl.lazysodium.LazySodiumJava
import com.goterl.lazysodium.SodiumJava
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.encodeToString
import java.net.HttpURLConnection
import java.net.ServerSocket
import java.net.URI
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MediaEngineTest {
    private class MemoryStore : EncryptedStore {
        @Volatile var contents: String? = null
        override fun read() = contents
        override fun write(value: String) { contents = value }
        override fun close() {}
    }
    private class BrowserBridge : PlatformBridge {
        override val mobile = false
        @Volatile var url: String? = null
        override fun copyText(value: String) {}
        override fun scanQr(onResult: (String?) -> Unit) = onResult(null)
        override fun clearCache() {}
        override fun setDisguised(enabled: Boolean) {}
        override fun openLocalPage(url: String): Boolean { this.url = url; return true }
    }
    private suspend fun waitFor(test: () -> Boolean) = withTimeout(20_000) { while (!test()) delay(40) }
    private fun action(url: String, body: BrowserRequest): Int {
        val uri = URI(url)
        val connection = URI("http://${uri.host}:${uri.port}/action").toURL().openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.setRequestProperty("X-Vale-Token", uri.fragment)
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write(json.encodeToString(body).toByteArray()) }
        val code = connection.responseCode
        connection.disconnect()
        return code
    }
    private fun events(url: String): List<BrowserEvent> {
        val uri = URI(url)
        val connection = URI("http://${uri.host}:${uri.port}/events").toURL().openConnection() as HttpURLConnection
        connection.setRequestProperty("X-Vale-Token", uri.fragment)
        val response = connection.inputStream.bufferedReader().readText()
        connection.disconnect()
        return json.decodeFromString(response)
    }

    @Test fun mediaAndCallSignallingBetweenTwoPeers() = runBlocking {
        val portA = ServerSocket(0).use { it.localPort }
        var portB = ServerSocket(0).use { it.localPort }
        while (portA == portB) portB = ServerSocket(0).use { it.localPort }
        val bridgeA = BrowserBridge(); val bridgeB = BrowserBridge()
        val a = Engine(LazySodiumJava(SodiumJava()), bridgeA, { MemoryStore() }, portA)
        val b = Engine(LazySodiumJava(SodiumJava()), bridgeB, { MemoryStore() }, portB)
        try {
            waitFor { !a.state.value.loading && !b.state.value.loading }
            a.createProfile("Alice"); b.createProfile("Bob")
            waitFor { a.state.value.networkAvailable && b.state.value.networkAvailable }
            val alice = a.state.value.publicId; val bob = b.state.value.publicId
            a.addContact("Bob", bob, "127.0.0.1:$portB"); b.addContact("Alice", alice, "127.0.0.1:$portA")
            waitFor { a.state.value.contacts.isNotEmpty() && b.state.value.contacts.isNotEmpty() }
            a.selectContact(bob)
            a.sendSticker("🐻")
            waitFor { b.state.value.messages.any { it.kind == "sticker-emoji" } }
            val png = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=")
            a.openMediaStudio()
            val studio = bridgeA.url!!
            assertEquals(200, action(studio, BrowserRequest(action = "submit", kind = "sticker", mime = "image/png", media = png.b64())))
            waitFor { b.state.value.messages.any { it.kind == "sticker" } }
            assertContentEquals(png, b.mediaBytes(b.state.value.messages.first { it.kind == "sticker" }.id))

            a.startCall(false)
            val outgoing = bridgeA.url!!
            assertEquals(200, action(outgoing, BrowserRequest(action = "offer", sdp = "v=0\r\na=offer\r\n")))
            waitFor { b.state.value.call?.incoming == true }
            b.acceptCall()
            val incoming = bridgeB.url!!
            assertEquals(200, action(incoming, BrowserRequest(action = "answer", sdp = "v=0\r\na=answer\r\n")))
            var answers = emptyList<BrowserEvent>()
            waitFor { answers = events(outgoing); answers.any { it.kind == "answer" } }
            assertTrue(answers.first().sdp.contains("answer"))
            // Tor-only mode must wait until the direct browser connection is stopped.
            a.setTor(true)
            assertTrue(!a.state.value.torEnabled)
            var stopA = emptyList<BrowserEvent>()
            waitFor { stopA = events(outgoing); stopA.any { it.kind == "end" } }
            assertEquals(200, action(outgoing, BrowserRequest(action = "hangup")))
            waitFor { a.state.value.call == null }
            var stopB = emptyList<BrowserEvent>()
            waitFor { stopB = events(incoming); stopB.any { it.kind == "end" } }
            assertEquals(200, action(incoming, BrowserRequest(action = "hangup")))
            waitFor { b.state.value.call == null }
        } finally { a.close(); b.close() }
    }
}

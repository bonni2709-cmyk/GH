package com.voxel.vpn.net

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.concurrent.atomic.AtomicReference
import java.util.zip.GZIPOutputStream

class HttpSubscriptionFetcherTest {
    private lateinit var server: HttpServer
    private val seenUserAgent = AtomicReference<String?>()
    private val seenExtra = AtomicReference<String?>()
    private val base get() = "http://127.0.0.1:${server.address.port}"

    private fun HttpExchange.reply(code: Int, body: ByteArray, vararg headers: Pair<String, String>) {
        headers.forEach { (k, v) -> responseHeaders.add(k, v) }
        sendResponseHeaders(code, if (body.isEmpty()) -1 else body.size.toLong())
        if (body.isNotEmpty()) responseBody.use { it.write(body) }
        close()
    }

    @Before
    fun start() {
        server = HttpServer.create(InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0)
        server.createContext("/plain") { ex ->
            seenUserAgent.set(ex.requestHeaders.getFirst("User-Agent"))
            seenExtra.set(ex.requestHeaders.getFirst("X-Test"))
            ex.reply(
                200, "hello \u043C\u0438\u0440".toByteArray(),
                "Profile-Title" to "Title", "Subscription-Userinfo" to "upload=1; download=2; total=3", "Content-Type" to "text/plain",
            )
        }
        server.createContext("/gzip") { ex ->
            val out = ByteArrayOutputStream()
            GZIPOutputStream(out).use { it.write("zipped body".toByteArray()) }
            ex.reply(200, out.toByteArray(), "Content-Encoding" to "gzip")
        }
        server.createContext("/redirect") { ex -> ex.reply(302, ByteArray(0), "Location" to "/plain") }
        server.createContext("/loop") { ex -> ex.reply(302, ByteArray(0), "Location" to "/loop") }
        server.createContext("/other-scheme") { ex -> ex.reply(302, ByteArray(0), "Location" to "ftp://example.com/x") }
        server.createContext("/gone") { ex -> ex.reply(404, "not here".toByteArray()) }
        server.createContext("/big") { ex -> ex.reply(200, ByteArray(100_000) { 'a'.code.toByte() }) }
        server.start()
    }

    @After
    fun stop() {
        server.stop(0)
    }

    private fun fetcher(max: Int = 1_000_000) =
        HttpSubscriptionFetcher("VOXEL/1.0 (test)", mapOf("X-Test" to "1"), connectTimeoutMs = 2000, readTimeoutMs = 2000, maxBytes = max)

    @Test
    fun fetchesBodyHeadersAndSendsOurUserAgent() = runBlocking {
        val page = fetcher().fetch("$base/plain")
        assertEquals(200, page.status)
        assertEquals("hello \u043C\u0438\u0440", page.body)
        assertEquals("Title", page.headers["profile-title"])
        assertEquals("upload=1; download=2; total=3", page.headers["subscription-userinfo"])
        assertEquals("VOXEL/1.0 (test)", seenUserAgent.get())
        assertEquals("1", seenExtra.get())
    }

    @Test
    fun decodesGzip() = runBlocking {
        assertEquals("zipped body", fetcher().fetch("$base/gzip").body)
    }

    @Test
    fun followsRedirectsAndReportsTheFinalUrl() = runBlocking {
        val page = fetcher().fetch("$base/redirect")
        assertEquals("$base/plain", page.finalUrl)
        assertEquals(200, page.status)
    }

    @Test
    fun redirectLoopsAndForeignSchemesAreRefused() {
        val loop = kotlin.runCatching { runBlocking { fetcher().fetch("$base/loop") } }.exceptionOrNull()
        assertTrue(loop is FetchException && loop.message!!.contains("redirects"))
        val bad = kotlin.runCatching { runBlocking { fetcher().fetch("$base/other-scheme") } }.exceptionOrNull()
        assertTrue(bad is FetchException && bad.message!!.contains("ftp"))
    }

    @Test
    fun errorStatusesAreReturnedWithTheirBody() = runBlocking {
        val page = fetcher().fetch("$base/gone")
        assertEquals(404, page.status)
        assertEquals("not here", page.body)
    }

    @Test
    fun oversizedResponsesAreRejected() {
        val e = kotlin.runCatching { runBlocking { fetcher(max = 10_000).fetch("$base/big") } }.exceptionOrNull()
        assertTrue(e is FetchException && e.message!!.contains("larger"))
    }

    @Test
    fun badUrlsAreRejected() {
        val e1 = kotlin.runCatching { runBlocking { fetcher().fetch("not a url") } }.exceptionOrNull()
        assertTrue(e1 is FetchException)
        val e2 = kotlin.runCatching { runBlocking { fetcher().fetch("ftp://example.com/x") } }.exceptionOrNull()
        assertTrue(e2 is FetchException && e2.message!!.contains("scheme"))
    }

    @Test
    fun unreachableHostsFailWithAnIoError() {
        val port = java.net.ServerSocket(0).use { it.localPort }
        val e = kotlin.runCatching { runBlocking { fetcher().fetch("http://127.0.0.1:$port/x") } }.exceptionOrNull()
        assertTrue(e is java.io.IOException)
    }
}

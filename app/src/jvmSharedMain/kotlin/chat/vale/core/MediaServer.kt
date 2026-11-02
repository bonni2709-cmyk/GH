package chat.vale.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Locale
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

@Serializable
internal data class BrowserConfig(
    val mode: String,
    val contact: String = "",
    val video: Boolean = false,
    val role: String = "",
    val offer: String = "",
    val mediaType: String = "",
    val maxBytes: Int = MAX_MEDIA_BYTES,
)

@Serializable
internal data class BrowserRequest(
    val action: String,
    val kind: String = "",
    val mime: String = "",
    val media: String = "",
    val durationMs: Long = 0,
    val sdp: String = "",
)

@Serializable
internal data class BrowserEvent(val kind: String, val sdp: String = "")

/**
 * An ephemeral, loopback-only browser bridge. The URL fragment carries a fresh
 * 256-bit token; it is never sent with the page request or in Referer headers.
 * Only explicitly whitelisted paths are served. No files, CORS or remote CDN.
 */
internal class MediaServer(
    private val config: BrowserConfig,
    private val media: ByteArray? = null,
    private val mediaType: String = "application/octet-stream",
    private val onRequest: (BrowserRequest) -> Boolean,
) : Closeable {
    private val token = ByteArray(32).also { SecureRandom().nextBytes(it) }.b64()
    private val listener = ServerSocket().apply { bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0), 16) }
    private val workers = ThreadPoolExecutor(1, 4, 15, TimeUnit.SECONDS, ArrayBlockingQueue(12)) { task ->
        Thread(task, "vale-media-http").apply { isDaemon = true }
    }
    private val events = ConcurrentLinkedQueue<BrowserEvent>()
    val url: String get() = "http://127.0.0.1:${listener.localPort}/#$token"

    init {
        Thread({
            while (!listener.isClosed) {
                try {
                    val socket = listener.accept()
                    try { workers.execute { handle(socket) } } catch (_: Exception) { socket.close() }
                } catch (_: Exception) { if (listener.isClosed) break }
            }
        }, "vale-media-listener").apply { isDaemon = true; start() }
    }

    fun push(event: BrowserEvent) {
        if (events.size < 32) events.add(event)
    }

    private fun handle(socket: Socket) {
        try {
            socket.use { peer ->
                peer.soTimeout = 8_000
                val input = BufferedInputStream(peer.getInputStream())
                val first = readLine(input, 4096) ?: return
                val parts = first.split(' ')
                if (parts.size != 3 || parts[2] != "HTTP/1.1") return
                val method = parts[0]
                val path = parts[1]
                val headers = mutableMapOf<String, String>()
                var headerBytes = 0
                while (true) {
                    val line = readLine(input, 8192) ?: return
                    headerBytes += line.length
                    if (headerBytes > 16_384) return
                    if (line.isEmpty()) break
                    val colon = line.indexOf(':')
                    if (colon < 1) return
                    val key = line.substring(0, colon).trim().lowercase(Locale.ROOT)
                    if (key in headers) return
                    headers[key] = line.substring(colon + 1).trim()
                }
                if (headers["host"] != "127.0.0.1:${listener.localPort}" || headers.containsKey("transfer-encoding")) {
                    respond(peer, 403, "text/plain", "Forbidden".toByteArray()); return
                }
                if (method == "GET" && path == "/") {
                    respond(peer, 200, "text/html; charset=utf-8", MEDIA_PAGE.toByteArray(Charsets.UTF_8)); return
                }
                val supplied = headers["x-vale-token"].orEmpty().toByteArray(Charsets.US_ASCII)
                if (!MessageDigest.isEqual(token.toByteArray(Charsets.US_ASCII), supplied)) {
                    respond(peer, 403, "text/plain", "Forbidden".toByteArray()); return
                }
                val origin = headers["origin"]
                if (origin != null && origin != "http://127.0.0.1:${listener.localPort}") {
                    respond(peer, 403, "text/plain", "Forbidden".toByteArray()); return
                }
                when {
                    method == "GET" && path == "/config" -> respond(peer, 200, "application/json", json.encodeToString(config).toByteArray())
                    method == "GET" && path == "/events" -> {
                        val batch = ArrayList<BrowserEvent>()
                        while (batch.size < 32) batch.add(events.poll() ?: break)
                        respond(peer, 200, "application/json", json.encodeToString(batch).toByteArray())
                    }
                    method == "GET" && path == "/media" && media != null -> respond(peer, 200, mediaType, media)
                    method == "POST" && path == "/action" -> {
                        val length = headers["content-length"]?.toIntOrNull() ?: -1
                        if (length !in 1..(MAX_MESSAGE_BYTES + 4096) || !headers["content-type"].orEmpty().startsWith("application/json")) {
                            respond(peer, 400, "text/plain", "Bad request".toByteArray()); return
                        }
                        val body = ByteArray(length)
                        var offset = 0
                        while (offset < length) {
                            val count = input.read(body, offset, length - offset)
                            if (count < 0) return
                            offset += count
                        }
                        val request = try { json.decodeFromString<BrowserRequest>(String(body, Charsets.UTF_8)) } catch (_: Exception) { null }
                        val accepted = request != null && try { onRequest(request) } catch (_: Exception) { false }
                        respond(peer, if (accepted) 200 else 400, "application/json", if (accepted) "{\"ok\":true}".toByteArray() else "{\"ok\":false}".toByteArray())
                    }
                    else -> respond(peer, 404, "text/plain", "Not found".toByteArray())
                }
            }
        } catch (_: Exception) { /* malformed or disconnected loopback client */ }
    }

    private fun readLine(input: BufferedInputStream, limit: Int): String? {
        val buffer = ByteArrayOutputStream()
        while (buffer.size() <= limit) {
            val ch = input.read()
            if (ch == -1) return null
            if (ch == 10) {
                val bytes = buffer.toByteArray()
                if (bytes.isEmpty() || bytes.last() != 13.toByte()) return null
                return String(bytes, 0, bytes.size - 1, Charsets.US_ASCII)
            }
            buffer.write(ch)
        }
        return null
    }

    private fun respond(peer: Socket, code: Int, type: String, data: ByteArray) {
        val label = when (code) { 200 -> "OK"; 400 -> "Bad Request"; 403 -> "Forbidden"; else -> "Not Found" }
        val header = "HTTP/1.1 $code $label\r\nContent-Type: $type\r\nContent-Length: ${data.size}\r\n" +
            "Cache-Control: no-store, no-cache, must-revalidate\r\nPragma: no-cache\r\n" +
            "X-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\n" +
            "Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; media-src blob:; img-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\r\n" +
            "Connection: close\r\n\r\n"
        val out = peer.getOutputStream()
        out.write(header.toByteArray(Charsets.US_ASCII)); out.write(data); out.flush()
    }

    override fun close() {
        try { listener.close() } catch (_: Exception) { }
        workers.shutdownNow()
        events.clear()
    }
}

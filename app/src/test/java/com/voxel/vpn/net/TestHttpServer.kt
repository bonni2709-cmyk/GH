package com.voxel.vpn.net

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread

/**
 * A minimal HTTP/1.1 server on the loopback interface for tests: one handler per path, every response
 * closes its connection. Built on java.net only, so it needs nothing beyond the JDK's base module.
 */
class TestHttpServer : AutoCloseable {
    class Request(val method: String, val path: String, val headers: Map<String, String>)

    class Response(
        val status: Int,
        val body: ByteArray = ByteArray(0),
        val headers: List<Pair<String, String>> = emptyList(),
    )

    private val socket = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
    private val routes = ConcurrentHashMap<String, (Request) -> Response>()

    val port: Int get() = socket.localPort
    val baseUrl: String get() = "http://127.0.0.1:$port"

    fun route(path: String, handler: (Request) -> Response) {
        routes[path] = handler
    }

    fun start() {
        thread(isDaemon = true, name = "test-http-accept") {
            while (!socket.isClosed) {
                val client = try {
                    socket.accept()
                } catch (e: IOException) {
                    return@thread
                }
                thread(isDaemon = true, name = "test-http-connection") { serve(client) }
            }
        }
    }

    override fun close() {
        socket.close()
    }

    private fun serve(client: Socket) {
        try {
            client.use { connection ->
                connection.soTimeout = 5_000
                val input = connection.getInputStream().buffered()
                val requestLine = readLine(input) ?: return
                val parts = requestLine.split(' ')
                if (parts.size < 2) return
                val headers = LinkedHashMap<String, String>()
                while (true) {
                    val line = readLine(input) ?: return
                    if (line.isEmpty()) break
                    val colon = line.indexOf(':')
                    if (colon > 0) headers[line.substring(0, colon).trim().lowercase()] = line.substring(colon + 1).trim()
                }
                val request = Request(parts[0], parts[1].substringBefore('?'), headers)
                val handler = routes[request.path]
                val response = if (handler == null) Response(404, "no route".toByteArray()) else handler(request)

                val head = StringBuilder("HTTP/1.1 ${response.status} ${reason(response.status)}\r\n")
                for ((name, value) in response.headers) head.append(name).append(": ").append(value).append("\r\n")
                head.append("Content-Length: ").append(response.body.size).append("\r\n")
                head.append("Connection: close\r\n\r\n")

                val out = connection.getOutputStream().buffered()
                out.write(head.toString().toByteArray(Charsets.ISO_8859_1))
                out.write(response.body)
                out.flush()
            }
        } catch (e: IOException) {
            // The client may hang up early, for instance when it refuses an oversized body.
        }
    }

    private fun readLine(input: InputStream): String? {
        val line = ByteArrayOutputStream()
        while (true) {
            val b = input.read()
            if (b < 0) return if (line.size() == 0) null else String(line.toByteArray(), Charsets.ISO_8859_1)
            if (b == '\n'.code) return String(line.toByteArray(), Charsets.ISO_8859_1)
            if (b != '\r'.code) line.write(b)
        }
    }

    private fun reason(status: Int): String = when (status) {
        200 -> "OK"
        301 -> "Moved Permanently"
        302 -> "Found"
        404 -> "Not Found"
        else -> "Status"
    }
}

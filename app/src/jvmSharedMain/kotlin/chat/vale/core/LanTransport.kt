package chat.vale.core

import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.Collections
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

internal const val DEFAULT_PORT = 45454
internal const val MAX_PACKET_SIZE = 1_600_000

/** Direct, bounded TCP transport. It deliberately accepts only literal private IPv4 addresses. */
internal class LanTransport(
    private val port: Int = DEFAULT_PORT,
    private val loopbackOnly: Boolean = false,
    private val onPacket: (String, Int) -> String?,
) {
    private var server: ServerSocket? = null
    private val openSockets = ConcurrentHashMap.newKeySet<Socket>()
    private val workers = ThreadPoolExecutor(2, 6, 30, TimeUnit.SECONDS, ArrayBlockingQueue(24))

    fun start(): Boolean = try {
        val listener = ServerSocket().apply {
            reuseAddress = true
            bind(if (loopbackOnly) InetSocketAddress(InetAddress.getByName("127.0.0.1"), port) else InetSocketAddress(port))
        }
        server = listener
        Thread({
            while (!listener.isClosed) {
                try {
                    val socket = listener.accept()
                    val remote = socket.inetAddress
                    if (!remote.isSiteLocalAddress && !remote.isLinkLocalAddress && !remote.isLoopbackAddress) { socket.close(); continue }
                    openSockets.add(socket)
                    try {
                        workers.execute { try { handle(socket) } finally { openSockets.remove(socket) } }
                    } catch (_: Exception) { openSockets.remove(socket); socket.close() }
                } catch (_: SocketException) {
                    break
                } catch (_: Exception) {
                    if (listener.isClosed) break
                }
            }
        }, "vale-listener").apply { isDaemon = true; start() }
        true
    } catch (_: Exception) { false }

    private fun handle(socket: Socket) {
        try {
            socket.use {
                // Bound slow/partial inbound frames; longer outbound waits cover relays.
                val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(25)
                it.soTimeout = 8_000
                val input = DataInputStream(it.getInputStream())
                val length = input.readInt()
                if (length !in 1..MAX_PACKET_SIZE) return
                val hops = input.readUnsignedByte()
                if (hops !in 0..3) return
                val bytes = ByteArray(length)
                var offset = 0
                while (offset < length) {
                    val remaining = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime())
                    if (remaining <= 0) return
                    it.soTimeout = minOf(8_000L, remaining).coerceAtLeast(1).toInt()
                    val count = input.read(bytes, offset, length - offset)
                    if (count < 0) return
                    offset += count
                }
                val receipt = onPacket(String(bytes, Charsets.UTF_8), hops)?.toByteArray(Charsets.US_ASCII)
                DataOutputStream(it.getOutputStream()).apply {
                    if (receipt == null || receipt.size !in 1..128) writeShort(0) else { writeShort(receipt.size); write(receipt) }
                    flush()
                }
            }
        } catch (_: Exception) {
            // Untrusted or disconnected peers must never crash the app.
        }
    }

    fun close() {
        try { server?.close() } catch (_: Exception) { }
        openSockets.forEach { try { it.close() } catch (_: Exception) { } }
        openSockets.clear()
        workers.shutdownNow()
    }

    companion object {
        fun validEndpoint(value: String): Boolean = parseEndpoint(value) != null

        fun send(address: String, packet: String, hops: Int = 3): Boolean = sendReceipt(address, packet, hops) != null

        fun sendReceipt(address: String, packet: String, hops: Int = 3): String? {
            val endpoint = parseEndpoint(address) ?: return null
            val bytes = packet.toByteArray(Charsets.UTF_8)
            if (bytes.size !in 1..MAX_PACKET_SIZE || hops !in 0..3) return null
            return try {
                Socket().use { socket ->
                    socket.connect(endpoint, 2_000)
                    socket.soTimeout = 180_000
                    DataOutputStream(socket.getOutputStream()).apply {
                        writeInt(bytes.size); writeByte(hops); write(bytes); flush()
                    }
                    val input = DataInputStream(socket.getInputStream())
                    val size = input.readUnsignedShort()
                    if (size !in 1..128) return null
                    val response = ByteArray(size); input.readFully(response)
                    String(response, Charsets.US_ASCII)
                }
            } catch (_: Exception) { null }
        }

        fun localAddress(): String = try {
            Collections.list(NetworkInterface.getNetworkInterfaces())
                .filter { it.isUp && !it.isLoopback }
                .flatMap { Collections.list(it.inetAddresses) }
                .filterIsInstance<Inet4Address>()
                .firstOrNull { it.isSiteLocalAddress || it.isLinkLocalAddress }
                ?.hostAddress.orEmpty()
        } catch (_: Exception) { "" }

        private fun parseEndpoint(value: String): InetSocketAddress? {
            val parts = value.trim().split(':')
            if (parts.size !in 1..2) return null
            val octets = parts[0].split('.')
            if (octets.size != 4 || octets.any { it.isEmpty() || it.length > 3 || it.any { c -> !c.isDigit() } || (it.toIntOrNull() ?: -1) !in 0..255 }) return null
            val port = if (parts.size == 2) parts[1].toIntOrNull() ?: return null else DEFAULT_PORT
            if (port !in 1..65535) return null
            val bytes = octets.map { it.toInt().toByte() }.toByteArray()
            val ip = InetAddress.getByAddress(bytes)
            if (!ip.isSiteLocalAddress && !ip.isLinkLocalAddress && !ip.isLoopbackAddress) return null
            return InetSocketAddress(ip, port)
        }
    }
}

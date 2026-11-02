package chat.vale.core

import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.util.Locale

/** SOCKS5 domain-name request only; never resolve onion names via DNS or fall back to clearnet. */
internal object TorTransport {
    fun validEndpoint(value: String): Boolean = parse(value) != null

    private fun parse(value: String): Pair<String, Int>? {
        val parts = value.trim().lowercase(Locale.ROOT).split(':')
        if (parts.size !in 1..2) return null
        val host = parts[0]
        if (!host.matches(Regex("[a-z2-7]{56}\\.onion"))) return null
        val port = if (parts.size == 2) parts[1].toIntOrNull() ?: return null else DEFAULT_PORT
        if (port !in 1..65535) return null
        return host to port
    }

    fun send(endpoint: String, socksPort: Int, packet: String, hops: Int = 3): Boolean = sendReceipt(endpoint, socksPort, packet, hops) != null

    fun sendReceipt(endpoint: String, socksPort: Int, packet: String, hops: Int = 3, sockets: OutboundSockets? = null): String? {
        val (host, port) = parse(endpoint) ?: return null
        if (socksPort !in 1..65535 || hops !in 0..3) return null
        val bytes = packet.toByteArray(Charsets.UTF_8)
        if (bytes.size !in 1..MAX_PACKET_SIZE) return null
        val socket = sockets?.open() ?: if (sockets == null) Socket() else return null
        return try {
            socket.use {
                // Connect only to the local Tor proxy. Hostname is carried inside SOCKS5.
                socket.connect(InetSocketAddress(InetAddress.getByName("127.0.0.1"), socksPort), 3_000)
                socket.soTimeout = 180_000
                val input = DataInputStream(socket.getInputStream())
                val output = DataOutputStream(socket.getOutputStream())
                output.write(byteArrayOf(5, 1, 0)); output.flush()
                if (input.readUnsignedByte() != 5 || input.readUnsignedByte() != 0) return null
                val name = host.toByteArray(Charsets.US_ASCII)
                output.write(byteArrayOf(5, 1, 0, 3, name.size.toByte())); output.write(name); output.writeShort(port); output.flush()
                if (input.readUnsignedByte() != 5 || input.readUnsignedByte() != 0 || input.readUnsignedByte() != 0) return null
                when (input.readUnsignedByte()) {
                    1 -> input.skipFully(4)
                    3 -> input.skipFully(input.readUnsignedByte())
                    4 -> input.skipFully(16)
                    else -> return null
                }
                input.readUnsignedShort()
                output.writeInt(bytes.size); output.writeByte(hops); output.write(bytes); output.flush()
                val size = input.readUnsignedShort()
                if (size !in 1..128) return null
                val response = ByteArray(size); input.readFully(response)
                String(response, Charsets.US_ASCII)
            }
        } catch (_: Exception) { null }
        finally { sockets?.release(socket) }
    }

    private fun DataInputStream.skipFully(size: Int) { val ignored = ByteArray(size); readFully(ignored) }
}

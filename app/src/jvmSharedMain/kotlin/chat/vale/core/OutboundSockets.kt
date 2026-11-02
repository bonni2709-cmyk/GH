package chat.vale.core

import java.net.Socket

/** Per-network-epoch outbound sockets; closing it interrupts in-flight connects and reads. */
internal class OutboundSockets {
    private val sockets = mutableSetOf<Socket>()
    private var closed = false

    @Synchronized fun open(): Socket? {
        if (closed) return null
        return Socket().also { sockets.add(it) }
    }

    @Synchronized fun release(socket: Socket) { sockets.remove(socket) }

    fun close() {
        val active = synchronized(this) {
            closed = true
            sockets.toList().also { sockets.clear() }
        }
        active.forEach { try { it.close() } catch (_: Exception) { } }
    }
}

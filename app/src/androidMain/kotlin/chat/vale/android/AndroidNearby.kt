package chat.vale.android

import android.annotation.SuppressLint
import android.content.Context
import chat.vale.core.MAX_PACKET_SIZE
import chat.vale.core.NearbyLink
import chat.vale.core.ReceiptCollector
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Nearby selects Bluetooth/BLE and Wi-Fi; signed packets remain end-to-end encrypted. */
@SuppressLint("MissingPermission")
internal class AndroidNearby(
    context: Context,
    private val onPacket: (String, Int) -> String?,
    private val onStatus: (Int, String) -> Unit,
) : NearbyLink {
    private val client = Nearby.getConnectionsClient(context.applicationContext)
    private val peers = ConcurrentHashMap.newKeySet<String>()
    private val requesting = ConcurrentHashMap.newKeySet<String>()
    private val awaiting = ConcurrentHashMap<String, ReceiptCollector>()
    private val assemblies = HashMap<String, Assembly>()
    private val pool = ThreadPoolExecutor(2, 10, 30, TimeUnit.SECONDS, ArrayBlockingQueue(64)) { task ->
        Thread(task, "vale-nearby").apply { isDaemon = true }
    }
    @Volatile private var closed = false
    @Volatile private var started = false

    private class Assembly(val count: Int, val hops: Int, val createdAt: Long = System.currentTimeMillis()) {
        val chunks = arrayOfNulls<ByteArray>(count)
        var size = 0
        var received = 0
    }

    fun start() {
        if (closed || started) return
        started = true
        val strategy = Strategy.P2P_CLUSTER
        client.startAdvertising("Vale", SERVICE, connectionLifecycle, AdvertisingOptions.Builder().setStrategy(strategy).build())
            .addOnSuccessListener { report("Поиск устройств") }
            .addOnFailureListener { report("Не удалось включить обнаружение") }
        client.startDiscovery(SERVICE, discovery, DiscoveryOptions.Builder().setStrategy(strategy).build())
            .addOnSuccessListener { report("Поиск устройств") }
            .addOnFailureListener { report("Не удалось найти устройства") }
    }

    fun permissionDenied() { report("Разрешения для Nearby не предоставлены") }

    private val discovery = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            if (closed || peers.size >= MAX_PEERS || !requesting.add(endpointId)) return
            client.requestConnection("Vale", endpointId, connectionLifecycle)
                .addOnFailureListener { requesting.remove(endpointId) }
        }
        override fun onEndpointLost(endpointId: String) { requesting.remove(endpointId) }
    }
    private val connectionLifecycle = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            if (closed || peers.size >= MAX_PEERS) { client.rejectConnection(endpointId); return }
            // Peer identity is not trusted here: every app packet is signed by an added contact.
            client.acceptConnection(endpointId, payloadCallback)
        }
        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            requesting.remove(endpointId)
            if (!closed && result.status.statusCode == ConnectionsStatusCodes.STATUS_OK) peers.add(endpointId)
            report(if (peers.isEmpty()) "Поиск устройств" else "Рядом: ${peers.size}")
        }
        override fun onDisconnected(endpointId: String) {
            peers.remove(endpointId); requesting.remove(endpointId)
            awaiting.values.forEach { it.respond(endpointId, null) }
            report(if (peers.isEmpty()) "Поиск устройств" else "Рядом: ${peers.size}")
        }
    }
    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (closed || payload.type != Payload.Type.BYTES) return
            val bytes = payload.asBytes() ?: return
            if (bytes.size !in 22..(CHUNK + HEADER)) return
            if (!bytes.copyOfRange(0, 4).contentEquals(MAGIC)) return
            val id = encodeId(bytes.copyOfRange(5, 21))
            if (bytes[4].toInt() == ACK) {
                if (bytes.size == 22 && bytes[21].toInt() == 0) awaiting[id]?.respond(endpointId, null)
                else if (bytes.size in 23..150 && bytes[21].toInt() == 1) {
                    val receipt = String(bytes, 22, bytes.size - 22, Charsets.US_ASCII)
                    awaiting[id]?.respond(endpointId, receipt)
                }
                return
            }
            if (bytes[4].toInt() != DATA || bytes.size < HEADER) return
            val hops = bytes[21].toInt() and 0xff
            val total = ((bytes[22].toInt() and 0xff) shl 8) or (bytes[23].toInt() and 0xff)
            val index = ((bytes[24].toInt() and 0xff) shl 8) or (bytes[25].toInt() and 0xff)
            if (hops !in 0..3 || total !in 1..MAX_CHUNKS || index !in 0 until total) return
            val piece = bytes.copyOfRange(HEADER, bytes.size)
            if (piece.isEmpty() || (index != total - 1 && piece.size != CHUNK)) return
            var complete: ByteArray? = null
            synchronized(assemblies) {
                val now = System.currentTimeMillis()
                assemblies.entries.removeAll { now - it.value.createdAt > 90_000 }
                val key = endpointId + ":" + id
                var assembly = assemblies[key]
                if (assembly == null) {
                    if (assemblies.size >= MAX_ASSEMBLIES) return
                    assembly = Assembly(total, hops)
                    assemblies[key] = assembly
                }
                if (assembly.count != total || assembly.hops != hops) { assemblies.remove(key); return }
                if (assembly.chunks[index] == null) {
                    assembly.chunks[index] = piece; assembly.size += piece.size; assembly.received++
                }
                if (assembly.size > MAX_PACKET_SIZE) { assemblies.remove(key); return }
                if (assembly.received == total) {
                    val output = ByteArrayOutputStream(assembly.size)
                    assembly.chunks.forEach { output.write(it!!) }
                    complete = output.toByteArray()
                    assemblies.remove(key)
                }
            }
            complete?.let { body ->
                try {
                    pool.execute {
                        val receipt = try { onPacket(String(body, Charsets.UTF_8), hops) } catch (_: Exception) { null }
                        if (!closed) sendAck(endpointId, bytes.copyOfRange(5, 21), receipt)
                    }
                } catch (_: Exception) { }
            }
        }
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) { }
    }

    private fun sendAck(endpoint: String, id: ByteArray, receipt: String?) {
        val proof = receipt?.toByteArray(Charsets.US_ASCII)?.takeIf { it.size in 1..128 }
        val frame = ByteBuffer.allocate(22 + (proof?.size ?: 0)).put(MAGIC).put(ACK.toByte()).put(id)
            .put(if (proof != null) 1.toByte() else 0.toByte()).apply { if (proof != null) put(proof) }.array()
        try { client.sendPayload(endpoint, Payload.fromBytes(frame)) } catch (_: Exception) { }
    }

    override fun send(packet: String, hops: Int, verify: (String) -> Boolean): String? {
        if (closed || hops !in 0..3) return null
        val destinations = peers.toList().take(MAX_PEERS)
        val body = packet.toByteArray(Charsets.UTF_8)
        if (destinations.isEmpty() || body.size !in 1..MAX_PACKET_SIZE) return null
        val requestId = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val key = encodeId(requestId)
        val collector = ReceiptCollector(destinations, verify)
        awaiting[key] = collector
        return try {
            val total = (body.size + CHUNK - 1) / CHUNK
            for (endpoint in destinations) {
                for (index in 0 until total) {
                    if (closed) return null
                    val start = index * CHUNK
                    val length = minOf(CHUNK, body.size - start)
                    val frame = ByteBuffer.allocate(HEADER + length).put(MAGIC).put(DATA.toByte()).put(requestId)
                        .put(hops.toByte()).putShort(total.toShort()).putShort(index.toShort()).put(body, start, length).array()
                    client.sendPayload(endpoint, Payload.fromBytes(frame)).addOnFailureListener { collector.respond(endpoint, null) }
                }
            }
            collector.await(75)
        } catch (_: Exception) { null }
        finally { awaiting.remove(key) }
    }

    private fun report(message: String) { if (!closed) onStatus(peers.size, message) }

    override fun close() {
        if (closed) return
        closed = true
        try { client.stopDiscovery(); client.stopAdvertising(); client.stopAllEndpoints() } catch (_: Exception) { }
        awaiting.values.forEach { it.cancel() }; awaiting.clear()
        peers.clear(); requesting.clear(); synchronized(assemblies) { assemblies.clear() }
        pool.shutdownNow()
    }

    private fun encodeId(id: ByteArray) = Base64.getUrlEncoder().withoutPadding().encodeToString(id)
    companion object {
        private const val SERVICE = "chat.vale.app.mesh.v1"
        private val MAGIC = byteArrayOf(0x56, 0x41, 0x4c, 0x32)
        private const val HEADER = 26
        private const val CHUNK = 24_000
        private const val DATA = 1
        private const val ACK = 2
        private const val MAX_CHUNKS = (MAX_PACKET_SIZE + CHUNK - 1) / CHUNK
        private const val MAX_ASSEMBLIES = 8
        private const val MAX_PEERS = 6
    }
}

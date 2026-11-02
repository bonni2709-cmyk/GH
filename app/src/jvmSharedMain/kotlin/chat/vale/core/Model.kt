package chat.vale.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

internal val json = Json { ignoreUnknownKeys = false; encodeDefaults = true }

@Serializable
internal data class Identity(val name: String, val publicKey: String, val secretKey: String)

@Serializable
internal data class Contact(val id: String, val name: String, val address: String = "")

@Serializable
internal data class Message(
    val id: String,
    val contactId: String,
    val text: String,
    val outgoing: Boolean,
    val createdAt: Long,
    val expiresAt: Long,
    // A pending encrypted packet remains in the encrypted database until acknowledged.
    val pendingPacket: String? = null,
    val kind: String = "text",
    val media: String = "",
    val mime: String = "",
    val durationMs: Long = 0,
)

@Serializable
internal data class Vault(
    val identity: Identity? = null,
    val contacts: List<Contact> = emptyList(),
    val messages: List<Message> = emptyList(),
    // Timestamp is when the packet was created, not when its message disappears.
    val seen: Map<String, Long> = emptyMap(),
    val expirySeconds: Long = 0,
    val relayEnabled: Boolean = false,
    val panicMode: Boolean = false,
    val nearbyEnabled: Boolean = false,
    val torEnabled: Boolean = false,
    val controls: List<PendingControl> = emptyList(),
)

@Serializable
internal data class Packet(
    val version: Int = 1,
    val id: String,
    val from: String,
    val to: String,
    val createdAt: Long,
    val expiresAt: Long,
    val nonce: String,
    val ciphertext: String,
    val signature: String,
)

interface EncryptedStore {
    fun read(): String?
    fun write(value: String)
    fun close()
}

interface NearbyLink {
    fun send(packet: String, hops: Int, verify: (String) -> Boolean): String?
    fun close()
}

interface TorHandle { fun close() }

interface PlatformBridge {
    val mobile: Boolean
    fun copyText(value: String)
    fun scanQr(onResult: (String?) -> Unit)
    fun clearCache()
    fun setDisguised(enabled: Boolean)
    /** Opens only a user-initiated loopback media page in the system browser. */
    fun openLocalPage(url: String): Boolean = false
    fun startNearby(onPacket: (String, Int) -> String?, onStatus: (Int, String) -> Unit): NearbyLink? = null
    fun startTor(localPort: Int, socksPort: Int, onStatus: (String, String) -> Unit): TorHandle? = null
}

/** Encrypted application body; wire headers still contain only routing metadata. */
@Serializable
internal data class Content(
    val kind: String,
    val text: String = "",
    val media: String = "",
    val mime: String = "",
    val durationMs: Long = 0,
    val callId: String = "",
    val sdp: String = "",
    val video: Boolean = false,
)

@Serializable
internal data class PendingControl(
    val id: String,
    val contactId: String,
    val packet: String,
    val createdAt: Long,
    val expiresAt: Long,
)

internal const val CONTENT_PREFIX = "VALE-CONTENT-2:"
internal const val MAX_MEDIA_BYTES = 768_000
internal const val MAX_MEDIA_TOTAL_BYTES = 40_000_000

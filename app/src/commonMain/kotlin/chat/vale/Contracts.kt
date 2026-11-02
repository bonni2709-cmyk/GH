package chat.vale

import kotlinx.coroutines.flow.StateFlow

data class ContactView(val id: String, val name: String, val address: String)
data class MessageView(
    val id: String,
    val contactId: String,
    val text: String,
    val outgoing: Boolean,
    val createdAt: Long,
    val expiresAt: Long,
    val pending: Boolean,
    val kind: String = "text",
    val durationMs: Long = 0,
)

data class QrGrid(val size: Int, val cells: BooleanArray) {
    operator fun get(x: Int, y: Int): Boolean = cells[y * size + x]
}

data class CallView(
    val contactId: String,
    val incoming: Boolean,
    val video: Boolean,
    val status: String,
)

data class ValeState(
    val loading: Boolean = true,
    val fatalError: String? = null,
    val profileName: String? = null,
    val publicId: String = "",
    val localAddress: String = "",
    val contacts: List<ContactView> = emptyList(),
    val messages: List<MessageView> = emptyList(),
    val selectedContact: String? = null,
    val expirySeconds: Long = 0,
    val relayEnabled: Boolean = false,
    val networkAvailable: Boolean = false,
    val panic: Boolean = false,
    val call: CallView? = null,
    val error: String? = null,
)

/** UI knows no platform APIs or private key material. */
interface ValeController {
    val state: StateFlow<ValeState>
    val isMobile: Boolean
    fun createProfile(name: String)
    fun addContact(name: String, idOrQr: String, address: String)
    fun removeContact(id: String)
    fun selectContact(id: String?)
    fun sendMessage(text: String)
    fun sendSticker(emoji: String)
    fun openMediaStudio()
    fun openMedia(messageId: String)
    fun mediaBytes(messageId: String): ByteArray?
    fun startCall(video: Boolean)
    fun acceptCall()
    fun declineCall()
    fun endCall()
    fun setExpiry(seconds: Long)
    fun setRelay(enabled: Boolean)
    fun copyText(value: String)
    fun scanQr(onResult: (String?) -> Unit)
    fun qrGrid(value: String): QrGrid?
    fun contactCard(): String
    fun formatTime(timestamp: Long): String
    fun panic()
    fun restore()
    fun dismissError()
    fun close()
}

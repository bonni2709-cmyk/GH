package chat.vale.core

import chat.vale.ContactView
import chat.vale.MessageView
import chat.vale.QrGrid
import chat.vale.ValeController
import chat.vale.ValeState
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.goterl.lazysodium.LazySodium
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

private const val SEEN_RETENTION = 8L * 24 * 60 * 60 * 1000
private const val MAX_SEEN = 10_000
private const val MAX_CONTACTS = 500
private const val MAX_MESSAGES = 10_000

/** Shared Android/JVM implementation. Every mutation is committed before it is published. */
class Engine(
    sodium: LazySodium,
    private val platform: PlatformBridge,
    private val storeFactory: () -> EncryptedStore,
    private val listenPort: Int = DEFAULT_PORT,
) : ValeController {
    private val crypto = Crypto(sodium)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()
    private val mutable = MutableStateFlow(ValeState())
    override val state: StateFlow<ValeState> = mutable
    override val isMobile get() = platform.mobile
    @Volatile private var vault = Vault()
    @Volatile private var store: EncryptedStore? = null
    @Volatile private var transport: LanTransport? = null
    @Volatile private var panicJob: Job? = null
    private val inFlight = ConcurrentHashMap.newKeySet<String>()
    private val relayed = ConcurrentHashMap.newKeySet<String>()

    init {
        scope.launch {
            try {
                val db = storeFactory()
                store = db
                val decoded = db.read()?.let { json.decodeFromString<Vault>(it) } ?: Vault()
                require(decoded.identity == null || crypto.validIdentity(decoded.identity)) { "Ключ профиля повреждён" }
                mutex.withLock { vault = decoded }
                mutable.update { it.copy(loading = false, localAddress = LanTransport.localAddress(), panic = decoded.panicMode) }
                publish()
                if (decoded.identity != null && !decoded.panicMode) startNetwork()
                while (true) {
                    delay(8_000)
                    if (!mutable.value.panic) {
                        cleanExpired()
                        retryPending()
                    }
                }
            } catch (e: Exception) {
                // Do not log exception messages, which may contain private data or file paths.
                System.err.println("VALE: storage startup failed (${e.javaClass.simpleName})")
                mutable.update { it.copy(loading = false, fatalError = "Не удалось открыть защищённое хранилище. Проверьте доступ к профилю устройства; данные не были сброшены.") }
            }
        }
    }

    override fun createProfile(name: String) {
        val clean = name.trim().take(40)
        if (clean.isBlank()) { error("Укажите имя профиля"); return }
        scope.launch {
            try {
                mutate { old ->
                    require(old.identity == null) { "Профиль уже создан" }
                    old.copy(identity = crypto.generateIdentity(clean))
                }
                startNetwork()
            } catch (_: Exception) { error("Не удалось создать профиль") }
        }
    }

    override fun addContact(name: String, idOrQr: String, address: String) {
        scope.launch {
            try {
                val parts = idOrQr.trim().split('|')
                val id = if (parts.firstOrNull() == "vale1" && parts.size in 2..3) parts[1] else idOrQr.trim()
                val host = address.trim().ifEmpty { if (parts.firstOrNull() == "vale1") parts.getOrNull(2).orEmpty() else "" }
                require(crypto.isPublicKey(id)) { "Некорректный публичный ID" }
                require(host.isEmpty() || LanTransport.validEndpoint(host)) { "Укажите локальный IPv4-адрес, например 192.168.1.20" }
                val safeName = name.trim().take(40).ifEmpty { "Контакт ${id.take(5)}" }
                mutate { old ->
                    require(old.identity != null && id != old.identity.publicKey) { "Нельзя добавить собственный ID" }
                    require(old.contacts.size < MAX_CONTACTS || old.contacts.any { it.id == id }) { "Слишком много контактов" }
                    old.copy(contacts = old.contacts.filterNot { it.id == id } + Contact(id, safeName, host))
                }
                mutable.update { it.copy(selectedContact = id) }
                retryPending()
            } catch (e: Exception) { error(e.message ?: "Не удалось добавить контакт") }
        }
    }

    override fun removeContact(id: String) {
        scope.launch {
            try {
                mutate { it.copy(contacts = it.contacts.filterNot { c -> c.id == id }, messages = it.messages.filterNot { m -> m.contactId == id }) }
                mutable.update { it.copy(selectedContact = if (it.selectedContact == id) null else it.selectedContact) }
            } catch (_: Exception) { error("Не удалось удалить контакт") }
        }
    }

    override fun selectContact(id: String?) { mutable.update { it.copy(selectedContact = id) } }

    override fun sendMessage(text: String) {
        val contact = mutable.value.selectedContact ?: return
        val content = text.trim()
        if (content.isEmpty()) return
        scope.launch {
            try {
                mutate { old ->
                    val identity = requireNotNull(old.identity)
                    require(old.contacts.any { it.id == contact })
                    require(old.messages.size < MAX_MESSAGES) { "Достигнут лимит истории" }
                    val packet = crypto.seal(identity, contact, content, old.expirySeconds, System.currentTimeMillis())
                    old.copy(messages = old.messages + Message(packet.id, contact, content, true,
                        packet.createdAt, packet.expiresAt, json.encodeToString(packet)))
                }
                retryPending()
            } catch (e: Exception) { error(e.message ?: "Не удалось отправить сообщение") }
        }
    }

    override fun setExpiry(seconds: Long) {
        if (seconds !in setOf(0L, 60L, 3600L, 86400L, 604800L)) return
        scope.launch { try { mutate { it.copy(expirySeconds = seconds) } } catch (_: Exception) { error("Не удалось сохранить настройку") } }
    }

    override fun setRelay(enabled: Boolean) {
        scope.launch { try { mutate { it.copy(relayEnabled = enabled) } } catch (_: Exception) { error("Не удалось сохранить настройку") } }
    }

    private suspend fun mutate(block: (Vault) -> Vault) = mutex.withLock {
        val next = block(vault)
        requireNotNull(store).write(json.encodeToString(next))
        vault = next
        publish()
    }

    private fun publish() {
        val current = vault
        mutable.update { old ->
            if (old.panic || current.panicMode) old.copy(panic = true, profileName = null, publicId = "", contacts = emptyList(), messages = emptyList())
            else old.copy(
                profileName = current.identity?.name,
                publicId = current.identity?.publicKey.orEmpty(),
                contacts = current.contacts.map { ContactView(it.id, it.name, it.address) },
                messages = current.messages.map { MessageView(it.id, it.contactId, it.text, it.outgoing, it.createdAt, it.expiresAt, it.pendingPacket != null) },
                expirySeconds = current.expirySeconds,
                relayEnabled = current.relayEnabled,
            )
        }
    }

    private fun startNetwork() {
        if (transport != null || mutable.value.panic || vault.identity == null) return
        val candidate = LanTransport(listenPort) { packet, hops -> runBlocking { receive(packet, hops) } }
        if (candidate.start()) {
            transport = candidate
            mutable.update { it.copy(networkAvailable = true) }
        } else {
            candidate.close()
            mutable.update { it.copy(networkAvailable = false) }
        }
    }

    private suspend fun receive(encoded: String, hops: Int): Boolean {
        if (mutable.value.panic) return false
        val packet = try { json.decodeFromString<Packet>(encoded) } catch (_: Exception) { return false }
        val now = System.currentTimeMillis()
        if (!crypto.verify(packet, now)) return false
        val snapshot = vault
        val me = snapshot.identity ?: return false
        // A sender must be explicitly added before their packets are processed or relayed.
        if (snapshot.contacts.none { it.id == packet.from }) return false
        if (packet.to == me.publicKey) {
            if (snapshot.seen.containsKey(packet.id)) return true
            val text = crypto.open(me, packet, now) ?: return false
            return try {
                mutex.withLock {
                    val old = vault
                    if (old.seen.containsKey(packet.id)) return@withLock true
                    if (old.seen.size >= MAX_SEEN || old.messages.size >= MAX_MESSAGES || old.panicMode) return@withLock false
                    val next = old.copy(
                        messages = old.messages + Message(packet.id, packet.from, text, false, packet.createdAt, packet.expiresAt),
                        seen = old.seen + (packet.id to packet.createdAt),
                    )
                    requireNotNull(store).write(json.encodeToString(next))
                    vault = next
                    publish()
                    true
                }
            } catch (_: Exception) { false }
        }
        // Opt-in relay: both endpoints have to be known to this node. No plaintext is available.
        if (!snapshot.relayEnabled || hops <= 0 || snapshot.contacts.none { it.id == packet.to }) return false
        if (relayed.contains(packet.id)) return true
        if (!inFlight.add(packet.id)) return false
        return try {
            val addresses = snapshot.contacts.filter { it.id == packet.to }.map { it.address } +
                snapshot.contacts.filter { it.id != packet.to && it.id != packet.from }.map { it.address }
            val sent = addresses.filter { it.isNotBlank() }.distinct().take(4).any { LanTransport.send(it, encoded, hops - 1) }
            if (sent) {
                if (relayed.size > MAX_SEEN) relayed.clear()
                relayed.add(packet.id)
            }
            sent
        } finally { inFlight.remove(packet.id) }
    }

    private suspend fun retryPending() {
        if (mutable.value.panic || transport == null) return
        val snapshot = vault
        val now = System.currentTimeMillis()
        for (message in snapshot.messages.filter { it.pendingPacket != null }.take(30)) {
            if (mutable.value.panic) return
            if (message.expiresAt != 0L && message.expiresAt <= now) continue
            if (message.createdAt < now - 7L * 24 * 60 * 60 * 1000) continue
            val target = snapshot.contacts.firstOrNull { it.id == message.contactId } ?: continue
            val routes = listOf(target.address) + snapshot.contacts.filter { it.id != target.id }.map { it.address }
            val sent = routes.filter { it.isNotBlank() }.distinct().take(5).any { LanTransport.send(it, message.pendingPacket!!) }
            if (sent) {
                try { mutate { old -> old.copy(messages = old.messages.map { if (it.id == message.id) it.copy(pendingPacket = null) else it }) } }
                catch (_: Exception) { /* Retrying a delivered packet is safe: recipients deduplicate. */ }
            }
        }
    }

    private suspend fun cleanExpired() {
        val now = System.currentTimeMillis()
        val snapshot = vault
        if (snapshot.messages.none { it.expiresAt != 0L && it.expiresAt <= now } && snapshot.seen.values.none { it < now - SEEN_RETENTION }) return
        try { mutate { old -> old.copy(messages = old.messages.filterNot { it.expiresAt != 0L && it.expiresAt <= now }, seen = old.seen.filterValues { it >= now - SEEN_RETENTION }) } }
        catch (_: Exception) { error("Не удалось очистить устаревшие сообщения") }
    }

    override fun copyText(value: String) = platform.copyText(value)
    override fun scanQr(onResult: (String?) -> Unit) = platform.scanQr(onResult)
    override fun qrGrid(value: String): QrGrid? = try {
        val qr = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 0, 0, mapOf(EncodeHintType.MARGIN to 2))
        QrGrid(qr.width, BooleanArray(qr.width * qr.height) { i -> qr[i % qr.width, i / qr.width] })
    } catch (_: Exception) { null }
    override fun contactCard(): String = "vale1|${vault.identity?.publicKey.orEmpty()}|${mutable.value.localAddress}"
    override fun formatTime(timestamp: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(timestamp)

    override fun panic() {
        if (mutable.value.panic) return
        mutable.update { it.copy(panic = true, profileName = null, publicId = "", contacts = emptyList(), messages = emptyList(), selectedContact = null, networkAvailable = false) }
        transport?.close(); transport = null
        platform.clearCache()
        panicJob = scope.launch {
            try { mutate { it.copy(panicMode = true) }; platform.setDisguised(true) }
            catch (_: Exception) { error("Не удалось сохранить режим скрытия") }
        }
    }
    override fun restore() {
        scope.launch {
            panicJob?.join()
            try {
                mutate { it.copy(panicMode = false) }
                platform.setDisguised(false)
                mutable.update { it.copy(panic = false) }
                publish()
                startNetwork()
            } catch (_: Exception) { error("Не удалось вернуться в Vale") }
        }
    }
    override fun dismissError() { mutable.update { it.copy(error = null) } }
    private fun error(message: String) { mutable.update { it.copy(error = message) } }
    override fun close() {
        transport?.close(); transport = null
        scope.cancel()
        try { store?.close() } catch (_: Exception) { }
    }
}

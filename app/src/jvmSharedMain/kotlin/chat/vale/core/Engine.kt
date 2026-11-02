package chat.vale.core

import chat.vale.ContactView
import chat.vale.CallView
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
import java.security.SecureRandom
import java.net.ServerSocket
import java.net.InetAddress
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
    private val retryMutex = Mutex()
    private val mutable = MutableStateFlow(ValeState())
    override val state: StateFlow<ValeState> = mutable
    override val isMobile get() = platform.mobile
    @Volatile private var vault = Vault()
    @Volatile private var store: EncryptedStore? = null
    @Volatile private var transport: LanTransport? = null
    @Volatile private var nearby: NearbyLink? = null
    @Volatile private var tor: TorHandle? = null
    @Volatile private var torSocksPort: Int = 0
    @Volatile private var networkTransition: Boolean = false
    @Volatile private var panicJob: Job? = null
    private val inFlight = ConcurrentHashMap.newKeySet<String>()
    private val relayed = ConcurrentHashMap<String, String>()
    private val browserLock = Any()
    @Volatile private var browser: MediaServer? = null
    @Volatile private var call: CallSession? = null

    private data class CallSession(
        val id: String, val contactId: String, val video: Boolean,
        val incoming: Boolean, val offer: String = "",
        @Volatile var server: MediaServer? = null,
    )

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
                require(host.isEmpty() || LanTransport.validEndpoint(host) || TorTransport.validEndpoint(host)) { "Укажите локальный IPv4 или адрес .onion v3" }
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

    override fun sendSticker(emoji: String) {
        val target = mutable.value.selectedContact ?: return
        val content = Content(kind = "sticker-emoji", text = emoji)
        if (!validContent(content)) return
        scope.launch { sendRich(target, content) }
    }

    private suspend fun sendRich(target: String, content: Content): Boolean {
        if (!validContent(content) || content.kind !in setOf("sticker", "sticker-emoji", "audio", "video")) return false
        return try {
            mutate { old ->
                val identity = requireNotNull(old.identity)
                require(!old.panicMode && old.contacts.any { it.id == target })
                require(old.messages.size < MAX_MESSAGES) { "Достигнут лимит истории" }
                require(old.messages.sumOf { it.media.length.toLong() } + content.media.length <= MAX_MEDIA_TOTAL_BYTES) { "Достигнут лимит медиахранилища" }
                val packet = crypto.seal(identity, target, encodeContent(content), old.expirySeconds, System.currentTimeMillis())
                old.copy(messages = old.messages + Message(packet.id, target, if (content.kind == "sticker-emoji") content.text else mediaLabel(content.kind), true,
                    packet.createdAt, packet.expiresAt, json.encodeToString(packet), content.kind, content.media, content.mime, content.durationMs))
            }
            scope.launch { retryPending() }
            true
        } catch (e: Exception) { error(e.message ?: "Не удалось отправить медиа"); false }
    }

    override fun mediaBytes(messageId: String): ByteArray? = try {
        if (mutable.value.panic) null else vault.messages.firstOrNull { it.id == messageId && it.media.isNotEmpty() }?.media?.unb64()
    } catch (_: Exception) { null }

    override fun openMediaStudio() {
        val target = mutable.value.selectedContact ?: return
        val name = vault.contacts.firstOrNull { it.id == target }?.name ?: return
        if (call != null) { error("Завершите звонок, прежде чем открывать медиа"); return }
        openBrowser(BrowserConfig(mode = "studio", contact = name)) { request ->
            if (request.action != "submit") false
            else runBlocking { sendRich(target, Content(kind = request.kind, media = request.media, mime = request.mime, durationMs = request.durationMs)) }
        }
    }

    override fun openMedia(messageId: String) {
        if (call != null) { error("Завершите звонок, прежде чем открывать медиа"); return }
        val message = vault.messages.firstOrNull { it.id == messageId } ?: return
        if (message.kind !in setOf("audio", "video", "sticker")) return
        val bytes = mediaBytes(messageId) ?: return
        val type = when (message.kind) {
            "audio" -> "audio/webm"
            "video" -> if (message.mime.lowercase().startsWith("video/mp4")) "video/mp4" else "video/webm"
            else -> message.mime.takeIf { it in setOf("image/png", "image/webp", "image/jpeg") } ?: return
        }
        openBrowser(BrowserConfig(mode = "play", mediaType = message.kind), bytes, type) { false }
    }

    private fun openBrowser(config: BrowserConfig, bytes: ByteArray? = null, type: String = "application/octet-stream", handler: (BrowserRequest) -> Boolean): MediaServer? {
        return try {
            val next = MediaServer(config, bytes, type, handler)
            synchronized(browserLock) { browser?.close(); browser = next }
            if (!platform.openLocalPage(next.url)) {
                synchronized(browserLock) { if (browser === next) browser = null }
                next.close(); error("Не удалось открыть системный браузер"); null
            } else next
        } catch (_: Exception) { error("Не удалось открыть медиа"); null }
    }

    override fun startCall(video: Boolean) {
        val target = mutable.value.selectedContact ?: return
        if (call != null) { error("Другой звонок уже открыт"); return }
        if (vault.torEnabled || networkTransition) { error("WebRTC-звонки идут напрямую и отключены в режиме Tor, чтобы не раскрывать IP"); return }
        val session = CallSession(ByteArray(16).also { SecureRandom().nextBytes(it) }.b64(), target, video, false)
        call = session
        mutable.update { it.copy(call = CallView(target, false, video, "Откройте звонок в браузере")) }
        if (!openCallBrowser(session)) finishCall(session, false)
    }

    override fun acceptCall() {
        val session = call ?: return
        if (!session.incoming || session.server != null) return
        mutable.update { it.copy(call = CallView(session.contactId, false, session.video, "Подключение в браузере")) }
        if (!openCallBrowser(session)) finishCall(session, true)
    }

    override fun declineCall() { call?.let { finishCall(it, true) } }
    override fun endCall() { call?.let { finishCall(it, true) } }

    private fun openCallBrowser(session: CallSession): Boolean {
        val name = vault.contacts.firstOrNull { it.id == session.contactId }?.name ?: return false
        val config = BrowserConfig(mode = "call", contact = name, video = session.video,
            role = if (session.incoming) "answer" else "offer", offer = session.offer)
        val server = openBrowser(config) { request ->
            if (call !== session || mutable.value.panic) false else when (request.action) {
                "offer", "answer" -> {
                    val kind = if (request.action == "offer") "call-offer" else "call-answer"
                    val allowed = (request.action == "offer" && !session.incoming) || (request.action == "answer" && session.incoming)
                    allowed && runBlocking { queueControl(session.contactId, Content(kind, callId = session.id, sdp = request.sdp, video = session.video)) }
                }
                "connected" -> { mutable.update { it.copy(call = CallView(session.contactId, false, session.video, "Соединение установлено")) }; true }
                "hangup" -> { finishCall(session, true); true }
                else -> false
            }
        } ?: return false
        session.server = server
        return true
    }

    private fun finishCall(session: CallSession, notify: Boolean) {
        synchronized(browserLock) {
            if (call !== session) return
            call = null
        }
        session.server?.push(BrowserEvent("end"))
        mutable.update { it.copy(call = null) }
        if (notify && !mutable.value.panic) scope.launch { queueControl(session.contactId, Content("call-end", callId = session.id)) }
        val server = session.server
        if (server != null) scope.launch {
            delay(4_000)
            synchronized(browserLock) { if (browser === server) browser = null }
            server.close()
        }
    }

    private suspend fun queueControl(target: String, content: Content): Boolean {
        if (!validContent(content)) return false
        return try {
            mutate { old ->
                require(!old.panicMode && old.contacts.any { it.id == target })
                require(old.controls.size < 32) { "Очередь сигналов переполнена" }
                val packet = crypto.seal(requireNotNull(old.identity), target, encodeContent(content), 60L, System.currentTimeMillis())
                old.copy(controls = old.controls + PendingControl(packet.id, target, json.encodeToString(packet), packet.createdAt, packet.expiresAt))
            }
            scope.launch { retryPending() }
            true
        } catch (_: Exception) { error("Не удалось передать сигнал звонка"); false }
    }

    override fun setExpiry(seconds: Long) {
        if (seconds !in setOf(0L, 60L, 3600L, 86400L, 604800L)) return
        scope.launch { try { mutate { it.copy(expirySeconds = seconds) } } catch (_: Exception) { error("Не удалось сохранить настройку") } }
    }

    override fun setRelay(enabled: Boolean) {
        scope.launch { try { mutate { it.copy(relayEnabled = enabled) } } catch (_: Exception) { error("Не удалось сохранить настройку") } }
    }

    override fun setNearby(enabled: Boolean) {
        if (!isMobile && enabled) { error("Nearby доступен только на Android"); return }
        scope.launch {
            try {
                mutate { it.copy(nearbyEnabled = enabled) }
                if (enabled) startNearby() else stopNearby()
            } catch (_: Exception) { error("Не удалось изменить настройки Nearby") }
        }
    }

    private fun startNearby() {
        if (nearby != null || mutable.value.panic || vault.identity == null || !vault.nearbyEnabled || vault.torEnabled) return
        mutable.update { it.copy(nearbyStatus = "Запуск…") }
        nearby = platform.startNearby(
            { packet, hops -> runBlocking { receive(packet, hops) } },
            { count, status -> mutable.update { it.copy(nearbyPeers = count, nearbyStatus = status) } },
        )
        if (nearby == null) mutable.update { it.copy(nearbyStatus = "Недоступно") }
    }

    private fun stopNearby() {
        nearby?.close(); nearby = null
        mutable.update { it.copy(nearbyPeers = 0, nearbyStatus = "Выключено") }
    }

    override fun setTor(enabled: Boolean) {
        if (vault.torEnabled == enabled || networkTransition) return
        // Block new sends before asynchronously changing the persistent policy.
        networkTransition = true
        scope.launch {
            try {
                if (enabled) call?.let { finishCall(it, false) }
                transport?.close(); transport = null
                stopNearby(); stopTor()
                mutate { it.copy(torEnabled = enabled, controls = emptyList()) }
                startNetwork()
            } catch (_: Exception) { error("Не удалось изменить настройки Tor") }
            finally { networkTransition = false }
        }
    }

    private fun startTor() {
        if (!vault.torEnabled || mutable.value.panic || tor != null) return
        try {
            val port = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1")).use { it.localPort }
            torSocksPort = port
            mutable.update { it.copy(torStatus = "Запуск Tor…", torOnion = "") }
            tor = platform.startTor(listenPort, port) { onion, status ->
                val safe = onion.takeIf { TorTransport.validEndpoint(it) }.orEmpty()
                if (vault.torEnabled && !mutable.value.panic) mutable.update { it.copy(torOnion = safe, torStatus = status) }
            }
            if (tor == null) { torSocksPort = 0; mutable.update { it.copy(torStatus = "Tor недоступен") } }
        } catch (_: Exception) { torSocksPort = 0; mutable.update { it.copy(torStatus = "Tor недоступен") } }
    }

    private fun stopTor() {
        tor?.close(); tor = null; torSocksPort = 0
        mutable.update { it.copy(torOnion = "", torStatus = "Выключено") }
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
                messages = current.messages.map { MessageView(it.id, it.contactId, it.text, it.outgoing, it.createdAt, it.expiresAt, it.pendingPacket != null, it.kind, it.durationMs) },
                expirySeconds = current.expirySeconds,
                relayEnabled = current.relayEnabled,
                nearbyEnabled = current.nearbyEnabled,
                torEnabled = current.torEnabled,
            )
        }
    }

    private fun startNetwork() {
        if (transport != null || mutable.value.panic || vault.identity == null) return
        val candidate = LanTransport(listenPort, loopbackOnly = vault.torEnabled) { packet, hops -> runBlocking { receive(packet, hops) } }
        if (candidate.start()) {
            transport = candidate
            mutable.update { it.copy(networkAvailable = true) }
        } else {
            candidate.close()
            mutable.update { it.copy(networkAvailable = false) }
        }
        if (transport != null) { if (vault.torEnabled) startTor() else startNearby() }
    }

    private suspend fun receive(encoded: String, hops: Int): String? {
        if (mutable.value.panic || networkTransition) return null
        val packet = try { json.decodeFromString<Packet>(encoded) } catch (_: Exception) { return null }
        val now = System.currentTimeMillis()
        if (!crypto.verify(packet, now)) return null
        val snapshot = vault
        val me = snapshot.identity ?: return null
        val seenKey = packet.from + ":" + packet.id
        val relayKey = seenKey + ":" + packet.to
        // A sender must be explicitly added before their packets are processed or relayed.
        if (snapshot.contacts.none { it.id == packet.from }) return null
        if (packet.to == me.publicKey) {
            if (snapshot.seen.containsKey(seenKey)) return try { crypto.signReceipt(me, packet) } catch (_: Exception) { null }
            val plaintext = crypto.open(me, packet, now) ?: return null
            val content = decodeContent(plaintext) ?: return null
            val control = content.kind.startsWith("call-")
            if (control && (packet.expiresAt == 0L || packet.expiresAt - packet.createdAt > 60_000)) return null
            return try {
                val accepted = mutex.withLock {
                    val old = vault
                    if (old.seen.containsKey(seenKey)) return@withLock true
                    if (old.seen.size >= MAX_SEEN || old.panicMode) return@withLock false
                    if (control && !canAcceptControl(packet.from, content)) return@withLock false
                    if (!control && (old.messages.size >= MAX_MESSAGES || old.messages.sumOf { it.media.length.toLong() } + content.media.length > MAX_MEDIA_TOTAL_BYTES)) return@withLock false
                    val messages = if (control) old.messages else old.messages + Message(packet.id, packet.from,
                        if (content.kind == "text" || content.kind == "sticker-emoji") content.text else mediaLabel(content.kind),
                        false, packet.createdAt, packet.expiresAt, kind = content.kind, media = content.media, mime = content.mime, durationMs = content.durationMs)
                    val next = old.copy(messages = messages, seen = old.seen + (seenKey to packet.createdAt))
                    requireNotNull(store).write(json.encodeToString(next))
                    vault = next
                    publish()
                    if (control) applyControl(packet.from, content)
                    true
                }
                if (accepted) crypto.signReceipt(me, packet) else null
            } catch (_: Exception) { null }
        }
        // Opt-in relay: forward only an authenticated destination receipt, never plaintext.
        if (!snapshot.relayEnabled || hops <= 0 || snapshot.contacts.none { it.id == packet.to }) return null
        relayed[relayKey]?.let { return it }
        if (!inFlight.add(relayKey)) return null
        return try {
            val receipt = transmit(snapshot, packet.to, packet.from, encoded, hops - 1)
            if (receipt != null) {
                if (relayed.size > MAX_SEEN) relayed.clear()
                relayed[relayKey] = receipt
            }
            receipt
        } finally { inFlight.remove(relayKey) }
    }

    private fun canAcceptControl(from: String, content: Content): Boolean = when (content.kind) {
        "call-offer" -> call == null && !vault.torEnabled
        "call-answer" -> call?.let { !it.incoming && it.contactId == from && it.id == content.callId && it.server != null } == true
        "call-end" -> call?.let { it.contactId == from && it.id == content.callId } == true
        else -> false
    }

    private fun applyControl(from: String, content: Content) {
        when (content.kind) {
            "call-offer" -> {
                call = CallSession(content.callId, from, content.video, true, content.sdp)
                mutable.update { it.copy(call = CallView(from, true, content.video, "Входящий звонок")) }
            }
            "call-answer" -> {
                call?.server?.push(BrowserEvent("answer", content.sdp))
                mutable.update { it.copy(call = it.call?.copy(status = "Подключение")) }
            }
            "call-end" -> call?.let { finishCall(it, false) }
        }
    }

    private fun transmit(snapshot: Vault, targetId: String, senderId: String?, encoded: String, hops: Int): String? {
        if (mutable.value.panic || networkTransition || snapshot.torEnabled != vault.torEnabled) return null
        val packet = try { json.decodeFromString<Packet>(encoded) } catch (_: Exception) { return null }
        if (packet.to != targetId) return null
        fun verified(receipt: String?): String? = receipt?.takeIf { crypto.verifyReceipt(packet, it) }
        val direct = snapshot.contacts.firstOrNull { it.id == targetId }?.address.orEmpty()
        val candidates = snapshot.contacts.asSequence().filter { it.id != targetId && it.id != senderId }
            .map { it.address }.filter { it.isNotBlank() && it != direct }.distinct().take(4)
        if (snapshot.torEnabled) {
            if (torSocksPort == 0) return null
            if (direct.isNotBlank()) verified(TorTransport.sendReceipt(direct, torSocksPort, encoded, hops))?.let { return it }
            for (address in candidates) verified(TorTransport.sendReceipt(address, torSocksPort, encoded, hops))?.let { return it }
            return null
        }
        if (direct.isNotBlank()) verified(LanTransport.sendReceipt(direct, encoded, hops))?.let { return it }
        verified(nearby?.send(encoded, hops))?.let { return it }
        for (address in candidates) verified(LanTransport.sendReceipt(address, encoded, hops))?.let { return it }
        return null
    }

    private suspend fun retryPending() {
        if (mutable.value.panic || (transport == null && nearby == null) || !retryMutex.tryLock()) return
        try {
            val snapshot = vault
            val now = System.currentTimeMillis()
            for (control in snapshot.controls.take(32)) {
                if (mutable.value.panic) return
                if (control.expiresAt <= now) continue
                val target = snapshot.contacts.firstOrNull { it.id == control.contactId } ?: continue
                val sent = transmit(snapshot, target.id, null, control.packet, 3)
                if (sent != null) try { mutate { old -> old.copy(controls = old.controls.filterNot { it.id == control.id }) } } catch (_: Exception) { }
            }
            for (message in snapshot.messages.filter { it.pendingPacket != null }.take(30)) {
                if (mutable.value.panic) return
                if (message.expiresAt != 0L && message.expiresAt <= now) continue
                if (message.createdAt < now - 7L * 24 * 60 * 60 * 1000) continue
                val target = snapshot.contacts.firstOrNull { it.id == message.contactId } ?: continue
                val sent = transmit(snapshot, target.id, null, message.pendingPacket!!, 3)
                if (sent != null) {
                    try { mutate { old -> old.copy(messages = old.messages.map { if (it.id == message.id) it.copy(pendingPacket = null) else it }) } }
                    catch (_: Exception) { /* Retrying a delivered packet is safe: recipients deduplicate. */ }
                }
            }
        } finally { retryMutex.unlock() }
    }

    private suspend fun cleanExpired() {
        val now = System.currentTimeMillis()
        val snapshot = vault
        if (snapshot.messages.none { it.expiresAt != 0L && it.expiresAt <= now } && snapshot.seen.values.none { it < now - SEEN_RETENTION } && snapshot.controls.none { it.expiresAt <= now }) return
        try { mutate { old -> old.copy(messages = old.messages.filterNot { it.expiresAt != 0L && it.expiresAt <= now }, seen = old.seen.filterValues { it >= now - SEEN_RETENTION }, controls = old.controls.filter { it.expiresAt > now }) } }
        catch (_: Exception) { error("Не удалось очистить устаревшие сообщения") }
    }

    override fun copyText(value: String) = platform.copyText(value)
    override fun scanQr(onResult: (String?) -> Unit) = platform.scanQr(onResult)
    override fun qrGrid(value: String): QrGrid? = try {
        val qr = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 0, 0, mapOf(EncodeHintType.MARGIN to 2))
        QrGrid(qr.width, BooleanArray(qr.width * qr.height) { i -> qr[i % qr.width, i / qr.width] })
    } catch (_: Exception) { null }
    override fun contactCard(): String = "vale1|${vault.identity?.publicKey.orEmpty()}|${if (vault.torEnabled) mutable.value.torOnion else mutable.value.localAddress}"
    override fun formatTime(timestamp: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(timestamp)

    override fun panic() {
        if (mutable.value.panic) return
        mutable.update { it.copy(panic = true, profileName = null, publicId = "", contacts = emptyList(), messages = emptyList(), selectedContact = null, networkAvailable = false, call = null) }
        call = null
        synchronized(browserLock) { browser?.close(); browser = null }
        transport?.close(); transport = null
        stopNearby(); stopTor()
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
        call = null
        synchronized(browserLock) { browser?.close(); browser = null }
        transport?.close(); transport = null
        stopNearby(); stopTor()
        scope.cancel()
        try { store?.close() } catch (_: Exception) { }
    }
}

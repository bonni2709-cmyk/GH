package chat.vale.core

import com.goterl.lazysodium.LazySodium
import java.nio.charset.StandardCharsets
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

internal const val MAX_MESSAGE_BYTES = 1_100_000
private const val WEEK_MS = 7L * 24 * 60 * 60 * 1000
private const val CLOCK_SKEW_MS = 5L * 60 * 1000

internal fun ByteArray.b64(): String = Base64.getUrlEncoder().withoutPadding().encodeToString(this)
internal fun String.unb64(): ByteArray = Base64.getUrlDecoder().decode(this)

/** Primitives from libsodium; the protocol is deliberately versioned and not an audited standard. */
internal class Crypto(private val sodium: LazySodium) {
    fun generateIdentity(name: String): Identity {
        val publicKey = ByteArray(32)
        val secretKey = ByteArray(64)
        check(sodium.cryptoSignKeypair(publicKey, secretKey)) { "Не удалось создать ключи" }
        return Identity(name, publicKey.b64(), secretKey.b64())
    }

    fun isPublicKey(value: String): Boolean = try {
        val bytes = value.unb64()
        bytes.size == 32 && bytes.b64() == value && sodium.convertPublicKeyEd25519ToCurve25519(ByteArray(32), bytes)
    } catch (_: Exception) { false }

    fun validIdentity(identity: Identity): Boolean = try {
        val secret = identity.secretKey.unb64()
        val pub = identity.publicKey.unb64()
        secret.size == 64 && pub.size == 32 && secret.copyOfRange(32, 64).contentEquals(pub) && isPublicKey(identity.publicKey)
    } catch (_: Exception) { false }

    fun seal(identity: Identity, recipient: String, text: String, expirySeconds: Long, now: Long): Packet {
        require(validIdentity(identity) && isPublicKey(recipient) && identity.publicKey != recipient)
        val plaintext = text.toByteArray(StandardCharsets.UTF_8)
        require(plaintext.isNotEmpty() && plaintext.size <= MAX_MESSAGE_BYTES)
        require(expirySeconds in setOf(0L, 60L, 3600L, 86400L, 604800L))
        val id = sodium.randomBytesBuf(16).b64()
        val nonce = sodium.randomBytesBuf(24)
        val expires = if (expirySeconds == 0L) 0L else now + expirySeconds * 1000L
        val unsigned = Packet(id = id, from = identity.publicKey, to = recipient, createdAt = now,
            expiresAt = expires, nonce = nonce.b64(), ciphertext = "", signature = "")
        val aad = header(unsigned)
        val ciphertext = ByteArray(plaintext.size + 16)
        val length = LongArray(1)
        val key = deriveKey(identity.secretKey, recipient, identity.publicKey, recipient)
        try {
            check(sodium.cryptoAeadXChaCha20Poly1305IetfEncrypt(ciphertext, length, plaintext,
                plaintext.size.toLong(), aad, aad.size.toLong(), null, nonce, key))
        } finally { key.fill(0) }
        val packet = unsigned.copy(ciphertext = ciphertext.copyOf(length[0].toInt()).b64())
        val signed = signedBytes(packet)
        val signature = ByteArray(64)
        check(sodium.cryptoSignDetached(signature, signed, signed.size.toLong(), identity.secretKey.unb64()))
        return packet.copy(signature = signature.b64())
    }

    /** Validate signature and strict size/time limits before doing any decryption or relaying. */
    fun verify(packet: Packet, now: Long): Boolean = try {
        if (packet.version != 1 || packet.id.unb64().size != 16 || packet.id.unb64().b64() != packet.id ||
            !isPublicKey(packet.from) || !isPublicKey(packet.to) || packet.from == packet.to ||
            packet.nonce.unb64().size != 24 || packet.signature.unb64().size != 64 ||
            packet.ciphertext.unb64().size !in 17..(MAX_MESSAGE_BYTES + 16) ||
            packet.createdAt < now - WEEK_MS || packet.createdAt > now + CLOCK_SKEW_MS ||
            (packet.expiresAt != 0L && (packet.expiresAt <= now || packet.expiresAt < packet.createdAt || packet.expiresAt - packet.createdAt > WEEK_MS))) {
            false
        } else {
            val signed = signedBytes(packet)
            sodium.cryptoSignVerifyDetached(packet.signature.unb64(), signed, signed.size, packet.from.unb64())
        }
    } catch (_: Exception) { false }

    fun open(identity: Identity, packet: Packet, now: Long): String? {
        return try {
        if (packet.to != identity.publicKey || !validIdentity(identity) || !verify(packet, now)) return null
        val cipher = packet.ciphertext.unb64()
        val plaintext = ByteArray(cipher.size - 16)
        val length = LongArray(1)
        val aad = header(packet)
        val key = deriveKey(identity.secretKey, packet.from, packet.from, packet.to)
        val ok = try {
            sodium.cryptoAeadXChaCha20Poly1305IetfDecrypt(plaintext, length, null, cipher,
                cipher.size.toLong(), aad, aad.size.toLong(), packet.nonce.unb64(), key)
        } finally { key.fill(0) }
        if (!ok) null else String(plaintext, 0, length[0].toInt(), StandardCharsets.UTF_8)
        } catch (_: Exception) { null }
    }

    /** A network relay cannot forge this receipt without the recipient's Ed25519 key. */
    fun signReceipt(identity: Identity, packet: Packet): String {
        require(identity.publicKey == packet.to && validIdentity(identity))
        val message = receiptBytes(packet)
        val signature = ByteArray(64)
        check(sodium.cryptoSignDetached(signature, message, message.size.toLong(), identity.secretKey.unb64()))
        return signature.b64()
    }

    fun verifyReceipt(packet: Packet, receipt: String): Boolean = try {
        val signature = receipt.unb64()
        signature.size == 64 && signature.b64() == receipt && isPublicKey(packet.to) &&
            sodium.cryptoSignVerifyDetached(signature, receiptBytes(packet), receiptBytes(packet).size, packet.to.unb64())
    } catch (_: Exception) { false }

    private fun receiptBytes(packet: Packet): ByteArray =
        "VALE receipt v1\n${packet.id}\n${packet.from}\n${packet.to}".toByteArray(StandardCharsets.UTF_8)

    private fun deriveKey(secret: String, otherPublic: String, from: String, to: String): ByteArray {
        val curvePublic = ByteArray(32)
        val curveSecret = ByteArray(32)
        val shared = ByteArray(32)
        check(sodium.convertPublicKeyEd25519ToCurve25519(curvePublic, otherPublic.unb64()))
        check(sodium.convertSecretKeyEd25519ToCurve25519(curveSecret, secret.unb64()))
        check(sodium.cryptoBoxBeforeNm(shared, curvePublic, curveSecret))
        curveSecret.fill(0)
        return try {
            val hmac = Mac.getInstance("HmacSHA256")
            hmac.init(SecretKeySpec(shared, "HmacSHA256"))
            hmac.doFinal("VALE message key v1\n$from\n$to".toByteArray(StandardCharsets.UTF_8))
        } finally { shared.fill(0) }
    }

    private fun header(p: Packet): ByteArray = listOf("VALE/1", p.id, p.from, p.to,
        p.createdAt.toString(), p.expiresAt.toString()).joinToString("\n").toByteArray(StandardCharsets.UTF_8)
    private fun signedBytes(p: Packet): ByteArray = header(p) + "\n${p.nonce}\n${p.ciphertext}".toByteArray(StandardCharsets.UTF_8)
}

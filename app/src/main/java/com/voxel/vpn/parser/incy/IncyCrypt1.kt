package com.voxel.vpn.parser.incy

import com.voxel.vpn.model.Hashing
import com.voxel.vpn.parser.Base64Codec
import com.voxel.vpn.parser.LinkUri
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.security.GeneralSecurityException
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Why an INCY link could not be turned into something importable. */
class IncyLinkException(val kind: Kind, message: String) : Exception(message) {
    enum class Kind { MALFORMED, EMPTY, UNSUPPORTED_VERSION, AUTH_FAILED, UNSUPPORTED }
}

/** The decrypted content of an `incy://crypt1/...` link. */
data class Crypt1Payload(val url: String, val name: String?, val version: Int)

/**
 * `incy://crypt1/{payload}` - the obfuscated subscription link of the INCY client.
 *
 * Wire format: `base64url(iv[12] || AES-256-GCM ciphertext || tag[16])`, plaintext is the compact
 * JSON `{"n":"name","url":"...","v":1}`. The key is `SHA-256("incy" "deep" "crypt1" "v2026.06" || A || B)`
 * where A and B are 32-byte slices of the published INCY key-material assets (offsets 1024 and 2048).
 * This is the published scheme of the open-source `incy-link-encoder` (MIT): obfuscation, not secrecy.
 * The derived key is checked against the published SHA-256 fingerprint before first use.
 */
object IncyCrypt1 {
    const val LINK_PREFIX = "incy://crypt1/"
    const val KEY_FINGERPRINT = "b6bf708471cc90043232967660aade86a50b4e57929db2e53c5fa34db624c08c"

    private const val IV_LEN = 12
    private const val TAG_LEN = 16
    private const val MAX_NAME_CODE_POINTS = 128

    private const val KEY_MATERIAL_A = "ee876a063af704d7b409f1910d9731cc1419081ec08993a01270556873e1ef2d"
    private const val KEY_MATERIAL_B = "cf510df43b2ab97ea98478eee5f1b1cf80e3a484fc9369316ccd87e54b7997b7"

    private val random = SecureRandom()

    private val key: ByteArray by lazy {
        val seed = "incy".toByteArray() + "deep".toByteArray() + "crypt1".toByteArray() + "v2026.06".toByteArray() +
            hexToBytes(KEY_MATERIAL_A) + hexToBytes(KEY_MATERIAL_B)
        val derived = Hashing.sha256(seed)
        check(Hashing.toHex(Hashing.sha256(derived)) == KEY_FINGERPRINT) { "INCY crypt1 key fingerprint mismatch" }
        derived
    }

    /** Decrypts a bare payload (the part after `incy://crypt1/`). Tolerates `/`, whitespace, padding, `?query` and `#fragment`. */
    fun decode(payload: String): Crypt1Payload {
        var p = payload.filter { !it.isWhitespace() }
        p.indexOfAny(charArrayOf('?', '#')).let { if (it >= 0) p = p.substring(0, it) }
        p = p.trimEnd('/')
        if (p.contains('%')) p = LinkUri.percentDecode(p)
        if (p.isEmpty()) throw IncyLinkException(IncyLinkException.Kind.EMPTY, "The crypt1 link has no payload")

        val wire = Base64Codec.decode(p)
            ?: throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "The crypt1 payload is not valid Base64")
        if (wire.size < IV_LEN + TAG_LEN + 1) {
            throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "The crypt1 payload is too short")
        }

        val plain = try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_LEN * 8, wire, 0, IV_LEN))
            cipher.doFinal(wire, IV_LEN, wire.size - IV_LEN)
        } catch (e: GeneralSecurityException) {
            throw IncyLinkException(IncyLinkException.Kind.AUTH_FAILED, "The crypt1 link is damaged or was not made for this scheme")
        }

        val text = Base64Codec.utf8OrNull(plain)
            ?: throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "The crypt1 content is not valid text")
        val obj = runCatching { Json.parseToJsonElement(text) }.getOrNull() as? JsonObject
            ?: throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "The crypt1 content is not a JSON object")
        val url = (obj["url"] as? JsonPrimitive)?.contentOrNull?.trim().orEmpty()
        if (url.isEmpty()) throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "The crypt1 content has no url")
        val name = (obj["n"] as? JsonPrimitive)?.contentOrNull?.trim()?.ifEmpty { null }
        val version = (obj["v"] as? JsonPrimitive)?.contentOrNull?.toIntOrNull() ?: 1
        return Crypt1Payload(url, name, version)
    }

    /** Builds `incy://crypt1/...` for [url]. [iv] is for reproducible tests only; leave it out otherwise. */
    fun encode(url: String, name: String? = null, iv: ByteArray = ByteArray(IV_LEN).also { random.nextBytes(it) }): String {
        require(url.isNotEmpty()) { "url must not be empty" }
        require(iv.size == IV_LEN) { "iv must be $IV_LEN bytes" }
        val json = StringBuilder("{")
        if (!name.isNullOrEmpty()) {
            val cut = if (name.codePointCount(0, name.length) > MAX_NAME_CODE_POINTS) {
                name.substring(0, name.offsetByCodePoints(0, MAX_NAME_CODE_POINTS))
            } else {
                name
            }
            json.append("\"n\":").append(JsonPrimitive(cut).toString()).append(',')
        }
        json.append("\"url\":").append(JsonPrimitive(url).toString()).append(",\"v\":1}")

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_LEN * 8, iv))
        val sealed = cipher.doFinal(json.toString().toByteArray(Charsets.UTF_8))
        return LINK_PREFIX + Base64Codec.encodeUrlSafe(iv + sealed)
    }

    /** Verifies the embedded key material; used by tests and diagnostics. */
    fun keyFingerprint(): String = Hashing.toHex(Hashing.sha256(key))

    private fun hexToBytes(hex: String): ByteArray = ByteArray(hex.length / 2) { i ->
        ((Character.digit(hex[i * 2], 16) shl 4) or Character.digit(hex[i * 2 + 1], 16)).toByte()
    }
}

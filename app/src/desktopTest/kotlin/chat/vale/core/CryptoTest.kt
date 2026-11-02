package chat.vale.core

import com.goterl.lazysodium.LazySodiumJava
import com.goterl.lazysodium.SodiumJava
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CryptoTest {
    private val crypto = Crypto(LazySodiumJava(SodiumJava()))
    private val now = System.currentTimeMillis()

    @Test fun roundTripAndAuthentication() {
        val alice = crypto.generateIdentity("Alice")
        val bob = crypto.generateIdentity("Bob")
        val outsider = crypto.generateIdentity("Mallory")
        assertTrue(crypto.validIdentity(alice))
        assertTrue(crypto.isPublicKey(bob.publicKey))
        assertFalse(crypto.isPublicKey("not-a-valid-key"))
        val packet = crypto.seal(alice, bob.publicKey, "Привет, Vale 🌿", 60, now)
        assertTrue(crypto.verify(packet, now))
        assertEquals("Привет, Vale 🌿", crypto.open(bob, packet, now))
        val receipt = crypto.signReceipt(bob, packet)
        assertTrue(crypto.verifyReceipt(packet, receipt))
        assertFalse(crypto.verifyReceipt(packet.copy(id = crypto.seal(alice, bob.publicKey, "other", 0, now).id), receipt))
        assertFalse(crypto.verifyReceipt(packet.copy(to = outsider.publicKey), receipt))
        assertFalse(crypto.verifyReceipt(packet, (if (receipt[0] == 'A') "B" else "A") + receipt.substring(1)))
        assertNull(crypto.open(outsider, packet, now))
        assertNull(crypto.open(alice, packet, now))
        assertFalse(crypto.verify(packet.copy(to = outsider.publicKey), now))
        assertFalse(crypto.verify(packet.copy(createdAt = packet.createdAt + 1), now))
        assertFalse(crypto.verify(packet.copy(ciphertext = (if (packet.ciphertext[0] == 'A') "B" else "A") + packet.ciphertext.substring(1)), now))
        assertFalse(crypto.verify(packet, now + 60_001))
    }

    @Test fun randomNoncesAndDirection() {
        val alice = crypto.generateIdentity("Alice")
        val bob = crypto.generateIdentity("Bob")
        val a = crypto.seal(alice, bob.publicKey, "same text", 0, now)
        val b = crypto.seal(alice, bob.publicKey, "same text", 0, now)
        assertNotEquals(a.nonce, b.nonce)
        assertNotEquals(a.ciphertext, b.ciphertext)
        assertEquals("same text", crypto.open(bob, a, now))
        val reply = crypto.seal(bob, alice.publicKey, "reply", 0, now)
        assertEquals("reply", crypto.open(alice, reply, now))
        assertFalse(crypto.verify(a.copy(version = 2), now))
        assertFalse(crypto.verify(a.copy(from = bob.publicKey), now))
    }
}

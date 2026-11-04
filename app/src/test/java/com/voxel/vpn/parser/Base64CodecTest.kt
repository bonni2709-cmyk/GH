package com.voxel.vpn.parser

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Random

class Base64CodecTest {
    @Test
    fun decodesPaddedAndUnpaddedStandard() {
        assertEquals("any carnal pleas", Base64Codec.decodeToString("YW55IGNhcm5hbCBwbGVhcw=="))
        assertEquals("any carnal pleas", Base64Codec.decodeToString("YW55IGNhcm5hbCBwbGVhcw"))
        assertEquals("any carnal pleasu", Base64Codec.decodeToString("YW55IGNhcm5hbCBwbGVhc3U="))
        assertEquals("any carnal pleasur", Base64Codec.decodeToString("YW55IGNhcm5hbCBwbGVhc3Vy"))
    }

    @Test
    fun acceptsBothAlphabets() {
        val expected = byteArrayOf(0xfb.toByte(), 0xff.toByte(), 0xfe.toByte())
        assertArrayEquals(expected, Base64Codec.decode("+//+"))
        assertArrayEquals(expected, Base64Codec.decode("-__-"))
    }

    @Test
    fun ignoresWhitespaceAndLineWraps() {
        assertEquals("any carnal pleas", Base64Codec.decodeToString("YW55IGNh\r\ncm5hbCBw\n bGVhcw=="))
    }

    @Test
    fun rejectsInvalidInput() {
        assertNull(Base64Codec.decode(""))
        assertNull(Base64Codec.decode("===="))
        assertNull(Base64Codec.decode("YW55!"))
        assertNull(Base64Codec.decode("A")) // a single sextet cannot form a byte
        assertNull(Base64Codec.decode("YW55IGNhcm5hbCBwbGVhcw==x"))
        assertNull(Base64Codec.decodeToString("/w")) // 0xff is not valid UTF-8
    }

    @Test
    fun roundTripsAgainstTheJdkEncoder() {
        val random = Random(42)
        for (length in 0..40) {
            val bytes = ByteArray(length).also { random.nextBytes(it) }
            val std = java.util.Base64.getEncoder().encodeToString(bytes)
            assertEquals(std, Base64Codec.encodeStandard(bytes))
            assertEquals(java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes), Base64Codec.encodeUrlSafe(bytes))
            if (length > 0) {
                assertArrayEquals(bytes, Base64Codec.decode(std))
                assertArrayEquals(bytes, Base64Codec.decode(Base64Codec.encodeUrlSafe(bytes)))
            }
        }
    }

    @Test
    fun looksLikeBase64() {
        assertTrue(Base64Codec.looksLikeBase64("YW55IGNhcm5hbCBwbGVhcw=="))
        assertTrue(Base64Codec.looksLikeBase64("YW55IGNh\ncm5hbCBw"))
        assertFalse(Base64Codec.looksLikeBase64("vless://abc@host:443"))
        assertFalse(Base64Codec.looksLikeBase64("ab"))
        assertFalse(Base64Codec.looksLikeBase64("{\"a\":1}"))
    }
}

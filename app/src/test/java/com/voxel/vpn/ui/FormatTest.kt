package com.voxel.vpn.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class FormatTest {
    @Test
    fun bytesPickTheUnitAndPrecision() {
        assertEquals("0 B", Format.bytes(0))
        assertEquals("0 B", Format.bytes(-5))
        assertEquals("512 B", Format.bytes(512))
        assertEquals("1.00 KB", Format.bytes(1024))
        assertEquals("1.50 KB", Format.bytes(1536))
        assertEquals("10.0 MB", Format.bytes(10L * 1024 * 1024))
        assertEquals("123 MB", Format.bytes(123L * 1024 * 1024))
        assertEquals("5.00 GB", Format.bytes(5L * 1024 * 1024 * 1024))
        assertEquals("2.00 TB", Format.bytes(2L * 1024 * 1024 * 1024 * 1024))
        assertEquals("1.50 KB/s", Format.speed(1536))
    }

    @Test
    fun durationsRollOverToHours() {
        assertEquals("00:00", Format.duration(0))
        assertEquals("00:00", Format.duration(-1000))
        assertEquals("00:07", Format.duration(7_000))
        assertEquals("59:59", Format.duration(3_599_999))
        assertEquals("1:02:03", Format.duration(3_723_000))
        assertEquals("30:00:00", Format.duration(30L * 3600 * 1000))
    }

    @Test
    fun daysLeftRoundsUpAndGoesNegativeAfterExpiry() {
        val now = 1_000_000L
        assertEquals(0, Format.daysLeft(now, now))
        assertEquals(1, Format.daysLeft(now + 1, now))
        assertEquals(1, Format.daysLeft(now + 86_400, now))
        assertEquals(2, Format.daysLeft(now + 86_401, now))
        assertEquals(30, Format.daysLeft(now + 30L * 86_400, now))
        assertEquals(-1, Format.daysLeft(now - 1, now))
        assertEquals(-2, Format.daysLeft(now - 86_401, now))
    }

    @Test
    fun percentIsClamped() {
        assertEquals(0, Format.percent(10, 0))
        assertEquals(0, Format.percent(-10, 100))
        assertEquals(50, Format.percent(50, 100))
        assertEquals(100, Format.percent(500, 100))
        assertEquals(33, Format.percent(1, 3))
    }
}

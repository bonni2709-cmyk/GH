package com.voxel.vpn.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConnectionHubTest {
    @Test
    fun speedMeterReportsRatesOverTheElapsedInterval() {
        val meter = SpeedMeter()
        val first = meter.update(1000, 5000, nowMs = 10_000)
        assertEquals(TrafficSnapshot(1000, 5000, 0, 0), first)
        val second = meter.update(1000 + 2048, 5000 + 10_000, nowMs = 12_000)
        assertEquals(1024L, second.uploadBps)
        assertEquals(5000L, second.downloadBps)
        assertEquals(3048L, second.uploadBytes)
        // A shorter interval scales the rate accordingly.
        val third = meter.update(3048 + 500, 15_000, nowMs = 12_500)
        assertEquals(1000L, third.uploadBps)
        assertEquals(0L, third.downloadBps)
    }

    @Test
    fun aCounterThatWentBackwardsCountsAsIdleNotNegative() {
        val meter = SpeedMeter()
        meter.update(10_000, 10_000, 1_000)
        val after = meter.update(50, 70, 2_000)
        assertEquals(0L, after.uploadBps)
        assertEquals(0L, after.downloadBps)
        assertEquals(50L, after.uploadBytes)
    }

    @Test
    fun aClockThatDidNotAdvanceDoesNotDivideByZero() {
        val meter = SpeedMeter()
        meter.update(0, 0, 5_000)
        val same = meter.update(100, 100, 5_000)
        assertEquals(0L, same.uploadBps)
    }

    @Test
    fun stateFlags() {
        assertTrue(ConnectionState.Connecting("a").isActive)
        assertTrue(ConnectionState.Connected("a", 0).isActive)
        assertFalse(ConnectionState.Idle.isActive)
        assertFalse(ConnectionState.Failed("x").isActive)
        assertFalse(ConnectionState.Disconnecting.isActive)
        assertTrue(ConnectionState.Connecting("a").isBusy)
        assertTrue(ConnectionState.Disconnecting.isBusy)
        assertFalse(ConnectionState.Connected("a", 0).isBusy)
    }

    @Test
    fun trafficIsOnlyKeptWhileConnected() {
        val hub = ConnectionHub()
        hub.setTraffic(TrafficSnapshot(1, 2, 3, 4))
        assertEquals(TrafficSnapshot(), hub.traffic.value)

        hub.set(ConnectionState.Connected("srv", 7))
        hub.setTraffic(TrafficSnapshot(1, 2, 3, 4))
        assertEquals(TrafficSnapshot(1, 2, 3, 4), hub.traffic.value)

        hub.set(ConnectionState.Disconnecting)
        assertEquals(TrafficSnapshot(), hub.traffic.value)
        assertEquals(ConnectionState.Disconnecting, hub.state.value)

        hub.set(ConnectionState.Failed("boom"))
        assertEquals(ConnectionState.Failed("boom"), hub.state.value)
    }
}

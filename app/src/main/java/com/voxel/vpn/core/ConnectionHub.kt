package com.voxel.vpn.core

import com.voxel.vpn.dpi.DpiStats
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface ConnectionState {
    data object Idle : ConnectionState

    data class Connecting(val serverName: String) : ConnectionState

    data class Connected(val serverName: String, val sinceMs: Long) : ConnectionState

    data object Disconnecting : ConnectionState

    data class Failed(val message: String) : ConnectionState
}

/** The VPN is up or on its way up. */
val ConnectionState.isActive: Boolean
    get() = this is ConnectionState.Connecting || this is ConnectionState.Connected

/** A transition is in progress: the connect button must not react. */
val ConnectionState.isBusy: Boolean
    get() = this is ConnectionState.Connecting || this is ConnectionState.Disconnecting

/** Traffic of the current session: totals and the rate over the last interval, in bytes. */
data class TrafficSnapshot(
    val uploadBytes: Long = 0L,
    val downloadBytes: Long = 0L,
    val uploadBps: Long = 0L,
    val downloadBps: Long = 0L,
)

/** Turns cumulative byte counters into rates. A counter that went backwards (core restart) counts as zero. */
class SpeedMeter {
    private var lastUp = 0L
    private var lastDown = 0L
    private var lastAt = -1L

    fun update(uploadBytes: Long, downloadBytes: Long, nowMs: Long): TrafficSnapshot {
        val snapshot = if (lastAt < 0 || nowMs <= lastAt) {
            TrafficSnapshot(uploadBytes, downloadBytes)
        } else {
            val elapsed = nowMs - lastAt
            TrafficSnapshot(
                uploadBytes,
                downloadBytes,
                rate(uploadBytes - lastUp, elapsed),
                rate(downloadBytes - lastDown, elapsed),
            )
        }
        lastUp = uploadBytes
        lastDown = downloadBytes
        lastAt = nowMs
        return snapshot
    }

    private fun rate(delta: Long, elapsedMs: Long): Long = if (delta <= 0) 0 else delta * 1000 / elapsedMs
}

/** Shared between the VPN service (writer) and the UI (reader); both live in the same process. */
class ConnectionHub {
    private val connection = MutableStateFlow<ConnectionState>(ConnectionState.Idle)
    private val usage = MutableStateFlow(TrafficSnapshot())
    private val dpiUsage = MutableStateFlow<DpiStats?>(null)

    val state: StateFlow<ConnectionState> = connection.asStateFlow()
    val traffic: StateFlow<TrafficSnapshot> = usage.asStateFlow()

    /** Counters of the DPI engine; null while it is not running. */
    val dpi: StateFlow<DpiStats?> = dpiUsage.asStateFlow()

    fun set(next: ConnectionState) {
        if (next !is ConnectionState.Connected) {
            usage.value = TrafficSnapshot()
            dpiUsage.value = null
        }
        connection.value = next
    }

    fun setTraffic(snapshot: TrafficSnapshot) {
        if (connection.value is ConnectionState.Connected) usage.value = snapshot
    }

    fun setDpi(stats: DpiStats?) {
        if (connection.value is ConnectionState.Connected) dpiUsage.value = stats
    }
}

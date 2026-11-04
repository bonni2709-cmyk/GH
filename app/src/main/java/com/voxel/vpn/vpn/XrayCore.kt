package com.voxel.vpn.vpn

import com.voxel.vpn.core.LogBus
import voxelcore.LogSink
import voxelcore.Voxelcore

/** The Kotlin face of the gomobile binding (`voxelcore.aar`): Xray-core running on a TUN descriptor. */
object XrayCore {
    /** Counters of the tun inbound: bytes the apps sent / received through the tunnel. */
    const val STAT_UPLINK = "inbound>>>tun>>>traffic>>>uplink"
    const val STAT_DOWNLINK = "inbound>>>tun>>>traffic>>>downlink"

    @Volatile
    private var logsAttached = false

    /** Routes the core's log lines into [logs]. Safe to call repeatedly. */
    fun attachLogs(logs: LogBus) {
        if (logsAttached) return
        Voxelcore.setLogSink(object : LogSink {
            override fun onLog(line: String?) {
                logs.core(line)
            }
        })
        logsAttached = true
    }

    fun version(): String = Voxelcore.version()

    /** Throws when the core would not accept [config]. Does not start anything and needs no TUN. */
    fun validate(config: String) {
        Voxelcore.validateConfig(config)
    }

    /** Starts the core on [tunFd]; the core duplicates the descriptor, the caller keeps its own. */
    fun start(config: String, tunFd: Int, assetDir: String) {
        Voxelcore.start(config, tunFd.toLong(), assetDir)
    }

    fun stop() {
        Voxelcore.stop()
    }

    fun isRunning(): Boolean = Voxelcore.isRunning()

    fun stat(name: String): Long = Voxelcore.queryStats(name, false)
}

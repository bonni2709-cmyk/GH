package com.voxel.vpn

import android.app.Application
import android.util.Log
import com.voxel.vpn.core.ConnectionHub
import com.voxel.vpn.core.LogBus
import com.voxel.vpn.core.LogLevel
import com.voxel.vpn.data.AppStore
import com.voxel.vpn.vpn.XrayCore
import java.io.File

/**
 * Process-wide singletons. The VPN service and the UI run in this one process and talk through them:
 * [store] holds the servers, [hub] the connection state, [logs] what the screens show as the journal.
 */
class VoxelApp : Application() {
    // Every line also goes to logcat (tag VOXEL), which is what `adb logcat -s VOXEL` shows.
    val logs = LogBus(
        mirror = { line ->
            val priority = when (line.level) {
                LogLevel.DEBUG -> Log.DEBUG
                LogLevel.INFO -> Log.INFO
                LogLevel.WARN -> Log.WARN
                LogLevel.ERROR -> Log.ERROR
            }
            Log.println(priority, "VOXEL", "${line.tag}: ${line.text}")
        },
    )
    val hub = ConnectionHub()

    lateinit var store: AppStore
        private set

    override fun onCreate() {
        super.onCreate()
        store = AppStore(File(filesDir, "voxel-data.json"))
        try {
            XrayCore.attachLogs(logs)
        } catch (t: Throwable) {
            // An unsupported CPU architecture must not take the whole app down; connecting will report it.
            logs.error("core", "The core library cannot be loaded: ${t.message ?: t.javaClass.simpleName}")
        }
    }
}

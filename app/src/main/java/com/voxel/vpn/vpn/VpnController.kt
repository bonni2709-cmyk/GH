package com.voxel.vpn.vpn

import android.content.Context
import android.content.Intent
import android.net.VpnService
import androidx.core.content.ContextCompat

/** What the UI uses to ask the service to connect or disconnect. */
object VpnController {
    const val ACTION_START = "com.voxel.vpn.action.START"
    const val ACTION_STOP = "com.voxel.vpn.action.STOP"
    const val EXTRA_SERVER_ID = "com.voxel.vpn.extra.SERVER_ID"

    /** The system consent screen to show, or null when the VPN permission is already granted. */
    fun permissionIntent(context: Context): Intent? = VpnService.prepare(context)

    /**
     * Connects to [serverId] (or to the selected server when null). While the VPN is already up, asking
     * for another server switches to it.
     */
    fun start(context: Context, serverId: String?) {
        val intent = Intent(context, VoxelVpnService::class.java).setAction(ACTION_START)
        if (serverId != null) intent.putExtra(EXTRA_SERVER_ID, serverId)
        ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
        val intent = Intent(context, VoxelVpnService::class.java).setAction(ACTION_STOP)
        try {
            context.startService(intent)
        } catch (e: IllegalStateException) {
            // The app is in the background and the service is not running: there is nothing to stop.
        }
    }
}

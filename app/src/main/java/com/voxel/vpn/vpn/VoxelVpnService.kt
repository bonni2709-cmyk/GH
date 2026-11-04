package com.voxel.vpn.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.voxel.vpn.MainActivity
import com.voxel.vpn.R
import com.voxel.vpn.VoxelApp
import com.voxel.vpn.core.ConnectionState
import com.voxel.vpn.core.CoreOptions
import com.voxel.vpn.core.SpeedMeter
import com.voxel.vpn.core.XrayConfigBuilder
import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.net.ChainHostResolver
import com.voxel.vpn.net.DohHostResolver
import com.voxel.vpn.net.SystemHostResolver
import com.voxel.vpn.ui.Format
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException

/**
 * The VPN: builds the Xray configuration for the chosen server, opens the TUN interface and hands its
 * descriptor to the core, which then runs the whole tunnel (the `tun` inbound of Xray-core).
 */
class VoxelVpnService : VpnService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val voxel: VoxelApp get() = application as VoxelApp

    private var session: Job? = null

    @Volatile
    private var tun: ParcelFileDescriptor? = null

    @Volatile
    private var currentServerId: String? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            VpnController.ACTION_STOP -> stopSession()
            // ACTION_START from the app, or android.net.VpnService when the system starts an always-on VPN.
            else -> startSession(intent?.getStringExtra(VpnController.EXTRA_SERVER_ID))
        }
        return START_NOT_STICKY
    }

    override fun onRevoke() {
        voxel.logs.warn("vpn", "The VPN permission was revoked")
        stopSession()
    }

    override fun onDestroy() {
        scope.cancel()
        // Only a session that is still running may be torn down: a finished one has cleaned up after itself,
        // and a successor service instance may own the core by now.
        if (tun != null || session?.isActive == true) {
            teardown()
            if (voxel.hub.state.value !is ConnectionState.Failed) voxel.hub.set(ConnectionState.Idle)
        }
        super.onDestroy()
    }

    private fun startSession(requestedId: String?) {
        val previous = session
        if (previous != null && previous.isActive) {
            val same = requestedId == null || requestedId == currentServerId
            if (same) return
        }
        val server = pickServer(requestedId)
        // startForegroundService() obliges the service to call startForeground() promptly, whatever happens next.
        showForeground(getString(R.string.notif_connecting, server?.name ?: getString(R.string.app_name)))
        if (voxel.hub.state.value is ConnectionState.Disconnecting) return
        session = scope.launch {
            if (previous != null) {
                previous.cancelAndJoin()
                teardown()
            }
            connect(server)
        }
    }

    private fun stopSession() {
        val running = session
        if (running == null) {
            voxel.hub.set(ConnectionState.Idle)
            finishService()
            return
        }
        voxel.hub.set(ConnectionState.Disconnecting)
        session = null
        scope.launch {
            running.cancelAndJoin()
            teardown()
            voxel.logs.info("vpn", "Disconnected")
            voxel.hub.set(ConnectionState.Idle)
            finishService()
        }
    }

    private fun pickServer(requestedId: String?): ServerProfile? {
        val data = voxel.store.data.value
        return data.server(requestedId) ?: data.server(data.settings.selectedServerId) ?: data.servers.firstOrNull()
    }

    private suspend fun connect(server: ServerProfile?) {
        val hub = voxel.hub
        val logs = voxel.logs
        try {
            if (server == null) throw IllegalStateException(getString(R.string.err_no_server))
            currentServerId = server.id
            hub.set(ConnectionState.Connecting(server.name))
            logs.info("vpn", "Connecting to ${server.name} (${server.protocol}/${server.network}/${server.security}, ${server.endpoint})")

            val settings = voxel.store.data.value.settings
            val resolved = resolveServerHosts(server, settings.ipv6)
            val config = XrayConfigBuilder.build(
                server,
                CoreOptions(ipv6 = settings.ipv6, logLevel = settings.logLevel, resolvedHosts = resolved),
            )
            withContext(Dispatchers.Default) { XrayCore.validate(config) }

            val pfd = establishTunnel() ?: throw IllegalStateException(getString(R.string.err_tun))
            tun = pfd
            try {
                withContext(Dispatchers.IO) { XrayCore.start(config, pfd.fd, filesDir.absolutePath) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                throw IllegalStateException(getString(R.string.err_core_failed, e.message ?: e.javaClass.simpleName), e)
            }

            hub.set(ConnectionState.Connected(server.name, System.currentTimeMillis()))
            logs.info("vpn", "Connected")
            notify(buildNotification(getString(R.string.notif_connected, server.name)))
            monitor(server)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            val message = e.message ?: e.javaClass.simpleName
            logs.error("vpn", message)
            teardown()
            hub.set(ConnectionState.Failed(message))
            finishService()
        }
    }

    /** Resolves the proxy server's host name up front, so the core never depends on the platform resolver to reach it. */
    private suspend fun resolveServerHosts(server: ServerProfile, ipv6: Boolean): Map<String, List<String>> {
        val hosts = XrayConfigBuilder.hostsToResolve(server)
        if (hosts.isEmpty()) return emptyMap()
        val resolver = ChainHostResolver(SystemHostResolver(), DohHostResolver())
        val resolved = LinkedHashMap<String, List<String>>()
        for (host in hosts) {
            val addresses = resolver.resolve(host, ipv6)
            if (addresses.isEmpty()) throw IllegalStateException(getString(R.string.err_host_unresolved, host))
            voxel.logs.info("vpn", "$host -> ${addresses.joinToString()}")
            resolved[host] = addresses
        }
        return resolved
    }

    private fun establishTunnel(): ParcelFileDescriptor? {
        val builder = Builder()
            .setSession(getString(R.string.app_name))
            .setMtu(MTU)
            .addAddress(TUN_ADDRESS_V4, 30)
            .addAddress(TUN_ADDRESS_V6, 126)
            .addRoute("0.0.0.0", 0)
            .addRoute("::", 0)
            .addDnsServer("1.1.1.1")
            .addDnsServer("8.8.8.8")
        try {
            // The core's own sockets and the app's DNS/HTTP requests must not loop back into the tunnel.
            builder.addDisallowedApplication(packageName)
        } catch (e: PackageManager.NameNotFoundException) {
            voxel.logs.warn("vpn", "Cannot exclude the app from the VPN: ${e.message}")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) builder.setMetered(false)
        builder.setConfigureIntent(openAppIntent())
        return builder.establish()
    }

    /** Samples the traffic counters every second until the session is cancelled or the core dies. */
    private suspend fun monitor(server: ServerProfile) {
        val meter = SpeedMeter()
        var tick = 0
        while (true) {
            delay(1000)
            if (!XrayCore.isRunning()) throw IllegalStateException(getString(R.string.err_core_stopped))
            val snapshot = meter.update(
                XrayCore.stat(XrayCore.STAT_UPLINK),
                XrayCore.stat(XrayCore.STAT_DOWNLINK),
                SystemClock.elapsedRealtime(),
            )
            voxel.hub.setTraffic(snapshot)
            tick++
            if (tick % 2 == 0) {
                val speed = "↓ ${Format.speed(snapshot.downloadBps)}  ↑ ${Format.speed(snapshot.uploadBps)}"
                notify(buildNotification(getString(R.string.notif_connected, server.name), speed))
            }
        }
    }

    private fun teardown() {
        try {
            XrayCore.stop()
        } catch (e: Throwable) {
            voxel.logs.warn("vpn", "Stopping the core: ${e.message ?: e.javaClass.simpleName}")
        }
        val pfd = tun
        tun = null
        if (pfd != null) {
            try {
                pfd.close()
            } catch (e: IOException) {
                voxel.logs.warn("vpn", "Closing the TUN interface: ${e.message}")
            }
        }
        currentServerId = null
    }

    private fun finishService() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // --- notification -------------------------------------------------------------------------

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(CHANNEL_ID, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW)
        channel.description = getString(R.string.notif_channel_desc)
        channel.setShowBadge(false)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun showForeground(text: String) {
        val notification = buildNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun notify(notification: Notification) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(text: String, details: String? = null): Notification {
        val stop = PendingIntent.getService(
            this,
            1,
            Intent(this, VoxelVpnService::class.java).setAction(VpnController.ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_vpn)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(openAppIntent())
            .addAction(0, getString(R.string.notif_disconnect), stop)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (details != null) builder.setSubText(details)
        return builder.build()
    }

    private fun openAppIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private companion object {
        const val CHANNEL_ID = "voxel_vpn_status"
        const val NOTIFICATION_ID = 1
        const val MTU = 1500
        const val TUN_ADDRESS_V4 = "172.19.0.1"
        const val TUN_ADDRESS_V6 = "fdfe:dcba:9876::1"
    }
}

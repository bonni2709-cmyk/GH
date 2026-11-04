package com.voxel.vpn.ui

import android.Manifest
import android.app.Application
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.annotation.StringRes
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.voxel.vpn.BuildConfig
import com.voxel.vpn.R
import com.voxel.vpn.VoxelApp
import com.voxel.vpn.core.ConnectionState
import com.voxel.vpn.core.LogLine
import com.voxel.vpn.core.TrafficSnapshot
import com.voxel.vpn.core.isActive
import com.voxel.vpn.data.LOCAL_SUBSCRIPTION_ID
import com.voxel.vpn.data.SourceMerge
import com.voxel.vpn.data.withSelection
import com.voxel.vpn.data.withSettings
import com.voxel.vpn.data.withSource
import com.voxel.vpn.data.withoutSubscription
import com.voxel.vpn.model.AppData
import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.model.Subscription
import com.voxel.vpn.net.ChainHostResolver
import com.voxel.vpn.net.DohHostResolver
import com.voxel.vpn.net.HttpSubscriptionFetcher
import com.voxel.vpn.net.PingResult
import com.voxel.vpn.net.ServerPinger
import com.voxel.vpn.net.SystemHostResolver
import com.voxel.vpn.parser.incy.ControlAction
import com.voxel.vpn.parser.incy.ImportException
import com.voxel.vpn.parser.incy.ImportOutcome
import com.voxel.vpn.parser.incy.ImportedSource
import com.voxel.vpn.parser.incy.IncyImporter
import com.voxel.vpn.parser.incy.IncyLinkException
import com.voxel.vpn.vpn.VpnController
import com.voxel.vpn.vpn.XrayCore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** One-shot requests to the activity: things only an activity can do. */
sealed interface UiEvent {
    data class AskVpnPermission(val intent: Intent) : UiEvent

    data object AskNotificationPermission : UiEvent
}

/** A short notice shown on top of the screen for a few seconds. */
data class UiMessage(val id: Long, val text: String)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val voxel = application as VoxelApp
    private val store = voxel.store
    private val hub = voxel.hub

    private val resolver = ChainHostResolver(SystemHostResolver(), DohHostResolver())
    private val importer = IncyImporter(
        HttpSubscriptionFetcher(userAgent = "VOXEL/${BuildConfig.VERSION_NAME} (Android ${Build.VERSION.RELEASE})"),
    )
    private val pinger = ServerPinger(resolver = resolver)

    val data: StateFlow<AppData> = store.data
    val connection: StateFlow<ConnectionState> = hub.state
    val traffic: StateFlow<TrafficSnapshot> = hub.traffic
    val logLines: StateFlow<List<LogLine>> = voxel.logs.lines

    private val pingResults = MutableStateFlow<Map<String, PingResult>>(emptyMap())
    private val testingIds = MutableStateFlow<Set<String>>(emptySet())
    private val refreshingIds = MutableStateFlow<Set<String>>(emptySet())
    private val importBusy = MutableStateFlow(false)
    private val currentMessage = MutableStateFlow<UiMessage?>(null)
    // A channel keeps an event until the activity is on screen again: a link that opens the app from the background
    // reaches the view model while the activity is still stopped, and a dropped event would swallow the permission prompt.
    private val uiEvents = Channel<UiEvent>(Channel.BUFFERED)

    val pings: StateFlow<Map<String, PingResult>> = pingResults.asStateFlow()
    val testing: StateFlow<Set<String>> = testingIds.asStateFlow()
    val refreshing: StateFlow<Set<String>> = refreshingIds.asStateFlow()
    val importing: StateFlow<Boolean> = importBusy.asStateFlow()
    val message: StateFlow<UiMessage?> = currentMessage.asStateFlow()
    val events: Flow<UiEvent> = uiEvents.receiveAsFlow()

    val versionLabel: String by lazy {
        val core = try {
            XrayCore.version()
        } catch (t: Throwable) {
            "?"
        }
        str(R.string.about_version, BuildConfig.VERSION_NAME, core)
    }

    private var messageCounter = 0L
    private var notificationsPrompted = false

    init {
        refreshDueSubscriptions()
    }

    // --- connection ---------------------------------------------------------------------------

    fun onConnectClicked() {
        when (connection.value) {
            is ConnectionState.Connecting, is ConnectionState.Connected -> disconnect()
            is ConnectionState.Disconnecting -> Unit
            else -> connect()
        }
    }

    fun connect() {
        if (data.value.servers.isEmpty()) {
            say(str(R.string.msg_no_server))
            return
        }
        if (!notificationsPrompted && needsNotificationPermission()) {
            notificationsPrompted = true
            uiEvents.trySend(UiEvent.AskNotificationPermission)
            return
        }
        requestVpnPermissionThenStart()
    }

    fun onNotificationPermissionAnswered() {
        requestVpnPermissionThenStart()
    }

    fun onVpnPermissionResult(granted: Boolean) {
        if (granted) startVpn(null) else say(str(R.string.msg_vpn_denied))
    }

    fun disconnect() {
        VpnController.stop(getApplication())
    }

    private fun requestVpnPermissionThenStart() {
        val intent = VpnController.permissionIntent(getApplication())
        if (intent != null) uiEvents.trySend(UiEvent.AskVpnPermission(intent)) else startVpn(null)
    }

    private fun startVpn(serverId: String?) {
        VpnController.start(getApplication(), serverId ?: data.value.settings.selectedServerId)
    }

    private fun needsNotificationPermission(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(getApplication(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED

    // --- servers ------------------------------------------------------------------------------

    fun select(serverId: String) {
        viewModelScope.launch {
            store.update { it.withSelection(serverId) }
            // While the VPN is up, choosing another server switches to it.
            if (connection.value.isActive) startVpn(serverId)
        }
    }

    fun setIpv6(enabled: Boolean) {
        viewModelScope.launch { store.update { it.withSettings { s -> s.copy(ipv6 = enabled) } } }
    }

    fun testAll() {
        pingServers(data.value.servers)
    }

    private fun pingServers(servers: List<ServerProfile>) {
        if (servers.isEmpty()) return
        val ids = servers.map { it.id }.toSet()
        viewModelScope.launch {
            testingIds.update { it + ids }
            try {
                pinger.ping(servers, ipv6 = data.value.settings.ipv6) { id, result ->
                    pingResults.update { it + (id to result) }
                    testingIds.update { it - id }
                }
            } finally {
                testingIds.update { it - ids }
            }
        }
    }

    // --- import and subscriptions -------------------------------------------------------------

    /** Handles anything the user pasted or an `incy://` link that opened the app. */
    fun importText(text: String) {
        val input = text.trim()
        if (input.isEmpty()) return
        viewModelScope.launch {
            importBusy.value = true
            try {
                when (val outcome = importer.import(input)) {
                    is ImportOutcome.Control -> handleControl(outcome.action)
                    is ImportOutcome.Imported -> storeImported(outcome)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: IncyLinkException) {
                say(str(R.string.msg_import_failed, describe(e)))
            } catch (e: ImportException) {
                say(str(R.string.msg_import_failed, e.message ?: e.javaClass.simpleName))
            } catch (e: Exception) {
                say(str(R.string.msg_import_failed, e.message ?: e.javaClass.simpleName))
            } finally {
                importBusy.value = false
            }
        }
    }

    private suspend fun storeImported(outcome: ImportOutcome.Imported) {
        val lines = mutableListOf<String>()
        val toPing = mutableListOf<ServerProfile>()
        for (source in outcome.sources) {
            val merge = storeSource(source)
            val count = source.servers.size
            val name = titleOf(merge.subscription)
            val plural = if (merge.refreshed) R.plurals.msg_updated else R.plurals.msg_added
            lines += plurals(plural, count, count, name)
            toPing += merge.data.serversOf(merge.subscription.id)
            voxel.logs.info("import", "$name: $count servers (${source.origin})")
            source.warnings.forEach { voxel.logs.warn("import", it) }
        }
        val skipped = outcome.sources.sumOf { it.skipped.size }
        if (skipped > 0) lines += str(R.string.msg_skipped, skipped)
        if (outcome.failures.isNotEmpty()) {
            lines += str(R.string.msg_partial_failed, outcome.failures.joinToString("; ") { it.message })
        }
        say(lines.joinToString("\n"))
        pingServers(toPing)
    }

    private suspend fun storeSource(source: ImportedSource): SourceMerge {
        var result: SourceMerge? = null
        val now = System.currentTimeMillis()
        store.update { current -> current.withSource(source, now).also { result = it }.data }
        return result ?: throw IllegalStateException("The store did not run the update")
    }

    fun refresh(subscriptionId: String) {
        val subscription = data.value.subscriptions.firstOrNull { it.id == subscriptionId } ?: return
        val url = subscription.url ?: return
        if (subscriptionId in refreshingIds.value) return
        viewModelScope.launch {
            refreshingIds.update { it + subscriptionId }
            try {
                val source = importer.fetchSubscription(url, subscription.title, "refresh")
                val merge = storeSource(source)
                val count = source.servers.size
                say(plurals(R.plurals.msg_updated, count, count, titleOf(merge.subscription)))
                pingServers(merge.data.serversOf(subscriptionId))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                say(str(R.string.msg_refresh_failed, titleOf(subscription), e.message ?: e.javaClass.simpleName))
            } finally {
                refreshingIds.update { it - subscriptionId }
            }
        }
    }

    fun deleteSubscription(subscriptionId: String) {
        val subscription = data.value.subscriptions.firstOrNull { it.id == subscriptionId } ?: return
        val serverIds = data.value.serversOf(subscriptionId).map { it.id }.toSet()
        viewModelScope.launch {
            store.update { it.withoutSubscription(subscriptionId) }
            pingResults.update { it - serverIds }
            say(str(R.string.msg_removed, titleOf(subscription)))
        }
    }

    /** Re-downloads subscriptions whose provider asked for periodic updates and whose time has come. */
    private fun refreshDueSubscriptions() {
        val now = System.currentTimeMillis()
        for (subscription in data.value.subscriptions) {
            val hours = subscription.meta.updateIntervalHours ?: continue
            if (subscription.url == null || hours <= 0) continue
            if (now - subscription.updatedAt >= hours * 3_600_000L) refresh(subscription.id)
        }
    }

    private fun handleControl(action: ControlAction) {
        when (action) {
            ControlAction.CONNECT -> if (!connection.value.isActive) connect()
            ControlAction.OPEN -> Unit
            ControlAction.DISCONNECT, ControlAction.CLOSE -> if (connection.value.isActive) disconnect()
            ControlAction.TOGGLE -> onConnectClicked()
            ControlAction.STATUS -> say(str(R.string.msg_status, statusText(connection.value)))
        }
    }

    // --- logs and messages --------------------------------------------------------------------

    fun logsText(): String = voxel.logs.dump()

    fun clearLogs() {
        voxel.logs.clear()
    }

    fun dismissMessage(id: Long) {
        currentMessage.update { if (it?.id == id) null else it }
    }

    fun say(text: String) {
        messageCounter++
        currentMessage.value = UiMessage(messageCounter, text)
    }

    fun titleOf(subscription: Subscription): String =
        if (subscription.id == LOCAL_SUBSCRIPTION_ID) str(R.string.group_local) else subscription.title

    private fun statusText(state: ConnectionState): String = when (state) {
        is ConnectionState.Idle -> str(R.string.status_idle)
        is ConnectionState.Connecting -> str(R.string.status_connecting)
        is ConnectionState.Connected -> str(R.string.status_connected)
        is ConnectionState.Disconnecting -> str(R.string.status_disconnecting)
        is ConnectionState.Failed -> str(R.string.status_failed)
    }

    private fun describe(e: IncyLinkException): String = str(
        when (e.kind) {
            IncyLinkException.Kind.MALFORMED -> R.string.err_link_malformed
            IncyLinkException.Kind.EMPTY -> R.string.err_link_empty
            IncyLinkException.Kind.UNSUPPORTED_VERSION -> R.string.err_link_version
            IncyLinkException.Kind.AUTH_FAILED -> R.string.err_link_auth
            IncyLinkException.Kind.UNSUPPORTED -> R.string.err_link_unsupported
        },
    )

    private fun str(@StringRes id: Int, vararg args: Any): String = getApplication<Application>().getString(id, *args)

    private fun plurals(id: Int, quantity: Int, vararg args: Any): String =
        getApplication<Application>().resources.getQuantityString(id, quantity, *args)
}

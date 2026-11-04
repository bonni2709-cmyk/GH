package com.voxel.vpn.ui.screens

import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voxel.vpn.R
import com.voxel.vpn.core.ConnectionState
import com.voxel.vpn.core.TrafficSnapshot
import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.model.Subscription
import com.voxel.vpn.net.PingResult
import com.voxel.vpn.ui.Format
import com.voxel.vpn.ui.MainViewModel
import com.voxel.vpn.ui.UiMessage
import com.voxel.vpn.ui.components.CloseGlyph
import com.voxel.vpn.ui.components.ConnectButton
import com.voxel.vpn.ui.components.GlassCard
import com.voxel.vpn.ui.components.GlassIconButton
import com.voxel.vpn.ui.components.GlassPill
import com.voxel.vpn.ui.components.LogsGlyph
import com.voxel.vpn.ui.components.PlusGlyph
import com.voxel.vpn.ui.components.Tag
import com.voxel.vpn.ui.components.UsageBar
import com.voxel.vpn.ui.components.VoxelBackground
import com.voxel.vpn.ui.components.stateColor
import com.voxel.vpn.ui.theme.VoxelColors
import com.voxel.vpn.ui.theme.VoxelType
import kotlinx.coroutines.delay

@Composable
fun MainScreen(viewModel: MainViewModel) {
    val context = LocalContext.current
    val data by viewModel.data.collectAsStateWithLifecycle()
    val connection by viewModel.connection.collectAsStateWithLifecycle()
    val traffic by viewModel.traffic.collectAsStateWithLifecycle()
    val pings by viewModel.pings.collectAsStateWithLifecycle()
    val testing by viewModel.testing.collectAsStateWithLifecycle()
    val refreshing by viewModel.refreshing.collectAsStateWithLifecycle()
    val importing by viewModel.importing.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()
    val logLines by viewModel.logLines.collectAsStateWithLifecycle()

    var showLogs by rememberSaveable { mutableStateOf(false) }
    var addOpen by rememberSaveable { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<Subscription?>(null) }

    val clipboardEmptyText = stringResource(R.string.msg_clipboard_empty)
    val logsCopiedText = stringResource(R.string.msg_logs_copied)

    val selectedId = data.settings.selectedServerId
    val selected = data.server(selectedId)
    val nowSeconds = System.currentTimeMillis() / 1000

    VoxelBackground(accent = stateColor(connection)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding(),
        ) {
            Header(onLogs = { showLogs = true })
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item(key = "hero") {
                    Hero(
                        state = connection,
                        traffic = traffic,
                        serverName = selected?.name,
                        ipv6 = data.settings.ipv6,
                        onToggle = viewModel::onConnectClicked,
                        onIpv6 = { viewModel.setIpv6(!data.settings.ipv6) },
                    )
                }
                if (data.servers.isEmpty()) {
                    item(key = "add") {
                        AddCard(
                            busy = importing,
                            onSubmit = viewModel::importText,
                            onEmptyClipboard = { viewModel.say(clipboardEmptyText) },
                        )
                    }
                } else {
                    item(key = "servers-title") {
                        ServersTitle(
                            testing = testing.isNotEmpty(),
                            addOpen = addOpen,
                            onToggleAdd = { addOpen = !addOpen },
                            onTestAll = viewModel::testAll,
                        )
                    }
                    if (addOpen) {
                        item(key = "add") {
                            AddCard(
                                busy = importing,
                                onSubmit = { value ->
                                    addOpen = false
                                    viewModel.importText(value)
                                },
                                onEmptyClipboard = { viewModel.say(clipboardEmptyText) },
                            )
                        }
                    }
                }
                data.subscriptions.forEach { subscription ->
                    val servers = data.serversOf(subscription.id)
                    item(key = "sub-${subscription.id}") {
                        SubscriptionHeader(
                            title = viewModel.titleOf(subscription),
                            subscription = subscription,
                            serverCount = servers.size,
                            nowSeconds = nowSeconds,
                            refreshing = subscription.id in refreshing,
                            onRefresh = { viewModel.refresh(subscription.id) },
                            onDelete = { pendingDelete = subscription },
                        )
                    }
                    items(servers, key = { it.id }) { server ->
                        ServerRow(
                            server = server,
                            selected = server.id == selectedId,
                            ping = pings[server.id],
                            testing = server.id in testing,
                            onClick = { viewModel.select(server.id) },
                        )
                    }
                }
                item(key = "footer") {
                    Text(
                        text = viewModel.versionLabel,
                        style = VoxelType.Caption,
                        color = VoxelColors.TextMuted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp),
                    )
                }
            }
        }

        MessageBanner(
            message = message,
            onDismiss = viewModel::dismissMessage,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )

        if (showLogs) {
            LogsScreen(
                lines = logLines,
                onClose = { showLogs = false },
                onCopy = {
                    copyToClipboard(context, viewModel.logsText())
                    viewModel.say(logsCopiedText)
                },
                onClear = viewModel::clearLogs,
            )
        }
    }

    val doomed = pendingDelete
    if (doomed != null) {
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteSubscription(doomed.id)
                    pendingDelete = null
                }) {
                    Text(text = stringResource(R.string.action_delete), color = VoxelColors.Bad)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) {
                    Text(text = stringResource(R.string.action_cancel), color = VoxelColors.TextSecondary)
                }
            },
            title = { Text(text = stringResource(R.string.delete_title)) },
            text = { Text(text = stringResource(R.string.delete_text, viewModel.titleOf(doomed))) },
            containerColor = VoxelColors.Bg1,
            titleContentColor = VoxelColors.TextPrimary,
            textContentColor = VoxelColors.TextSecondary,
        )
    }
}

@Composable
private fun Header(onLogs: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.app_name),
            style = VoxelType.Wordmark,
            modifier = Modifier.weight(1f),
        )
        GlassIconButton(onClick = onLogs, contentDescription = stringResource(R.string.action_logs)) {
            LogsGlyph(color = VoxelColors.TextPrimary, modifier = Modifier.size(22.dp))
        }
    }
}

@Composable
private fun Hero(
    state: ConnectionState,
    traffic: TrafficSnapshot,
    serverName: String?,
    ipv6: Boolean,
    onToggle: () -> Unit,
    onIpv6: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        ConnectButton(state = state, description = statusTitle(state), onClick = onToggle)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = statusTitle(state),
            style = VoxelType.Status,
            color = if (state is ConnectionState.Idle) VoxelColors.TextPrimary else stateColor(state),
        )
        Spacer(modifier = Modifier.height(4.dp))
        when (state) {
            is ConnectionState.Idle -> {
                if (serverName != null) {
                    Subline(stringResource(R.string.hint_tap_connect), VoxelColors.TextSecondary)
                    Subline(serverName, VoxelColors.TextMuted)
                } else {
                    Subline(stringResource(R.string.hint_no_servers), VoxelColors.TextSecondary)
                }
            }
            is ConnectionState.Connecting -> Subline(state.serverName, VoxelColors.TextSecondary)
            is ConnectionState.Connected -> {
                Subline(state.serverName, VoxelColors.TextSecondary)
                Subline(stringResource(R.string.hint_tap_disconnect), VoxelColors.TextMuted)
            }
            is ConnectionState.Disconnecting -> Unit
            is ConnectionState.Failed -> Subline(state.message, VoxelColors.Bad)
        }
        AnimatedVisibility(visible = state is ConnectionState.Connected) {
            val since = (state as? ConnectionState.Connected)?.sinceMs ?: 0L
            StatsCard(sinceMs = since, traffic = traffic)
        }
        Spacer(modifier = Modifier.height(14.dp))
        GlassPill(text = stringResource(R.string.ipv6_label), onClick = onIpv6, accent = ipv6)
    }
}

@Composable
private fun Subline(text: String, color: Color) {
    Text(
        text = text,
        style = VoxelType.Body,
        color = color,
        textAlign = TextAlign.Center,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(horizontal = 24.dp),
    )
}

@Composable
private fun statusTitle(state: ConnectionState): String = stringResource(
    when (state) {
        is ConnectionState.Idle -> R.string.status_idle
        is ConnectionState.Connecting -> R.string.status_connecting
        is ConnectionState.Connected -> R.string.status_connected
        is ConnectionState.Disconnecting -> R.string.status_disconnecting
        is ConnectionState.Failed -> R.string.status_failed
    },
)

@Composable
private fun StatsCard(sinceMs: Long, traffic: TrafficSnapshot) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(sinceMs) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }
    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 16.dp),
        padding = PaddingValues(horizontal = 8.dp, vertical = 14.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Stat(
                label = stringResource(R.string.stat_time),
                value = Format.duration(now - sinceMs),
                detail = null,
                modifier = Modifier.weight(1f),
            )
            Stat(
                label = stringResource(R.string.stat_download),
                value = Format.speed(traffic.downloadBps),
                detail = Format.bytes(traffic.downloadBytes),
                modifier = Modifier.weight(1f),
            )
            Stat(
                label = stringResource(R.string.stat_upload),
                value = Format.speed(traffic.uploadBps),
                detail = Format.bytes(traffic.uploadBytes),
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun Stat(label: String, value: String, detail: String?, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label.uppercase(), style = VoxelType.Tag, color = VoxelColors.TextMuted)
        Spacer(modifier = Modifier.height(4.dp))
        Text(text = value, style = VoxelType.Stat, color = VoxelColors.TextPrimary, maxLines = 1)
        if (detail != null) {
            Text(text = detail, style = VoxelType.Caption, color = VoxelColors.TextSecondary, maxLines = 1)
        }
    }
}

@Composable
private fun AddCard(busy: Boolean, onSubmit: (String) -> Unit, onEmptyClipboard: () -> Unit) {
    val context = LocalContext.current
    var text by rememberSaveable { mutableStateOf("") }
    val fieldShape = RoundedCornerShape(14.dp)

    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Text(text = stringResource(R.string.add_title), style = VoxelType.Title, color = VoxelColors.TextPrimary)
        Spacer(modifier = Modifier.height(12.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(fieldShape)
                .background(Color.Black.copy(alpha = 0.28f))
                .border(1.dp, Color.White.copy(alpha = 0.10f), fieldShape)
                .padding(horizontal = 14.dp, vertical = 12.dp),
        ) {
            BasicTextField(
                value = text,
                onValueChange = { text = it },
                textStyle = VoxelType.Body.copy(color = VoxelColors.TextPrimary),
                cursorBrush = SolidColor(VoxelColors.Accent),
                maxLines = 3,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(
                    onDone = {
                        if (text.isNotBlank() && !busy) {
                            onSubmit(text)
                            text = ""
                        }
                    },
                ),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (text.isEmpty()) {
                        Text(text = stringResource(R.string.add_hint), style = VoxelType.Body, color = VoxelColors.TextMuted)
                    }
                    inner()
                },
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            GlassPill(
                text = stringResource(R.string.action_paste),
                onClick = {
                    val clip = readClipboard(context)
                    if (clip.isNullOrBlank()) onEmptyClipboard() else text = clip.trim()
                },
            )
            GlassPill(
                text = stringResource(R.string.action_add),
                accent = true,
                enabled = text.isNotBlank() && !busy,
                onClick = {
                    onSubmit(text)
                    text = ""
                },
            )
            if (busy) {
                Text(text = stringResource(R.string.add_busy), style = VoxelType.Caption, color = VoxelColors.TextSecondary)
            }
        }
    }
}

@Composable
private fun ServersTitle(testing: Boolean, addOpen: Boolean, onToggleAdd: () -> Unit, onTestAll: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = stringResource(R.string.section_servers),
            style = VoxelType.Title,
            color = VoxelColors.TextPrimary,
            modifier = Modifier.weight(1f),
        )
        GlassPill(
            text = stringResource(if (testing) R.string.action_testing else R.string.action_test_all),
            onClick = onTestAll,
            enabled = !testing,
        )
        GlassIconButton(
            onClick = onToggleAdd,
            contentDescription = stringResource(if (addOpen) R.string.action_close else R.string.action_add),
        ) {
            if (addOpen) {
                CloseGlyph(color = VoxelColors.TextPrimary, modifier = Modifier.size(20.dp))
            } else {
                PlusGlyph(color = VoxelColors.TextPrimary, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun SubscriptionHeader(
    title: String,
    subscription: Subscription,
    serverCount: Int,
    nowSeconds: Long,
    refreshing: Boolean,
    onRefresh: () -> Unit,
    onDelete: () -> Unit,
) {
    val userInfo = subscription.meta.userInfo?.takeIf { !subscription.meta.hideTraffic }
    val expireAt = subscription.meta.userInfo?.expireAt
    val expired = expireAt != null && expireAt < nowSeconds

    val serversText = pluralStringResource(R.plurals.servers_count, serverCount, serverCount)
    val expiryText = if (expireAt == null) {
        null
    } else {
        val days = Format.daysLeft(expireAt, nowSeconds)
        if (days < 0) stringResource(R.string.sub_expired) else pluralStringResource(R.plurals.days_left, days.toInt(), days.toInt())
    }
    val details = listOfNotNull(serversText, expiryText)

    Column(modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = VoxelType.Title,
                    color = VoxelColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = details.joinToString(" · "),
                    style = VoxelType.Caption,
                    color = if (expired) VoxelColors.Bad else VoxelColors.TextSecondary,
                )
            }
            if (subscription.url != null) {
                GlassPill(text = stringResource(R.string.action_refresh), onClick = onRefresh, enabled = !refreshing)
                Spacer(modifier = Modifier.width(8.dp))
            }
            GlassPill(text = stringResource(R.string.action_delete), onClick = onDelete)
        }
        if (userInfo != null && (userInfo.total > 0 || userInfo.used > 0)) {
            Spacer(modifier = Modifier.height(10.dp))
            if (userInfo.total > 0) {
                val percent = Format.percent(userInfo.used, userInfo.total)
                UsageBar(
                    fraction = percent / 100f,
                    color = if (percent >= 90) VoxelColors.Bad else if (percent >= 70) VoxelColors.Warn else VoxelColors.Accent,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = stringResource(R.string.sub_traffic, Format.bytes(userInfo.used), Format.bytes(userInfo.total)),
                    style = VoxelType.Caption,
                    color = VoxelColors.TextSecondary,
                )
            } else {
                Text(
                    text = stringResource(R.string.sub_traffic_unlimited, Format.bytes(userInfo.used)),
                    style = VoxelType.Caption,
                    color = VoxelColors.TextSecondary,
                )
            }
        }
        val announce = subscription.meta.announce
        if (!announce.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = announce,
                style = VoxelType.Caption,
                color = VoxelColors.TextMuted,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun ServerRow(
    server: ServerProfile,
    selected: Boolean,
    ping: PingResult?,
    testing: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(18.dp)
    val rowFill = if (selected) VoxelColors.Accent.copy(alpha = 0.14f) else Color.White.copy(alpha = 0.04f)
    val rowEdge = if (selected) VoxelColors.Accent.copy(alpha = 0.55f) else Color.White.copy(alpha = 0.07f)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(rowFill)
            .border(1.dp, rowEdge, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SelectionDot(selected = selected)
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 12.dp),
        ) {
            Text(
                text = server.name,
                style = VoxelType.BodyMedium,
                color = VoxelColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(5.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Tag(text = server.protocol)
                Tag(text = server.network)
                if (server.security != "none") Tag(text = server.security, color = VoxelColors.AccentSoft)
            }
        }
        PingLabel(ping = ping, testing = testing)
    }
}

@Composable
private fun SelectionDot(selected: Boolean) {
    Box(
        modifier = Modifier
            .size(18.dp)
            .clip(CircleShape)
            .border(1.5.dp, if (selected) VoxelColors.Accent else Color.White.copy(alpha = 0.25f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(VoxelColors.Accent),
            )
        }
    }
}

@Composable
private fun PingLabel(ping: PingResult?, testing: Boolean) {
    val ms = ping?.ms
    val text = when {
        testing -> "…"
        ping == null -> stringResource(R.string.ping_unknown)
        ping == PingResult.NOT_APPLICABLE -> stringResource(R.string.ping_unavailable)
        ms == null -> stringResource(R.string.ping_failed)
        else -> stringResource(R.string.ping_ms, ms)
    }
    val color = when {
        testing || ping == null || ping == PingResult.NOT_APPLICABLE -> VoxelColors.TextMuted
        ms == null -> VoxelColors.Bad
        ms < 150 -> VoxelColors.Good
        ms < 400 -> VoxelColors.Warn
        else -> VoxelColors.Bad
    }
    Text(text = text, style = VoxelType.BodyMedium.copy(fontSize = 13.sp), color = color, maxLines = 1)
}

@Composable
private fun MessageBanner(message: UiMessage?, onDismiss: (Long) -> Unit, modifier: Modifier = Modifier) {
    var shown by remember { mutableStateOf(message) }
    if (message != null && message != shown) shown = message
    LaunchedEffect(message?.id) {
        if (message != null) {
            delay(5000)
            onDismiss(message.id)
        }
    }
    AnimatedVisibility(
        visible = message != null,
        modifier = modifier,
        enter = fadeIn() + slideInVertically { fullHeight -> -fullHeight },
        exit = fadeOut() + slideOutVertically { fullHeight -> -fullHeight },
    ) {
        val shape = RoundedCornerShape(18.dp)
        Text(
            text = shown?.text.orEmpty(),
            style = VoxelType.Body,
            color = VoxelColors.TextPrimary,
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(Color(0xE61A2036))
                .border(1.dp, Color.White.copy(alpha = 0.14f), shape)
                .clickable { message?.let { onDismiss(it.id) } }
                .padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}

private fun readClipboard(context: Context): String? {
    val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return null
    val clip = manager.primaryClip ?: return null
    if (clip.itemCount == 0) return null
    return clip.getItemAt(0).coerceToText(context)?.toString()
}

private fun copyToClipboard(context: Context, text: String) {
    val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
    manager.setPrimaryClip(android.content.ClipData.newPlainText("VOXEL", text))
}

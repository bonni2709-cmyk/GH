package com.voxel.vpn.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.voxel.vpn.R
import com.voxel.vpn.core.LogLevel
import com.voxel.vpn.core.LogLine
import com.voxel.vpn.ui.components.CloseGlyph
import com.voxel.vpn.ui.components.GlassIconButton
import com.voxel.vpn.ui.components.GlassPill
import com.voxel.vpn.ui.theme.VoxelColors
import com.voxel.vpn.ui.theme.VoxelType
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Full-screen journal of the app and the core. Back or the close button leaves it. */
@Composable
fun LogsScreen(
    lines: List<LogLine>,
    onClose: () -> Unit,
    onCopy: () -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onClose)
    val listState = rememberLazyListState()
    val clock = remember { SimpleDateFormat("HH:mm:ss", Locale.ROOT) }

    LaunchedEffect(lines.size) {
        if (lines.isNotEmpty()) listState.scrollToItem(lines.lastIndex)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(VoxelColors.Bg0.copy(alpha = 0.98f))
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.logs_title),
                style = VoxelType.Title,
                color = VoxelColors.TextPrimary,
                modifier = Modifier.weight(1f),
            )
            GlassPill(text = stringResource(R.string.action_copy), onClick = onCopy, enabled = lines.isNotEmpty())
            Spacer(modifier = Modifier.width(8.dp))
            GlassPill(text = stringResource(R.string.action_clear), onClick = onClear, enabled = lines.isNotEmpty())
            Spacer(modifier = Modifier.width(8.dp))
            GlassIconButton(onClick = onClose, contentDescription = stringResource(R.string.action_close)) {
                CloseGlyph(color = VoxelColors.TextPrimary, modifier = Modifier.size(22.dp))
            }
        }
        if (lines.isEmpty()) {
            Text(
                text = stringResource(R.string.logs_empty),
                style = VoxelType.Body,
                color = VoxelColors.TextMuted,
                modifier = Modifier.padding(top = 24.dp),
            )
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(lines, key = { it.id }) { line ->
                    LogRow(line = line, time = clock.format(Date(line.timeMs)))
                }
            }
        }
    }
}

@Composable
private fun LogRow(line: LogLine, time: String) {
    val color = when (line.level) {
        LogLevel.ERROR -> VoxelColors.Bad
        LogLevel.WARN -> VoxelColors.Warn
        LogLevel.INFO -> VoxelColors.TextPrimary
        LogLevel.DEBUG -> VoxelColors.TextMuted
    }
    Row {
        Text(
            text = time,
            style = VoxelType.Caption.copy(fontFamily = FontFamily.Monospace, fontSize = 11.sp),
            color = VoxelColors.TextMuted,
            modifier = Modifier.padding(end = 8.dp),
        )
        Text(
            text = "${line.tag}: ${line.text}",
            style = VoxelType.Caption.copy(fontFamily = FontFamily.Monospace, fontSize = 11.sp),
            color = color.copy(alpha = if (line.level == LogLevel.INFO) 0.85f else 1f),
            modifier = Modifier.weight(1f),
        )
    }
}

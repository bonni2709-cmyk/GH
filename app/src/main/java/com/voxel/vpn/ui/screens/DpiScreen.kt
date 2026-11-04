package com.voxel.vpn.ui.screens

import androidx.activity.compose.BackHandler
import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.voxel.vpn.R
import com.voxel.vpn.dpi.DpiCheck
import com.voxel.vpn.dpi.DpiConfig
import com.voxel.vpn.dpi.DpiMode
import com.voxel.vpn.dpi.DpiStats
import com.voxel.vpn.ui.Format
import com.voxel.vpn.ui.components.CloseGlyph
import com.voxel.vpn.ui.components.GlassCard
import com.voxel.vpn.ui.components.GlassIconButton
import com.voxel.vpn.ui.theme.VoxelColors
import com.voxel.vpn.ui.theme.VoxelType

/** Longest custom recipe the field accepts. */
private const val MAX_RECIPE_LENGTH = 400

@StringRes
internal fun dpiModeTitle(mode: DpiMode): Int = when (mode) {
    DpiMode.OFF -> R.string.dpi_mode_off
    DpiMode.LIGHT -> R.string.dpi_mode_light
    DpiMode.STANDARD -> R.string.dpi_mode_standard
    DpiMode.STRONG -> R.string.dpi_mode_strong
    DpiMode.CUSTOM -> R.string.dpi_mode_custom
}

@StringRes
private fun dpiModeDescription(mode: DpiMode): Int = when (mode) {
    DpiMode.OFF -> R.string.dpi_mode_off_desc
    DpiMode.LIGHT -> R.string.dpi_mode_light_desc
    DpiMode.STANDARD -> R.string.dpi_mode_standard_desc
    DpiMode.STRONG -> R.string.dpi_mode_strong_desc
    DpiMode.CUSTOM -> R.string.dpi_mode_custom_desc
}

/**
 * Full-screen settings of the DPI bypass: pick a preset or write a recipe, see what the engine did this session.
 * Back or the close button leaves it.
 */
@Composable
fun DpiScreen(
    config: DpiConfig,
    stats: DpiStats?,
    connected: Boolean,
    onMode: (DpiMode) -> Unit,
    onCustom: (String) -> Unit,
    check: (String) -> DpiCheck?,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onClose)
    var recipe by rememberSaveable { mutableStateOf(config.custom) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(VoxelColors.Bg0)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .padding(horizontal = 16.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.dpi_title),
                style = VoxelType.Title,
                color = VoxelColors.TextPrimary,
                modifier = Modifier.weight(1f),
            )
            GlassIconButton(onClick = onClose, contentDescription = stringResource(R.string.action_close)) {
                CloseGlyph(color = VoxelColors.TextPrimary, modifier = Modifier.size(22.dp))
            }
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "intro") {
                Text(text = stringResource(R.string.dpi_intro), style = VoxelType.Body, color = VoxelColors.TextSecondary)
            }
            items(DpiMode.entries, key = { it.id }) { mode ->
                ModeCard(mode = mode, selected = mode == config.mode, onClick = { onMode(mode) })
            }
            if (config.mode == DpiMode.CUSTOM) {
                item(key = "recipe") {
                    RecipeEditor(
                        text = recipe,
                        onChange = {
                            recipe = it
                            onCustom(it)
                        },
                        check = check,
                    )
                }
            }
            if (stats != null) {
                item(key = "stats") { DpiStatsCard(stats) }
            }
            item(key = "hint") {
                Text(
                    text = stringResource(if (connected) R.string.dpi_apply_hint_connected else R.string.dpi_apply_hint),
                    style = VoxelType.Caption,
                    color = VoxelColors.TextMuted,
                )
            }
        }
    }
}

@Composable
private fun ModeCard(mode: DpiMode, selected: Boolean, onClick: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth(), onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            RadioDot(selected = selected)
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = stringResource(dpiModeTitle(mode)),
                style = VoxelType.Title,
                color = if (selected) VoxelColors.AccentSoft else VoxelColors.TextPrimary,
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(text = stringResource(dpiModeDescription(mode)), style = VoxelType.Body, color = VoxelColors.TextSecondary)
    }
}

@Composable
private fun RadioDot(selected: Boolean) {
    val ring = if (selected) VoxelColors.Accent else VoxelColors.TextMuted
    Box(
        modifier = Modifier
            .size(20.dp)
            .clip(CircleShape)
            .border(2.dp, ring, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(VoxelColors.Accent),
            )
        }
    }
}

@Composable
private fun RecipeEditor(text: String, onChange: (String) -> Unit, check: (String) -> DpiCheck?) {
    val fieldShape = RoundedCornerShape(14.dp)
    val verdict = remember(text) { if (text.isBlank()) null else check(text) }
    GlassCard(modifier = Modifier.fillMaxWidth()) {
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
                onValueChange = { onChange(it.take(MAX_RECIPE_LENGTH)) },
                textStyle = VoxelType.Body.copy(color = VoxelColors.TextPrimary, fontFamily = FontFamily.Monospace),
                cursorBrush = SolidColor(VoxelColors.Accent),
                maxLines = 4,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner ->
                    if (text.isEmpty()) {
                        Text(text = stringResource(R.string.dpi_custom_hint), style = VoxelType.Body, color = VoxelColors.TextMuted)
                    }
                    inner()
                },
            )
        }
        Spacer(modifier = Modifier.height(10.dp))
        when (verdict) {
            null -> Text(
                text = stringResource(if (text.isBlank()) R.string.dpi_custom_empty else R.string.dpi_custom_unchecked),
                style = VoxelType.Caption,
                color = VoxelColors.TextMuted,
            )
            is DpiCheck.Valid -> Text(
                text = stringResource(R.string.dpi_custom_valid, verdict.canonical),
                style = VoxelType.Caption.copy(fontFamily = FontFamily.Monospace),
                color = VoxelColors.Good,
            )
            is DpiCheck.Invalid -> Text(
                text = verdict.reason,
                style = VoxelType.Caption,
                color = VoxelColors.Bad,
            )
        }
    }
}

@Composable
private fun DpiStatsCard(stats: DpiStats) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = PaddingValues(horizontal = 8.dp, vertical = 14.dp)) {
        Text(
            text = stringResource(R.string.dpi_stats_title),
            style = VoxelType.Title,
            color = VoxelColors.TextPrimary,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            DpiStat(stringResource(R.string.dpi_stat_connections), stats.accepted.toString(), Modifier.weight(1f))
            DpiStat(stringResource(R.string.dpi_stat_cut), stats.desynced.toString(), Modifier.weight(1f))
            DpiStat(stringResource(R.string.dpi_stat_failed), stats.failed.toString(), Modifier.weight(1f))
        }
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = stringResource(R.string.dpi_stat_traffic, Format.bytes(stats.bytesUp), Format.bytes(stats.bytesDown)),
            style = VoxelType.Caption,
            color = VoxelColors.TextSecondary,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
    }
}

@Composable
private fun DpiStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label.uppercase(), style = VoxelType.Tag, color = VoxelColors.TextMuted, maxLines = 1)
        Spacer(modifier = Modifier.height(4.dp))
        Text(text = value, style = VoxelType.Stat, color = VoxelColors.TextPrimary, maxLines = 1)
    }
}

package com.voxel.vpn.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Palette: a deep blue-black base with one calm indigo accent; green and red only carry meaning. */
object VoxelColors {
    val Bg0 = Color(0xFF090B10)
    val Bg1 = Color(0xFF0F1322)

    val Accent = Color(0xFF7480E8)
    val AccentSoft = Color(0xFFA9B2FF)
    val Good = Color(0xFF3FB08E)
    val Warn = Color(0xFFD6A24A)
    val Bad = Color(0xFFD2606A)

    val TextPrimary = Color(0xFFE9ECF5)
    val TextSecondary = Color(0xFF9CA3BA)
    val TextMuted = Color(0xFF69708A)
}

/** Text styles used across the screens. */
object VoxelType {
    val Wordmark = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 6.sp, color = VoxelColors.TextPrimary)
    val Status = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.2.sp)
    val Title = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    val Body = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Normal)
    val BodyMedium = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Medium)
    val Caption = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Normal)
    val Tag = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.6.sp)
    val Stat = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
}

private val DarkScheme = darkColorScheme(
    primary = VoxelColors.Accent,
    onPrimary = Color.White,
    background = VoxelColors.Bg0,
    onBackground = VoxelColors.TextPrimary,
    surface = VoxelColors.Bg1,
    onSurface = VoxelColors.TextPrimary,
    surfaceVariant = VoxelColors.Bg1,
    onSurfaceVariant = VoxelColors.TextSecondary,
    error = VoxelColors.Bad,
)

@Composable
fun VoxelTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkScheme, content = content)
}

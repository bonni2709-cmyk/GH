package chat.vale

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

internal val Ink = Color(0xFF203128)
internal val Forest = Color(0xFF2D4538)
internal val ForestDark = Color(0xFF25392F)
internal val Sage = Color(0xFF708777)
internal val Muted = Color(0xFF78877C)
internal val CanvasColor = Color(0xFFF5F6F2)
internal val Paper = Color(0xFFFFFFFF)
internal val Mist = Color(0xFFEAF0EA)
internal val Line = Color(0xFFE7EBE5)
internal val Amber = Color(0xFFB98252)
internal val Red = Color(0xFFAC5F55)

@Composable
internal fun ValeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Forest, onPrimary = Color.White, primaryContainer = Mist, onPrimaryContainer = Ink,
            surface = Paper, onSurface = Ink, background = CanvasColor, onBackground = Ink,
            secondary = Sage, outline = Line, error = Red,
        ),
        content = content,
    )
}

/** A quiet double-chevron mark, drawn as vectors so no external asset is needed. */
@Composable
internal fun ValeMark(modifier: Modifier = Modifier, color: Color = Color.White) {
    Canvas(modifier) {
        val width = size.width
        val height = size.height
        val stroke = width * .105f
        drawLine(color, Offset(width * .12f, height * .20f), Offset(width * .50f, height * .80f), stroke, cap = StrokeCap.Round)
        drawLine(color, Offset(width * .50f, height * .80f), Offset(width * .88f, height * .20f), stroke, cap = StrokeCap.Round)
        drawLine(color.copy(alpha = .55f), Offset(width * .31f, height * .20f), Offset(width * .50f, height * .49f), stroke * .7f, cap = StrokeCap.Round)
        drawLine(color.copy(alpha = .55f), Offset(width * .50f, height * .49f), Offset(width * .69f, height * .20f), stroke * .7f, cap = StrokeCap.Round)
    }
}

@Composable
internal fun BrandTile(size: Dp = 42.dp, modifier: Modifier = Modifier, dark: Boolean = true) {
    Box(modifier.size(size).background(if (dark) Forest else Paper, RoundedCornerShape(size * .30f))) {
        ValeMark(Modifier.size(size * .57f).align(androidx.compose.ui.Alignment.Center), if (dark) Color.White else Forest)
    }
}

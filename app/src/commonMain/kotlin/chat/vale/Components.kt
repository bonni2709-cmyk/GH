package chat.vale

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun ScreenHeader(title: String, subtitle: String, controller: ValeController, action: @Composable (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        PanicBrand(controller::panic)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 23.sp, fontWeight = FontWeight.SemiBold, color = Ink, letterSpacing = (-.5).sp)
            Text(subtitle, fontSize = 12.sp, color = Muted)
        }
        action?.invoke()
    }
}

@Composable
internal fun Avatar(name: String, id: String, size: Dp = 46.dp) {
    val colors = listOf(Color(0xFFE7EEE7), Color(0xFFECE9E1), Color(0xFFE3EAE9), Color(0xFFF1E9E3), Color(0xFFE8E9EF))
    val color = colors[(id.hashCode() and Int.MAX_VALUE) % colors.size]
    Box(Modifier.size(size).background(color, CircleShape), contentAlignment = Alignment.Center) {
        Text(name.trim().take(1).uppercase().ifEmpty { "·" }, color = Forest, fontSize = (size.value * .35f).sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
internal fun RoundIconButton(icon: ImageVector, contentDescription: String, onClick: () -> Unit, filled: Boolean = false) {
    Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(if (filled) Forest else Paper)
        .then(if (filled) Modifier else Modifier.border(1.dp, Line, RoundedCornerShape(13.dp)))
        .clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, contentDescription, tint = if (filled) Color.White else Forest, modifier = Modifier.size(19.dp))
    }
}

@Composable
internal fun SectionEyebrow(text: String) {
    Text(text, color = Sage, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
}

@Composable
internal fun QrImage(qr: QrGrid?, modifier: Modifier = Modifier) {
    if (qr == null) return
    Canvas(modifier.background(Color.White)) {
        val cell = size.minDimension / qr.size
        for (y in 0 until qr.size) for (x in 0 until qr.size) {
            if (qr[x, y]) drawRect(
                color = Ink,
                topLeft = androidx.compose.ui.geometry.Offset(x * cell, y * cell),
                size = androidx.compose.ui.geometry.Size(cell + .25f, cell + .25f),
            )
        }
    }
}

@Composable
internal fun StatusPill(text: String, online: Boolean) {
    Row(Modifier.background(if (online) Mist else Color(0xFFF2ECE5), RoundedCornerShape(100.dp)).padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(6.dp).background(if (online) Sage else Amber, CircleShape))
        Spacer(Modifier.width(6.dp))
        Text(text, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = if (online) Forest else Amber, maxLines = 1)
    }
}

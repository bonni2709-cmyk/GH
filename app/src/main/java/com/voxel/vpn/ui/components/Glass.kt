package com.voxel.vpn.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.voxel.vpn.ui.theme.VoxelColors
import com.voxel.vpn.ui.theme.VoxelType

/** The app backdrop: a deep gradient with two soft colour glows; the upper one follows [accent]. */
@Composable
fun VoxelBackground(
    accent: Color,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val glow by animateColorAsState(targetValue = accent, animationSpec = tween(durationMillis = 900), label = "glow")
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(VoxelColors.Bg0, VoxelColors.Bg1)))
            .drawBehind {
                val upper = Offset(size.width * 0.88f, size.height * 0.06f)
                val upperRadius = size.minDimension * 0.9f
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(glow.copy(alpha = 0.28f), Color.Transparent),
                        center = upper,
                        radius = upperRadius,
                    ),
                    radius = upperRadius,
                    center = upper,
                )
                val lower = Offset(size.width * 0.02f, size.height * 0.68f)
                val lowerRadius = size.minDimension * 0.95f
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(VoxelColors.Accent.copy(alpha = 0.14f), Color.Transparent),
                        center = lower,
                        radius = lowerRadius,
                    ),
                    radius = lowerRadius,
                    center = lower,
                )
            },
        content = content,
    )
}

/** A frosted-glass panel: translucent fill with a light edge that fades towards the bottom. */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    corner: Dp = 24.dp,
    padding: PaddingValues = PaddingValues(16.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(corner)
    val clickable = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    Column(
        modifier = modifier
            .clip(shape)
            .background(Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.09f), Color.White.copy(alpha = 0.035f))))
            .border(
                width = 1.dp,
                brush = Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.20f), Color.White.copy(alpha = 0.05f))),
                shape = shape,
            )
            .then(clickable)
            .padding(padding),
        content = content,
    )
}

/** A small rounded button. [accent] makes it the primary action of its row. */
@Composable
fun GlassPill(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    accent: Boolean = false,
) {
    val shape = RoundedCornerShape(50)
    val fill: Brush = if (accent && enabled) {
        Brush.horizontalGradient(listOf(VoxelColors.Accent, Color(0xFF5E6AD8)))
    } else {
        SolidColor(Color.White.copy(alpha = 0.07f))
    }
    val textColor = when {
        !enabled -> VoxelColors.TextMuted
        accent -> Color.White
        else -> VoxelColors.TextPrimary
    }
    Box(
        modifier = modifier
            .clip(shape)
            .background(fill)
            .border(1.dp, Color.White.copy(alpha = if (accent && enabled) 0f else 0.12f), shape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = VoxelType.BodyMedium.copy(fontSize = 13.sp),
            color = textColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** A round glass button holding an icon; [contentDescription] is what a screen reader says. */
@Composable
fun GlassIconButton(
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(Color.White.copy(alpha = 0.07f))
            .border(1.dp, Color.White.copy(alpha = 0.12f), CircleShape)
            .semantics { this.contentDescription = contentDescription }
            .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/** A tiny uppercase label such as `VLESS` or `REALITY`. */
@Composable
fun Tag(text: String, modifier: Modifier = Modifier, color: Color = VoxelColors.TextSecondary) {
    Text(
        text = text.uppercase(),
        style = VoxelType.Tag,
        color = color,
        maxLines = 1,
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

/** A thin horizontal progress bar. */
@Composable
fun UsageBar(fraction: Float, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(Color.White.copy(alpha = 0.08f)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(fraction.coerceIn(0f, 1f))
                .fillMaxHeight()
                .clip(RoundedCornerShape(3.dp))
                .background(color),
        )
    }
}

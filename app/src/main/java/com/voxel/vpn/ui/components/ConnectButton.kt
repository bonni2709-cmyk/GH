package com.voxel.vpn.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.voxel.vpn.core.ConnectionState
import com.voxel.vpn.core.isBusy
import com.voxel.vpn.ui.theme.VoxelColors

/** The accent colour that stands for a connection state. */
fun stateColor(state: ConnectionState): Color = when (state) {
    is ConnectionState.Connected -> VoxelColors.Good
    is ConnectionState.Failed -> VoxelColors.Bad
    is ConnectionState.Connecting -> VoxelColors.Accent
    is ConnectionState.Disconnecting -> VoxelColors.Accent
    is ConnectionState.Idle -> VoxelColors.TextSecondary
}

/** The big round power button: a glass disc inside a glow that breathes while connected and a ring that spins while busy. */
@Composable
fun ConnectButton(
    state: ConnectionState,
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val color by animateColorAsState(targetValue = stateColor(state), animationSpec = tween(durationMillis = 500), label = "connect-color")
    val busy = state.isBusy
    val connected = state is ConnectionState.Connected

    Box(modifier = modifier.size(204.dp), contentAlignment = Alignment.Center) {
        if (connected) BreathingGlow(color)
        if (busy) SpinningRing(color)
        Box(
            modifier = Modifier
                .size(158.dp)
                .clip(CircleShape)
                .background(Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.14f), Color.White.copy(alpha = 0.04f))))
                .border(
                    width = 1.5.dp,
                    brush = Brush.verticalGradient(listOf(color.copy(alpha = 0.95f), color.copy(alpha = 0.25f))),
                    shape = CircleShape,
                )
                .semantics { contentDescription = description }
                .clickable(enabled = !busy, role = Role.Button, onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            PowerGlyph(color = color, modifier = Modifier.size(60.dp))
        }
    }
}

@Composable
private fun BreathingGlow(color: Color) {
    val transition = rememberInfiniteTransition(label = "breathing")
    val scale by transition.animateFloat(
        initialValue = 0.90f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "breathing-scale",
    )
    Canvas(modifier = Modifier.fillMaxSize()) {
        val radius = size.minDimension / 2f * scale
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(color.copy(alpha = 0.34f), Color.Transparent),
                center = center,
                radius = radius,
            ),
            radius = radius,
            center = center,
        )
    }
}

@Composable
private fun SpinningRing(color: Color) {
    val transition = rememberInfiniteTransition(label = "spinning")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(animation = tween(durationMillis = 1300, easing = LinearEasing)),
        label = "spinning-angle",
    )
    Canvas(modifier = Modifier.fillMaxSize()) {
        val stroke = 3.dp.toPx()
        val inset = stroke / 2f + 2.dp.toPx()
        drawArc(
            color = color,
            startAngle = angle,
            sweepAngle = 110f,
            useCenter = false,
            topLeft = Offset(inset, inset),
            size = Size(size.width - 2f * inset, size.height - 2f * inset),
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
    }
}

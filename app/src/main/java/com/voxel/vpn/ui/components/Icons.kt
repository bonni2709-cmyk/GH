package com.voxel.vpn.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke

/** The classic power symbol: a ring open at the top with a bar through the gap. */
@Composable
fun PowerGlyph(color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.minDimension
        val stroke = w * 0.09f
        val inset = w * 0.17f
        val side = w - 2f * inset
        drawArc(
            color = color,
            startAngle = -50f,
            sweepAngle = 280f,
            useCenter = false,
            topLeft = Offset(inset, inset + w * 0.04f),
            size = Size(side, side),
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
        drawLine(
            color = color,
            start = Offset(w / 2f, w * 0.10f),
            end = Offset(w / 2f, w * 0.47f),
            strokeWidth = stroke,
            cap = StrokeCap.Round,
        )
    }
}

/** Three text lines: the journal. */
@Composable
fun LogsGlyph(color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val stroke = h * 0.09f
        val rows = listOf(0.28f to 0.80f, 0.50f to 0.62f, 0.72f to 0.72f)
        for ((y, end) in rows) {
            drawLine(
                color = color,
                start = Offset(w * 0.20f, h * y),
                end = Offset(w * end, h * y),
                strokeWidth = stroke,
                cap = StrokeCap.Round,
            )
        }
    }
}

@Composable
fun CloseGlyph(color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val stroke = h * 0.09f
        drawLine(color = color, start = Offset(w * 0.28f, h * 0.28f), end = Offset(w * 0.72f, h * 0.72f), strokeWidth = stroke, cap = StrokeCap.Round)
        drawLine(color = color, start = Offset(w * 0.72f, h * 0.28f), end = Offset(w * 0.28f, h * 0.72f), strokeWidth = stroke, cap = StrokeCap.Round)
    }
}

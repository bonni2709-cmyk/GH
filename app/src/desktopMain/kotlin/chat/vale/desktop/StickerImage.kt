package chat.vale

import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import org.jetbrains.skia.Image

internal actual fun decodeSticker(bytes: ByteArray): ImageBitmap? = try {
    val image = Image.makeFromEncoded(bytes)
    if (image.width !in 1..2048 || image.height !in 1..2048) null else image.toComposeImageBitmap()
} catch (_: Exception) { null }

package chat.vale

import androidx.compose.ui.graphics.ImageBitmap

/** Platform decoders reject oversized image dimensions before drawing. */
internal expect fun decodeSticker(bytes: ByteArray): ImageBitmap?
